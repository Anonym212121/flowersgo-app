const SupportChatModel = require('../models/SupportChat');
const SupportMessageModel = require('../models/SupportMessage');
const UserModel = require('../models/User');
const ShopSettings = require('../models/ShopSettings');
const NotificationModel = require('../models/Notification');
const notificationEmailService = require('./notificationEmailService');
const checkUserContent = require('../utils/userContentGuard');
const realtimeService = require('./realtimeService');

const WELCOME_MESSAGE =
    'Вітаємо в службі підтримки FlowersGo! Опишіть, будь ласка, чим можемо допомогити - оператор незабаром підключиться до чату.';

const FAQ_ITEMS = [
    {
        id: 'order',
        question: 'Як оформити замовлення?',
        answer: 'Оберіть букет у каталозі або зберіть свій у конструкторі, додайте в кошик і перейдіть до оформлення. Вкажіть дані, адресу, дату й час доставки та спосіб оплати.'
    },
    {
        id: 'delivery',
        question: 'Як працює доставка?',
        answer: 'Доставка кур\'єром або самовивіз - обираєте на кроці оформлення. Потрібна дата і період доставки. Якщо на сьогодні слотів немає, оберіть інший день.'
    },
    {
        id: 'pay',
        question: 'Як оплатити замовлення?',
        answer: 'Оплата карткою через LiqPay після оформлення. На оплату є 10 хвилин. Якщо не встигнете, замовлення скасується автоматично.'
    },
    {
        id: 'cancel',
        question: 'Як скасувати замовлення?',
        answer: 'У кабінеті відкрийте замовлення і натисніть «Скасувати», якщо кнопка ще доступна. Інакше залиште звернення адміністратору в цьому чаті.'
    },
    {
        id: 'constructor',
        question: 'Що таке конструктор букетів?',
        answer: 'У конструкторі можна зібрати букет самостійно: обрати квіти, кількість і оформити як звичайне замовлення. Якщо конструктор вимкнений, користуйтесь каталогом.'
    },
    {
        id: 'cabinet',
        question: 'Де мої замовлення й профіль?',
        answer: 'Після входу відкрийте «Кабінет»: там замовлення, відгуки, профіль і адреса доставки. Обране - окрема сторінка в меню.'
    },
    {
        id: 'account',
        question: 'Як зареєструватися або увійти?',
        answer: 'Натисніть «Реєстрація» або «Увійти» в шапці сайту. Можна створити акаунт з email або увійти через Google.'
    }
];

const getFaqItems = () => {
    return FAQ_ITEMS.slice();
};

const pushPhone = (phones, label, number, fallbackLabel) => {
    if (!number || !String(number).trim()) {
        return;
    }
    phones.push({
        label: label && String(label).trim() ? String(label).trim() : fallbackLabel,
        number: String(number).trim()
    });
};

const phonesFromEnv = () => {
    const phones = [];
    for (let i = 1; i <= 5; i += 1) {
        pushPhone(
            phones,
            process.env['SUPPORT_PHONE_' + i + '_LABEL'],
            process.env['SUPPORT_PHONE_' + i],
            'Телефон ' + i
        );
    }
    return phones;
};

const getWelcomeMessage = () => {
    const row = ShopSettings.getCached();
    if (row && row.support_welcome && String(row.support_welcome).trim()) {
        return String(row.support_welcome).trim();
    }
    return WELCOME_MESSAGE;
};

const getSupportPhones = () => {
    const phones = [];
    const row = ShopSettings.getCached();
    if (row) {
        pushPhone(phones, row.support_phone_1_label, row.support_phone_1, 'Телефон 1');
        pushPhone(phones, row.support_phone_2_label, row.support_phone_2, 'Телефон 2');
        pushPhone(phones, row.support_phone_3_label, row.support_phone_3, 'Телефон 3');
        return phones;
    }

    const fromEnv = phonesFromEnv();
    if (fromEnv.length > 0) {
        return fromEnv;
    }

    phones.push({
        label: 'Магазин FlowersGo',
        number: '+380671234567'
    });
    return phones;
};

