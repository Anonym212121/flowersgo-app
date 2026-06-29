const db = require('../config/db');

const insert = async ({ order_id, user_id, from_status_id, to_status_id }) => {
    const oid = Number(order_id);
    const fromId = Number(from_status_id);
    const toId = Number(to_status_id);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }
    if (!Number.isFinite(fromId) || fromId <= 0 || !Number.isFinite(toId) || toId <= 0) {
        return false;
    }
    if (fromId === toId) {
        return false;
    }

    let uid = null;
    const rawUser = Number(user_id);
    if (Number.isFinite(rawUser) && rawUser > 0) {
        uid = rawUser;
    }

    const [result] = await db.execute(
        `INSERT INTO order_status_log (order_id, user_id, from_status_id, to_status_id)
         VALUES (?, ?, ?, ?)`,
        [oid, uid, fromId, toId]
    );

    return result && result.affectedRows > 0;
};

const listByOrderId = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT l.id,
                l.createdAt,
                l.from_status_id,
                l.to_status_id,
                fs.label_uk AS from_label,
                fs.status_name AS from_name,
                ts.label_uk AS to_label,
                ts.status_name AS to_name,
                u.first_name,
                u.last_name,
                u.email
         FROM order_status_log l
         INNER JOIN statuses fs ON l.from_status_id = fs.id
         INNER JOIN statuses ts ON l.to_status_id = ts.id
         LEFT JOIN users u ON l.user_id = u.id
         WHERE l.order_id = ?
         ORDER BY l.id DESC`,
        [oid]
    );

    return rows || [];
};

module.exports = {
    insert,
    listByOrderId
};
