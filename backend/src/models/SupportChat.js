const db = require('../config/db');

const ACTIVE_STATUSES = ['open', 'assigned'];

const trimText = (raw, maxLen) => {
    if (typeof raw !== 'string') {
        return '';
    }
    const text = raw.trim();
    if (!text) {
        return '';
    }
    if (text.length <= maxLen) {
        return text;
    }
    return text.slice(0, maxLen);
};

const findById = async (chatId) => {
    const id = Number(chatId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT c.*,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.email AS user_email,
                a.first_name AS admin_first_name,
                a.last_name AS admin_last_name
         FROM support_chats c
         LEFT JOIN users u ON c.user_id = u.id
         LEFT JOIN users a ON c.assigned_admin_id = a.id
         WHERE c.id = ?
         LIMIT 1`,
        [id]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0];
};

const findActiveForUser = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return null;
    }

    const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
    const [rows] = await db.execute(
        `SELECT * FROM support_chats
         WHERE user_id = ?
           AND status IN (${placeholders})
         ORDER BY id DESC
         LIMIT 1`,
        [uid, ...ACTIVE_STATUSES]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0];
};

const findActiveForGuest = async (guestToken) => {
    const token = trimText(guestToken, 64);
    if (!token) {
        return null;
    }

    const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
    const [rows] = await db.execute(
        `SELECT * FROM support_chats
         WHERE guest_token = ?
           AND status IN (${placeholders})
         ORDER BY id DESC
         LIMIT 1`,
        [token, ...ACTIVE_STATUSES]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0];
};

const createChat = async (data) => {
    const userId = data.user_id != null ? Number(data.user_id) : null;
    const guestToken = trimText(data.guest_token, 64) || null;
    const guestName = trimText(data.guest_name, 120) || null;
    const guestEmail = trimText(data.guest_email, 255) || null;
    const guestPhone = trimText(data.guest_phone, 40) || null;

    if ((!userId || userId <= 0) && !guestToken) {
        return null;
    }

    const [result] = await db.execute(
        `INSERT INTO support_chats
            (user_id, guest_token, guest_name, guest_email, guest_phone, status)
         VALUES (?, ?, ?, ?, ?, 'open')`,
        [
            userId && userId > 0 ? userId : null,
            guestToken,
            guestName,
            guestEmail,
            guestPhone
        ]
    );

    const id = Number(result && result.insertId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    return findById(id);
};

const claimChat = async (chatId, adminId) => {
    const cid = Number(chatId);
    const aid = Number(adminId);
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isFinite(aid) || aid <= 0) {
        return { ok: false, reason: 'bad_id' };
    }

    const [result] = await db.execute(
        `UPDATE support_chats
         SET status = 'assigned',
             assigned_admin_id = ?,
             assigned_at = NOW()
         WHERE id = ?
           AND status = 'open'
           AND assigned_admin_id IS NULL`,
        [aid, cid]
    );

    if (!result || result.affectedRows !== 1) {
        return { ok: false, reason: 'already_taken' };
    }

    return { ok: true, chat: await findById(cid) };
};

const closeChat = async (chatId, adminId) => {
    const cid = Number(chatId);
    const aid = Number(adminId);
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isFinite(aid) || aid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE support_chats
         SET status = 'closed',
             closed_at = NOW(),
             closed_by_admin_id = ?
         WHERE id = ?
           AND status = 'assigned'
           AND assigned_admin_id = ?`,
        [aid, cid, aid]
    );

    return result && result.affectedRows > 0;
};

const listOpen = async () => {
    const [rows] = await db.execute(
        `SELECT c.*,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.email AS user_email,
                (
                    SELECT m.body
                    FROM support_messages m
                    WHERE m.chat_id = c.id AND m.sender_type = 'client'
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_client_message,
                (
                    SELECT m.createdAt
                    FROM support_messages m
                    WHERE m.chat_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message_at,
                (
                    SELECT COUNT(*)
                    FROM support_messages m
                    WHERE m.chat_id = c.id
                      AND m.sender_type = 'client'
                      AND m.id > COALESCE(c.admin_last_read_message_id, 0)
                ) AS unread_count
         FROM support_chats c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.status = 'open'
         ORDER BY c.id DESC`
    );

    return rows || [];
};

const listAssignedToAdmin = async (adminId) => {
    const aid = Number(adminId);
    if (!Number.isFinite(aid) || aid <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT c.*,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.email AS user_email,
                (
                    SELECT m.body
                    FROM support_messages m
                    WHERE m.chat_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT m.createdAt
                    FROM support_messages m
                    WHERE m.chat_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message_at,
                (
                    SELECT COUNT(*)
                    FROM support_messages m
                    WHERE m.chat_id = c.id
                      AND m.sender_type = 'client'
                      AND m.id > COALESCE(c.admin_last_read_message_id, 0)
                ) AS unread_count
         FROM support_chats c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.status = 'assigned'
           AND c.assigned_admin_id = ?
         ORDER BY c.updatedAt DESC`,
        [aid]
    );

    return rows || [];
};

const findLatestClosedForUser = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT * FROM support_chats
         WHERE user_id = ?
           AND status = 'closed'
         ORDER BY id DESC
         LIMIT 1`,
        [uid]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0];
};

const findLatestClosedForGuest = async (guestToken) => {
    const token = trimText(guestToken, 64);
    if (!token) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT * FROM support_chats
         WHERE guest_token = ?
           AND status = 'closed'
         ORDER BY id DESC
         LIMIT 1`,
        [token]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0];
};

const listClosedForUser = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT c.*,
                (
                    SELECT m.body
                    FROM support_messages m
                    WHERE m.chat_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message
         FROM support_chats c
         WHERE c.user_id = ?
           AND c.status = 'closed'
         ORDER BY c.closed_at DESC, c.id DESC`,
        [uid]
    );

    return rows || [];
};