const clientDisplayName = (chat) => {
    if (!chat) {
        return 'Клієнт';
    }

    if (chat.user_id) {
        const first = chat.user_first_name || '';
        const last = chat.user_last_name || '';
        const full = (first + ' ' + last).trim();
        if (full) {
            return full;
        }
        if (chat.user_email) {
            return chat.user_email;
        }
    }

    if (chat.guest_name) {
        return chat.guest_name;
    }

    if (chat.guest_email) {
        return chat.guest_email;
    }

    return 'Гість';
};

const notifyAdminsNewChat = async (chatId, chat) => {
    try {
        const adminIds = await UserModel.listUserIdsByRole('admin');
        if (adminIds.length === 0) {
            return;
        }

        const name = clientDisplayName(chat);
        await NotificationModel.insertForUsers(adminIds, {
            ntype: 'support_chat_open',
            title: 'Новий чат підтримки',
            body: name + ' - чат №' + chatId,
            link_url: '/admin?support=' + chatId
        });
        await notificationEmailService.sendForUserIds(adminIds, {
            title: 'Новий чат підтримки',
            body: name + ' - чат №' + chatId,
            link_url: '/admin?support=' + chatId
        });
    } catch (err) {
        console.error('supportChatNotify newChat:', err.message);
    }
};

const notifyAssignedAdmin = async (chatId, adminId, title, body) => {
    try {
        const aid = Number(adminId);
        if (!Number.isFinite(aid) || aid <= 0) {
            return;
        }
        await NotificationModel.insertForUser({
            user_id: aid,
            ntype: 'support_chat_message',
            title: title,
            body: body,
            link_url: '/admin?support=' + chatId
        });
        await notificationEmailService.sendForUserId(aid, {
            title: title,
            body: body,
            link_url: '/admin?support=' + chatId
        });
    } catch (err) {
        console.error('supportChatNotify assigned:', err.message);
    }
};

const notifyClientUser = async (userId, chatId, title, body) => {
    try {
        const uid = Number(userId);
        if (!Number.isFinite(uid) || uid <= 0) {
            return;
        }
        await NotificationModel.insertForUser({
            user_id: uid,
            ntype: 'support_chat_reply',
            title: title,
            body: body,
            link_url: '/'
        });
        await notificationEmailService.sendForUserId(uid, {
            title: title,
            body: body,
            link_url: '/'
        });
    } catch (err) {
        console.error('supportChatNotify client:', err.message);
    }
};

const addSystemMessage = async (chatId, text) => {
    return SupportMessageModel.insertMessage({
        chat_id: chatId,
        sender_type: 'system',
        sender_user_id: null,
        body: text
    });
};

const mapMessageForClient = (row) => {
    if (!row) {
        return null;
    }

    let senderLabel = '';
    if (row.sender_type === 'admin') {
        const first = row.sender_first_name || '';
        const last = row.sender_last_name || '';
        senderLabel = (first + ' ' + last).trim() || 'Оператор';
    }

    return {
        id: row.id,
        sender_type: row.sender_type,
        sender_label: senderLabel,
        body: row.body,
        createdAt: row.createdAt
    };
};

const mapMessageForAdmin = (row) => {
    if (!row) {
        return null;
    }

    let senderLabel = '';
    if (row.sender_type === 'admin') {
        const first = row.sender_first_name || '';
        const last = row.sender_last_name || '';
        senderLabel = (first + ' ' + last).trim() || 'Адмін';
    }

    return {
        id: row.id,
        sender_type: row.sender_type,
        sender_label: senderLabel,
        body: row.body,
        createdAt: row.createdAt
    };
};

const mapChatForClient = (chat) => {
    if (!chat) {
        return null;
    }

    return {
        id: chat.id,
        status: chat.status,
        assigned_admin_id: chat.assigned_admin_id,
        admin_name: chat.admin_first_name
            ? (chat.admin_first_name + ' ' + (chat.admin_last_name || '')).trim()
            : null,
        closed_at: chat.closed_at
    };
};

const pushChatLive = (chat, event, message) => {
    if (!chat) {
        return;
    }
    realtimeService.pushSupportChat({
        event: event || 'message',
        chat_id: chat.id,
        chat: mapChatForClient(chat),
        message: message || null,
        user_id: chat.user_id,
        guest_token: chat.guest_token,
        admin_id: chat.assigned_admin_id,
        to_admins: true
    });
};

