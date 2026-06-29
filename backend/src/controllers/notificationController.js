const NotificationModel = require('../models/Notification');

const getUserId = (res) => {
    const raw = res.locals.currentUser && res.locals.currentUser.user_id;
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
        return null;
    }
    return userId;
};

const list = async (req, res) => {
    try {
        const userId = getUserId(res);
        if (!userId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        const limitRaw = Number(req.query.limit);
        const offsetRaw = Number(req.query.offset);
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 15;
        const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

        const rows = await NotificationModel.listForUser(userId, limit, offset);
        const total = await NotificationModel.countForUser(userId);
        const hasMore = offset + rows.length < total;

        return res.status(200).json({
            notifications: rows,
            total: total,
            has_more: hasMore
        });
    } catch (err) {
        console.error('notification list:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const unreadCount = async (req, res) => {
    try {
        const userId = getUserId(res);
        if (!userId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        const count = await NotificationModel.countUnread(userId);
        return res.status(200).json({ count });
    } catch (err) {
        console.error('notification unreadCount:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const markRead = async (req, res) => {
    try {
        const userId = getUserId(res);
        if (!userId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: 'Невірний ідентифікатор' });
        }

        const ok = await NotificationModel.markRead(id, userId);
        if (!ok) {
            return res.status(404).json({ message: 'Сповіщення не знайдено' });
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('notification markRead:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const markAllRead = async (req, res) => {
    try {
        const userId = getUserId(res);
        if (!userId) {
            return res.status(401).json({ message: 'Потрібен вхід' });
        }

        await NotificationModel.markAllRead(userId);
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('notification markAllRead:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    list,
    unreadCount,
    markRead,
    markAllRead
};