const listClosedForGuest = async (guestToken) => {
    const token = trimText(guestToken, 64);
    if (!token) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT c.*,
                (
                    SELECT m.body
                    FROM support_messages m
                    WHERE m.chat_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message
         FROM support_chats c
         WHERE c.guest_token = ?
           AND c.status = 'closed'
         ORDER BY c.closed_at DESC, c.id DESC`,
        [token]
    );

    return rows || [];
};

const countClosedForUser = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return 0;
    }
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS c FROM support_chats WHERE user_id = ? AND status = 'closed'`,
        [uid]
    );
    return Number(rows[0].c) || 0;
};

const countClosedForGuest = async (guestToken) => {
    const token = trimText(guestToken, 64);
    if (!token) {
        return 0;
    }
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS c FROM support_chats WHERE guest_token = ? AND status = 'closed'`,
        [token]
    );
    return Number(rows[0].c) || 0;
};

const listClosedAll = async () => {
    const [rows] = await db.execute(
        `SELECT c.*,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.email AS user_email,
                a.first_name AS admin_first_name,
                a.last_name AS admin_last_name,
                (
                    SELECT m.body
                    FROM support_messages m
                    WHERE m.chat_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message
         FROM support_chats c
         LEFT JOIN users u ON c.user_id = u.id
         LEFT JOIN users a ON c.assigned_admin_id = a.id
         WHERE c.status = 'closed'
         ORDER BY c.closed_at DESC, c.id DESC`
    );

    return rows || [];
};

const updateClientLastRead = async (chatId, messageId) => {
    const cid = Number(chatId);
    const mid = Number(messageId) || 0;
    if (!Number.isFinite(cid) || cid <= 0) {
        return false;
    }
    const [result] = await db.execute(
        `UPDATE support_chats
         SET client_last_read_message_id = GREATEST(client_last_read_message_id, ?)
         WHERE id = ?`,
        [mid, cid]
    );
    return result && result.affectedRows > 0;
};

const updateAdminLastRead = async (chatId, messageId) => {
    const cid = Number(chatId);
    const mid = Number(messageId) || 0;
    if (!Number.isFinite(cid) || cid <= 0) {
        return false;
    }
    const [result] = await db.execute(
        `UPDATE support_chats
         SET admin_last_read_message_id = GREATEST(admin_last_read_message_id, ?)
         WHERE id = ?`,
        [mid, cid]
    );
    return result && result.affectedRows > 0;
};

const countUnreadForClientUser = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return 0;
    }
    const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
    const [rows] = await db.execute(
        `SELECT id, client_last_read_message_id FROM support_chats
         WHERE user_id = ? AND status IN (${placeholders})
         ORDER BY id DESC LIMIT 1`,
        [uid, ...ACTIVE_STATUSES]
    );
    if (!rows || rows.length === 0) {
        return 0;
    }
    const SupportMessage = require('./SupportMessage');
    return SupportMessage.countUnreadForClient(rows[0].id, rows[0].client_last_read_message_id);
};

const countUnreadForClientGuest = async (guestToken) => {
    const token = trimText(guestToken, 64);
    if (!token) {
        return 0;
    }
    const placeholders = ACTIVE_STATUSES.map(() => '?').join(', ');
    const [rows] = await db.execute(
        `SELECT id, client_last_read_message_id FROM support_chats
         WHERE guest_token = ? AND status IN (${placeholders})
         ORDER BY id DESC LIMIT 1`,
        [token, ...ACTIVE_STATUSES]
    );
    if (!rows || rows.length === 0) {
        return 0;
    }
    const SupportMessage = require('./SupportMessage');
    return SupportMessage.countUnreadForClient(rows[0].id, rows[0].client_last_read_message_id);
};

const countUnreadForAdmin = async (adminId) => {
    const aid = Number(adminId);
    if (!Number.isFinite(aid) || aid <= 0) {
        return 0;
    }
    const [rows] = await db.execute(
        `SELECT id, admin_last_read_message_id FROM support_chats
         WHERE status = 'open'
            OR (status = 'assigned' AND assigned_admin_id = ?)`,
        [aid]
    );
    if (!rows || rows.length === 0) {
        return 0;
    }
    const SupportMessage = require('./SupportMessage');
    let total = 0;
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        total += await SupportMessage.countUnreadForAdmin(row.id, row.admin_last_read_message_id);
    }
    return total;
};

const countOpen = async () => {
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS c FROM support_chats WHERE status = 'open'`
    );
    return Number(rows[0].c) || 0;
};

module.exports = {
    ACTIVE_STATUSES,
    findById,
    findActiveForUser,
    findActiveForGuest,
    findLatestClosedForUser,
    findLatestClosedForGuest,
    listClosedForUser,
    listClosedForGuest,
    countClosedForUser,
    countClosedForGuest,
    listClosedAll,
    updateClientLastRead,
    updateAdminLastRead,
    countUnreadForClientUser,
    countUnreadForClientGuest,
    countUnreadForAdmin,
    createChat,
    claimChat,
    closeChat,
    listOpen,
    listAssignedToAdmin,
    countOpen
};