const mapChatForAdminList = (chat) => {
    if (!chat) {
        return null;
    }

    return {
        id: chat.id,
        status: chat.status,
        client_name: clientDisplayName(chat),
        guest_email: chat.guest_email || chat.user_email || '',
        guest_phone: chat.guest_phone || '',
        last_message: chat.last_message || chat.last_client_message || '',
        last_message_at: chat.last_message_at,
        assigned_admin_id: chat.assigned_admin_id,
        closed_at: chat.closed_at,
        unread_count: Number(chat.unread_count) || 0,
        admin_name: chat.admin_first_name
            ? (chat.admin_first_name + ' ' + (chat.admin_last_name || '')).trim()
            : null,
        createdAt: chat.createdAt
    };
};

const getActiveChat = async ({ userId, guestToken }) => {
    if (userId) {
        return SupportChatModel.findActiveForUser(userId);
    }
    if (guestToken) {
        return SupportChatModel.findActiveForGuest(guestToken);
    }
    return null;
};

const getClientChatView = async ({ userId, guestToken }) => {
    let chat = await getActiveChat({ userId, guestToken });
    if (chat) {
        return { chat: chat, isArchive: false };
    }

    if (userId) {
        chat = await SupportChatModel.findLatestClosedForUser(userId);
    } else if (guestToken) {
        chat = await SupportChatModel.findLatestClosedForGuest(guestToken);
    }

    if (!chat) {
        return { chat: null, isArchive: false };
    }

    return { chat: chat, isArchive: true };
};

const mapChatForClientArchiveItem = (chat) => {
    if (!chat) {
        return null;
    }
    return {
        id: chat.id,
        closed_at: chat.closed_at,
        preview: chat.last_message || ''
    };
};

const listClientArchive = async ({ userId, guestToken }) => {
    if (userId) {
        const rows = await SupportChatModel.listClosedForUser(userId);
        return rows.map(mapChatForClientArchiveItem);
    }
    if (guestToken) {
        const rows = await SupportChatModel.listClosedForGuest(guestToken);
        return rows.map(mapChatForClientArchiveItem);
    }
    return [];
};

const countClientArchive = async ({ userId, guestToken }) => {
    if (userId) {
        return SupportChatModel.countClosedForUser(userId);
    }
    if (guestToken) {
        return SupportChatModel.countClosedForGuest(guestToken);
    }
    return 0;
};

const chatBelongsToClient = (chat, { userId, guestToken }) => {
    if (!chat) {
        return false;
    }
    if (userId) {
        return Number(chat.user_id) === Number(userId);
    }
    if (guestToken) {
        return chat.guest_token === guestToken;
    }
    return false;
};

const getClientArchiveChat = async (chatId, ctx) => {
    const chat = await SupportChatModel.findById(chatId);
    if (!chat || chat.status !== 'closed') {
        return { ok: false, message: 'Чат не знайдено' };
    }
    if (!chatBelongsToClient(chat, ctx)) {
        return { ok: false, message: 'Немає доступу' };
    }
    const rows = await SupportMessageModel.listByChatId(chatId);
    return {
        ok: true,
        chat: mapChatForClient(chat),
        messages: rows.map(mapMessageForClient)
    };
};

const startChat = async ({ userId, guestToken, guestName, guestEmail, guestPhone, firstMessage }) => {
    const check = checkUserContent(firstMessage, { minLen: 1, maxLen: 2000 });
    if (!check.ok) {
        return { ok: false, message: check.message };
    }
    const text = check.text;

    let safeGuestName = guestName;
    if (guestName) {
        const nameCheck = checkUserContent(guestName, { minLen: 1, maxLen: 120 });
        if (!nameCheck.ok) {
            return { ok: false, message: nameCheck.message };
        }
        safeGuestName = nameCheck.text;
    }

    let chat = await getActiveChat({ userId, guestToken });
    if (chat) {
        return { ok: false, message: 'У вас уже є відкритий чат', chat };
    }

    chat = await SupportChatModel.createChat({
        user_id: userId,
        guest_token: guestToken,
        guest_name: safeGuestName,
        guest_email: guestEmail,
        guest_phone: guestPhone
    });

    if (!chat) {
        return { ok: false, message: 'Не вдалося створити чат' };
    }

    await addSystemMessage(chat.id, WELCOME_MESSAGE);

    const msg = await SupportMessageModel.insertMessage({
        chat_id: chat.id,
        sender_type: 'client',
        sender_user_id: userId || null,
        body: text
    });

    if (!msg) {
        return { ok: false, message: 'Не вдалося надіслати повідомлення' };
    }

    await addSystemMessage(chat.id, 'Дякуємо за звернення! Ваше повідомлення отримано - очікуйте відповіді оператора.');

    const fullChat = await SupportChatModel.findById(chat.id);
    await notifyAdminsNewChat(chat.id, fullChat);
    pushChatLive(fullChat, 'started', mapMessageForClient(msg));

    return { ok: true, chat: fullChat };
};

