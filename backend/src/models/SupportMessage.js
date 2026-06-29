const db = require('../config/db');

const trimBody = (raw) => {
    if (typeof raw !== 'string') {
        return '';
    }
    const text = raw.trim();
    if (!text) {
        return '';
    }
    if (text.length > 2000) {
        return text.slice(0, 2000);
    }
    return text;
};

const insertMessage = async ({ chat_id, sender_type, sender_user_id, body }) => {
    const cid = Number(chat_id);
    const bodyText = trimBody(body);
    const type = typeof sender_type === 'string' ? sender_type.trim() : '';

    if (!Number.isFinite(cid) || cid <= 0 || !bodyText) {
        return null;
    }

    if (type !== 'client' && type !== 'admin' && type !== 'system') {
        return null;
    }

    let senderId = null;
    const rawSender = Number(sender_user_id);
    if (Number.isFinite(rawSender) && rawSender > 0) {
        senderId = rawSender;
    }

    const [result] = await db.execute(
        `INSERT INTO support_messages (chat_id, sender_type, sender_user_id, body)
         VALUES (?, ?, ?, ?)`,
        [cid, type, senderId, bodyText]
    );

    const id = Number(result && result.insertId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    await db.execute('UPDATE support_chats SET updatedAt = NOW() WHERE id = ?', [cid]);

    return findById(id);
};

const findById = async (messageId) => {
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT m.*,
                u.first_name AS sender_first_name,
                u.last_name AS sender_last_name
         FROM support_messages m
         LEFT JOIN users u ON m.sender_user_id = u.id
         WHERE m.id = ?
         LIMIT 1`,
        [id]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0];
};

const listByChatId = async (chatId, sinceId) => {
    const cid = Number(chatId);
    if (!Number.isFinite(cid) || cid <= 0) {
        return [];
    }

    const since = Number(sinceId);
    if (Number.isFinite(since) && since > 0) {
        const [rows] = await db.execute(
            `SELECT m.*,
                    u.first_name AS sender_first_name,
                    u.last_name AS sender_last_name
             FROM support_messages m
             LEFT JOIN users u ON m.sender_user_id = u.id
             WHERE m.chat_id = ? AND m.id > ?
             ORDER BY m.id ASC`,
            [cid, since]
        );
        return rows || [];
    }

    const [rows] = await db.execute(
        `SELECT m.*,
                u.first_name AS sender_first_name,
                u.last_name AS sender_last_name
         FROM support_messages m
         LEFT JOIN users u ON m.sender_user_id = u.id
         WHERE m.chat_id = ?
         ORDER BY m.id ASC`,
        [cid]
    );

    return rows || [];
};

const getLastMessageId = async (chatId) => {
    const cid = Number(chatId);
    if (!Number.isFinite(cid) || cid <= 0) {
        return 0;
    }
    const [rows] = await db.execute(
        'SELECT id FROM support_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1',
        [cid]
    );
    if (!rows || rows.length === 0) {
        return 0;
    }
    return Number(rows[0].id) || 0;
};

const countUnreadForClient = async (chatId, afterId) => {
    const cid = Number(chatId);
    const after = Number(afterId) || 0;
    if (!Number.isFinite(cid) || cid <= 0) {
        return 0;
    }
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS c FROM support_messages
         WHERE chat_id = ? AND id > ? AND sender_type IN ('admin', 'system')`,
        [cid, after]
    );
    return Number(rows[0].c) || 0;
};

const countUnreadForAdmin = async (chatId, afterId) => {
    const cid = Number(chatId);
    const after = Number(afterId) || 0;
    if (!Number.isFinite(cid) || cid <= 0) {
        return 0;
    }
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS c FROM support_messages
         WHERE chat_id = ? AND id > ? AND sender_type = 'client'`,
        [cid, after]
    );
    return Number(rows[0].c) || 0;
};

module.exports = {
    insertMessage,
    findById,
    listByChatId,
    getLastMessageId,
    countUnreadForClient,
    countUnreadForAdmin
};
