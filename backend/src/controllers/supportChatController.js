const crypto = require('crypto');
const SupportChatModel = require('../models/SupportChat');
const SupportMessageModel = require('../models/SupportMessage');
const supportChatService = require('../services/supportChatService');

const GUEST_COOKIE = 'support_guest_token';
const GUEST_COOKIE_DAYS = 365;

const parseCookies = (cookieHeader) => {
    const result = {};
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return result;
    }
    const parts = cookieHeader.split(';');
    for (let i = 0; i < parts.length; i += 1) {
        const trimmed = parts[i].trim();
        const idx = trimmed.indexOf('=');
        if (idx === -1) {
            continue;
        }
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (key) {
            result[key] = decodeURIComponent(value);
        }
    }
    return result;
};

const getGuestToken = (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    let token = cookies[GUEST_COOKIE];
    if (token && typeof token === 'string' && token.length >= 8) {
        return token;
    }

    token = crypto.randomBytes(16).toString('hex');
    res.cookie(GUEST_COOKIE, token, {
        maxAge: GUEST_COOKIE_DAYS * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    });
    return token;
};

const getClientContext = (req, res) => {
    const user = res.locals.currentUser;
    if (user && user.user_id) {
        return {
            userId: Number(user.user_id),
            guestToken: null
        };
    }
    return {
        userId: null,
        guestToken: getGuestToken(req, res)
    };
};

const getConfig = (req, res) => {
    try {
        return res.json({
            phones: supportChatService.getSupportPhones(),
            welcome_message: supportChatService.getWelcomeMessage()
        });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка завантаження' });
    }
};

const getActive = async (req, res) => {
    try {
        const ctx = getClientContext(req, res);
        const chat = await supportChatService.getActiveChat(ctx);

        if (!chat) {
            return res.json({ chat: null, messages: [], is_archive: false });
        }

        const fullChat = await SupportChatModel.findById(chat.id);
        const rows = await SupportMessageModel.listByChatId(chat.id);
        const messages = rows.map(supportChatService.mapMessageForClient);

        return res.json({
            chat: supportChatService.mapChatForClient(fullChat),
            messages: messages,
            is_archive: false
        });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка завантаження чату' });
    }
};

const listArchive = async (req, res) => {
    try {
        const ctx = getClientContext(req, res);
        const chats = await supportChatService.listClientArchive(ctx);
        return res.json({ chats: chats, count: chats.length });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка завантаження архіву' });
    }
};

const getArchiveChat = async (req, res) => {
    try {
        const ctx = getClientContext(req, res);
        const chatId = Number(req.params.id);
        const result = await supportChatService.getClientArchiveChat(chatId, ctx);

        if (!result.ok) {
            return res.status(404).json({ message: result.message });
        }

        return res.json({
            chat: result.chat,
            messages: result.messages,
            is_archive: true
        });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка завантаження чату' });
    }
};

const pollMessages = async (req, res) => {
    try {
        const ctx = getClientContext(req, res);
        const chatId = Number(req.query.chat_id);
        const sinceId = Number(req.query.since_id) || 0;

        if (!Number.isFinite(chatId) || chatId <= 0) {
            return res.status(400).json({ message: 'Невірний чат' });
        }

        const chat = await SupportChatModel.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: 'Чат не знайдено' });
        }

        if (ctx.userId) {
            if (Number(chat.user_id) !== ctx.userId) {
                return res.status(403).json({ message: 'Немає доступу' });
            }
        } else if (chat.guest_token !== ctx.guestToken) {
            return res.status(403).json({ message: 'Немає доступу' });
        }

        const fullChat = await SupportChatModel.findById(chatId);
        const rows = await SupportMessageModel.listByChatId(chatId, sinceId);
        const messages = rows.map(supportChatService.mapMessageForClient);

        return res.json({
            chat: supportChatService.mapChatForClient(fullChat),
            messages: messages
        });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка оновлення' });
    }
};

const startChat = async (req, res) => {
    try {
        const ctx = getClientContext(req, res);
        const body = req.body || {};

        if (!ctx.userId) {
            const guestName = typeof body.guest_name === 'string' ? body.guest_name.trim() : '';
            const guestEmail = typeof body.guest_email === 'string' ? body.guest_email.trim() : '';
            const guestPhone = typeof body.guest_phone === 'string' ? body.guest_phone.trim() : '';
            if (!guestName) {
                return res.status(400).json({ message: 'Вкажіть ваше ім\'я' });
            }
            if (!guestEmail && !guestPhone) {
                return res.status(400).json({ message: 'Вкажіть email або телефон' });
            }

            const result = await supportChatService.startChat({
                userId: null,
                guestToken: ctx.guestToken,
                guestName: guestName,
                guestEmail: guestEmail,
                guestPhone: guestPhone,
                firstMessage: body.message
            });

            if (!result.ok) {
                return res.status(400).json({ message: result.message });
            }

            const rows = await SupportMessageModel.listByChatId(result.chat.id);
            return res.json({
                chat: supportChatService.mapChatForClient(result.chat),
                messages: rows.map(supportChatService.mapMessageForClient)
            });
        }

        const result = await supportChatService.startChat({
            userId: ctx.userId,
            guestToken: null,
            guestName: null,
            guestEmail: null,
            guestPhone: null,
            firstMessage: body.message
        });

        if (!result.ok) {
            return res.status(400).json({ message: result.message });
        }

        const rows = await SupportMessageModel.listByChatId(result.chat.id);
        return res.json({
            chat: supportChatService.mapChatForClient(result.chat),
            messages: rows.map(supportChatService.mapMessageForClient)
        });
    } catch (err) {
        return res.status(500).json({ message: 'Не вдалося створити чат' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const ctx = getClientContext(req, res);
        const chatId = Number(req.body && req.body.chat_id);
        const text = req.body && req.body.message;

        const result = await supportChatService.sendClientMessage({
            chatId: chatId,
            userId: ctx.userId,
            guestToken: ctx.guestToken,
            body: text
        });

        if (!result.ok) {
            return res.status(400).json({ message: result.message });
        }

        return res.json({ message: result.message });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка відправки' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const ctx = getClientContext(req, res);
        const count = await supportChatService.getClientUnreadCount(ctx);
        return res.json({ unread_count: count });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка' });
    }
};

const markRead = async (req, res) => {
    try {
        const ctx = getClientContext(req, res);
        const chatId = Number(req.body && req.body.chat_id);
        const result = await supportChatService.markClientRead(chatId, ctx);

        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Помилка' });
        }

        return res.json({ unread_count: result.unread_count });
    } catch (err) {
        return res.status(500).json({ message: 'Помилка' });
    }
};

module.exports = {
    getConfig,
    getActive,
    listArchive,
    getArchiveChat,
    pollMessages,
    startChat,
    sendMessage,
    getUnreadCount,
    markRead
};