const sendClientMessage = async ({ chatId, userId, guestToken, body }) => {
    const check = checkUserContent(body, { minLen: 1, maxLen: 2000 });
    if (!check.ok) {
        return { ok: false, message: check.message };
    }
    const text = check.text;

    const chat = await SupportChatModel.findById(chatId);
    if (!chat) {
        return { ok: false, message: 'Чат не знайдено' };
    }

    if (chat.status === 'closed') {
        return { ok: false, message: 'Чат завершено. Створіть новий діалог.' };
    }

    if (userId) {
        if (Number(chat.user_id) !== Number(userId)) {
            return { ok: false, message: 'Немає доступу до чату' };
        }
    } else if (guestToken) {
        if (chat.guest_token !== guestToken) {
            return { ok: false, message: 'Немає доступу до чату' };
        }
    } else {
        return { ok: false, message: 'Потрібна авторизація або гостьовий ключ' };
    }

    const msg = await SupportMessageModel.insertMessage({
        chat_id: chat.id,
        sender_type: 'client',
        sender_user_id: userId || null,
        body: text
    });

    if (!msg) {
        return { ok: false, message: 'Не вдалося надіслати' };
    }

    if (chat.status === 'assigned' && chat.assigned_admin_id) {
        const name = clientDisplayName(chat);
        await notifyAssignedAdmin(
            chat.id,
            chat.assigned_admin_id,
            'Нове повідомлення в чаті',
            name + ': ' + text.slice(0, 120)
        );
    }

    pushChatLive(chat, 'message', mapMessageForClient(msg));

    return { ok: true, message: mapMessageForClient(msg) };
};

const claimChatForAdmin = async (chatId, adminId) => {
    const result = await SupportChatModel.claimChat(chatId, adminId);
    if (!result.ok) {
        return result;
    }

    const admin = await UserModel.getUserid(adminId);
    let adminName = 'Оператор';
    if (admin) {
        adminName = ((admin.first_name || '') + ' ' + (admin.last_name || '')).trim() || adminName;
    }

    const sys = await addSystemMessage(chatId, 'Оператор ' + adminName + ' підключився до чату.');
    const full = await SupportChatModel.findById(chatId);
    pushChatLive(full, 'claimed', mapMessageForClient(sys));

    return { ok: true, chat: result.chat };
};

const sendAdminMessage = async (chatId, adminId, body) => {
    const check = checkUserContent(body, {
        minLen: 1,
        maxLen: 2000,
        skipProfanity: true,
        skipSpam: true
    });
    if (!check.ok) {
        return { ok: false, message: check.message };
    }
    const text = check.text;

    const chat = await SupportChatModel.findById(chatId);
    if (!chat) {
        return { ok: false, message: 'Чат не знайдено' };
    }

    if (chat.status !== 'assigned' || Number(chat.assigned_admin_id) !== Number(adminId)) {
        return { ok: false, message: 'Спочатку візьміть чат в роботу' };
    }

    const msg = await SupportMessageModel.insertMessage({
        chat_id: chat.id,
        sender_type: 'admin',
        sender_user_id: adminId,
        body: text
    });

    if (!msg) {
        return { ok: false, message: 'Не вдалося надіслати' };
    }

    if (chat.user_id) {
        await notifyClientUser(chat.user_id, chat.id, 'Відповідь підтримки', text.slice(0, 140));
    } else if (chat.guest_email) {
        await notificationEmailService.sendToAddress(chat.guest_email, {
            title: 'Відповідь підтримки FlowersGo',
            body: text.slice(0, 500),
            link_url: '/'
        });
    }

    const liveChat = await SupportChatModel.findById(chat.id);
    pushChatLive(liveChat, 'message', mapMessageForClient(msg));

    return { ok: true, message: mapMessageForAdmin(msg) };
};

