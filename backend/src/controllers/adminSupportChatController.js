const SupportChatModel = require('../models/SupportChat');
const SupportMessageModel = require('../models/SupportMessage');
const supportChatService = require('../services/supportChatService');

const getAdminId = (res) => {
    const user = res.locals.currentUser;
    if (user && user.user_id) {
        return Number(user.user_id);
    }
    return null;
};

const listInbox = async (req, res) => {
    try {
        const rows = await SupportChatModel.listOpen();
        const chats = rows.map(supportChatService.mapChatForAdminList);
        return res.json({ chats: chats });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка завантаження черги' });
    }
};

const listMine = async (req, res) => {
    try {
        const adminId = getAdminId(res);
        if (!adminId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        const rows = await SupportChatModel.listAssignedToAdmin(adminId);
        const chats = rows.map(supportChatService.mapChatForAdminList);
        return res.json({ chats: chats });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка завантаження' });
    }
};

const listArchive = async (req, res) => {
    try {
        const rows = await SupportChatModel.listClosedAll();
        const chats = rows.map(supportChatService.mapChatForAdminList);
        return res.json({ chats: chats });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка завантаження архіву' });
    }
};

const getCounts = async (req, res) => {
    try {
        const openCount = await SupportChatModel.countOpen();
        const adminId = getAdminId(res);
        let mineCount = 0;
        let unreadCount = 0;
        if (adminId) {
            const mine = await SupportChatModel.listAssignedToAdmin(adminId);
            mineCount = mine.length;
            unreadCount = await supportChatService.getAdminUnreadCount(adminId);
        }
        return res.json({
            open_count: openCount,
            mine_count: mineCount,
            unread_count: unreadCount
        });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка' });
    }
};

const getChatDetail = async (req, res) => {
    try {
        const adminId = getAdminId(res);
        const chatId = Number(req.params.id);
        if (!Number.isFinite(chatId) || chatId <= 0) {
            return res.status(400).json({ message: 'Невірний id чату' });
        }

        const chat = await SupportChatModel.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: 'Чат не знайдено' });
        }

        if (chat.status === 'assigned' && Number(chat.assigned_admin_id) !== adminId) {
            return res.status(403).json({ message: 'Чат веде інший адміністратор' });
        }

        const rows = await SupportMessageModel.listByChatId(chatId);
        const messages = rows.map(supportChatService.mapMessageForAdmin);

        return res.json({
            chat: {
                id: chat.id,
                status: chat.status,
                client_name: supportChatService.clientDisplayName(chat),
                guest_email: chat.guest_email || chat.user_email || '',
                guest_phone: chat.guest_phone || '',
                assigned_admin_id: chat.assigned_admin_id,
                admin_name: chat.admin_first_name
                    ? (chat.admin_first_name + ' ' + (chat.admin_last_name || '')).trim()
                    : null,
                closed_at: chat.closed_at
            },
            messages: messages
        });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка завантаження чату' });
    }
};

const pollChat = async (req, res) => {
    try {
        const adminId = getAdminId(res);
        const chatId = Number(req.params.id);
        const sinceId = Number(req.query.since_id) || 0;

        const chat = await SupportChatModel.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: 'Чат не знайдено' });
        }

        if (chat.status === 'assigned' && Number(chat.assigned_admin_id) !== adminId) {
            return res.status(403).json({ message: 'Чат веде інший адміністратор' });
        }

        const rows = await SupportMessageModel.listByChatId(chatId, sinceId);
        const messages = rows.map(supportChatService.mapMessageForAdmin);
        const fresh = await SupportChatModel.findById(chatId);

        return res.json({
            chat: {
                id: fresh.id,
                status: fresh.status,
                assigned_admin_id: fresh.assigned_admin_id
            },
            messages: messages
        });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка оновлення' });
    }
};

const claimChat = async (req, res) => {
    try {
        const adminId = getAdminId(res);
        if (!adminId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        const chatId = Number(req.params.id);
        const result = await supportChatService.claimChatForAdmin(chatId, adminId);

        if (!result.ok) {
            const msg = result.reason === 'already_taken'
                ? 'Чат уже взяв інший оператор'
                : 'Не вдалося взяти чат';
            return res.status(409).json({ message: msg });
        }

        const rows = await SupportMessageModel.listByChatId(chatId);
        return res.json({
            chat: supportChatService.mapChatForAdminList(result.chat),
            messages: rows.map(supportChatService.mapMessageForAdmin)
        });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const adminId = getAdminId(res);
        if (!adminId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        const chatId = Number(req.params.id);
        const text = req.body && req.body.message;
        const result = await supportChatService.sendAdminMessage(chatId, adminId, text);

        if (!result.ok) {
            return res.status(400).json({ message: result.message });
        }

        return res.json({ message: result.message });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка відправки' });
    }
};

const closeChat = async (req, res) => {
    try {
        const adminId = getAdminId(res);
        if (!adminId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        const chatId = Number(req.params.id);
        const result = await supportChatService.closeChatForAdmin(chatId, adminId);

        if (!result.ok) {
            return res.status(400).json({ message: result.message });
        }

        return res.json({ message: 'Чат закрито' });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка закриття' });
    }
};

const markRead = async (req, res) => {
    try {
        const adminId = getAdminId(res);
        if (!adminId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        const chatId = Number(req.params.id);
        const result = await supportChatService.markAdminRead(chatId, adminId);

        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Помилка' });
        }

        const unreadCount = await supportChatService.getAdminUnreadCount(adminId);
        return res.json({ unread_count: unreadCount });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка' });
    }
};

module.exports = {
    listInbox,
    listMine,
    listArchive,
    getCounts,
    getChatDetail,
    pollChat,
    claimChat,
    sendMessage,
    closeChat,
    markRead
};
