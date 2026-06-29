const db = require('../config/db');

const insertForUser = async ({ user_id, order_id, ntype, title, body, link_url }) => {
    const uid = Number(user_id);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const typeKey = typeof ntype === 'string' ? ntype.trim() : '';
    const titleText = typeof title === 'string' ? title.trim() : '';
    if (!typeKey || !titleText) {
        return false;
    }

    const oid = order_id != null && order_id !== '' ? Number(order_id) : null;
    const bodyText = typeof body === 'string' ? body.trim() : null;
    const link = typeof link_url === 'string' && link_url.trim() !== '' ? link_url.trim() : null;

    const [result] = await db.execute(
        `INSERT INTO user_notifications (user_id, order_id, ntype, title, body, link_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uid, Number.isFinite(oid) && oid > 0 ? oid : null, typeKey, titleText, bodyText, link]
    );

    return result && result.affectedRows > 0;
};

const insertForUsers = async (userIds, payload) => {
    const ids = Array.isArray(userIds) ? userIds : [];
    let count = 0;
    for (const rawId of ids) {
        const ok = await insertForUser({
            user_id: rawId,
            order_id: payload.order_id,
            ntype: payload.ntype,
            title: payload.title,
            body: payload.body,
            link_url: payload.link_url
        });
        if (ok) {
            count += 1;
        }
    }
    return count;
};

const listForUser = async (userId, limit = 15, offset = 0) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return [];
    }

    const lim = Number(limit);
    const safeLimit = Number.isFinite(lim) && lim > 0 && lim <= 100 ? lim : 15;

    const off = Number(offset);
    const safeOffset = Number.isFinite(off) && off >= 0 ? Math.floor(off) : 0;

    const [rows] = await db.execute(
        `SELECT id, order_id, ntype, title, body, link_url, is_read, createdAt
         FROM user_notifications
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [uid]
    );

    return rows || [];
};

const countForUser = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return 0;
    }

    const [rows] = await db.execute(
        'SELECT COUNT(*) AS cnt FROM user_notifications WHERE user_id = ?',
        [uid]
    );

    return rows && rows.length > 0 ? Number(rows[0].cnt) || 0 : 0;
};

const countUnread = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return 0;
    }

    const [rows] = await db.execute(
        'SELECT COUNT(*) AS cnt FROM user_notifications WHERE user_id = ? AND is_read = 0',
        [uid]
    );

    return rows && rows.length > 0 ? Number(rows[0].cnt) || 0 : 0;
};

const markRead = async (notificationId, userId) => {
    const nid = Number(notificationId);
    const uid = Number(userId);
    if (!Number.isFinite(nid) || nid <= 0 || !Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        'UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [nid, uid]
    );

    return result && result.affectedRows > 0;
};

const markAllRead = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        'UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [uid]
    );

    return result && result.affectedRows >= 0;
};

module.exports = {
    insertForUser,
    insertForUsers,
    listForUser,
    countForUser,
    countUnread,
    markRead,
    markAllRead
};