const closeChatForAdmin = async (chatId, adminId) => {
    const ok = await SupportChatModel.closeChat(chatId, adminId);
    if (!ok) {
        return { ok: false, message: 'Не вдалося закрити чат' };
    }

    const sys = await addSystemMessage(chatId, 'Діалог завершено. Дякуємо за звернення! Щоб написати знову - відкрийте новий чат.');
    const full = await SupportChatModel.findById(chatId);
    pushChatLive(full, 'closed', mapMessageForClient(sys));

    return { ok: true };
};

const getClientUnreadCount = async ({ userId, guestToken }) => {
    if (userId) {
        return SupportChatModel.countUnreadForClientUser(userId);
    }
    if (guestToken) {
        return SupportChatModel.countUnreadForClientGuest(guestToken);
    }
    return 0;
};

const getAdminUnreadCount = async (adminId) => {
    return SupportChatModel.countUnreadForAdmin(adminId);
};

const markClientRead = async (chatId, ctx) => {
    const cid = Number(chatId);
    const chat = await SupportChatModel.findById(cid);
    if (!chat) {
        return { ok: false, message: 'Чат не знайдено' };
    }
    if (!chatBelongsToClient(chat, ctx)) {
        return { ok: false, message: 'Немає доступу' };
    }
    const lastId = await SupportMessageModel.getLastMessageId(cid);
    await SupportChatModel.updateClientLastRead(cid, lastId);
    return { ok: true, unread_count: 0 };
};

const markAdminRead = async (chatId, adminId) => {
    const cid = Number(chatId);
    const aid = Number(adminId);
    const chat = await SupportChatModel.findById(cid);
    if (!chat) {
        return { ok: false, message: 'Чат не знайдено' };
    }
    if (chat.status === 'assigned' && Number(chat.assigned_admin_id) !== aid) {
        return { ok: false, message: 'Чат веде інший адміністратор' };
    }
    const lastId = await SupportMessageModel.getLastMessageId(cid);
    await SupportChatModel.updateAdminLastRead(cid, lastId);
    return { ok: true, unread_count: 0 };
};

const BLOCK_APPEAL_PREFIX = '[Звернення щодо блокування] ';

const submitBlockedUserMessage = async (userId, email, messageText) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return { ok: false, message: 'Невірний користувач' };
    }

    const raw = typeof messageText === 'string' ? messageText.trim() : '';
    if (raw.length < 5) {
        return { ok: false, message: 'Повідомлення занадто коротке' };
    }

    const body = BLOCK_APPEAL_PREFIX + raw.slice(0, 1900);
    const activeChat = await SupportChatModel.findActiveForUser(uid);

    if (activeChat) {
        const msg = await SupportMessageModel.insertMessage({
            chat_id: activeChat.id,
            sender_type: 'client',
            sender_user_id: uid,
            body: body
        });
        if (!msg) {
            return { ok: false, message: 'Не вдалося надіслати повідомлення' };
        }
        if (activeChat.status === 'assigned' && activeChat.assigned_admin_id) {
            const name = clientDisplayName(activeChat);
            await notifyAssignedAdmin(
                activeChat.id,
                activeChat.assigned_admin_id,
                'Звернення заблокованого користувача',
                name + ': ' + body.slice(0, 120)
            );
        } else {
            const fullChat = await SupportChatModel.findById(activeChat.id);
            await notifyAdminsNewChat(activeChat.id, fullChat);
        }
        return { ok: true };
    }

    return startChat({
        userId: uid,
        guestEmail: email,
        firstMessage: body
    });
};

module.exports = {
    getWelcomeMessage,
    getFaqItems,
    getSupportPhones,
    clientDisplayName,
    mapMessageForClient,
    mapMessageForAdmin,
    mapChatForClient,
    mapChatForAdminList,
    getActiveChat,
    getClientChatView,
    listClientArchive,
    countClientArchive,
    getClientArchiveChat,
    startChat,
    sendClientMessage,
    claimChatForAdmin,
    sendAdminMessage,
    closeChatForAdmin,
    getClientUnreadCount,
    getAdminUnreadCount,
    markClientRead,
    markAdminRead,
    submitBlockedUserMessage
};
