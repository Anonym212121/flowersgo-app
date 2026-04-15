const db = require('../config/db');

const listVisibleByProductId = async (productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT r.id, r.rating, r.comment, r.\`createdAt\`,
                u.first_name, u.last_name
         FROM reviews r
         INNER JOIN users u ON r.user_id = u.id
         WHERE r.product_id = ? AND r.is_visible = 1
         ORDER BY r.id DESC`,
        [id]
    );

    return rows;
};

const create = async ({ user_id, product_id, order_id, rating, comment }) => {
    const uid = Number(user_id);
    const pid = Number(product_id);
    if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(pid) || pid <= 0) {
        return false;
    }

    const text = typeof comment === 'string' ? comment.trim() : '';
    if (text.length < 2 || text.length > 2000) {
        return false;
    }

    let orderId = null;
    if (order_id != null && order_id !== '') {
        const o = Number(order_id);
        if (Number.isFinite(o) && o > 0) {
            orderId = o;
        }
    }

    let ratingVal = null;
    if (rating !== undefined && rating !== null && rating !== '') {
        const r = Number(rating);
        if (Number.isFinite(r) && r >= 1 && r <= 5) {
            ratingVal = Math.round(r);
        }
    }

    const [result] = await db.execute(
        `INSERT INTO reviews (user_id, product_id, order_id, rating, comment, is_visible)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [uid, pid, orderId, ratingVal, text]
    );

    return result.insertId > 0;
};

const approveById = async (reviewId) => {
    const id = Number(reviewId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const [result] = await db.execute(
        'UPDATE reviews SET is_visible = 1 WHERE id = ?',
        [id]
    );

    return result.affectedRows > 0;
};

const deleteById = async (reviewId) => {
    const id = Number(reviewId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const [result] = await db.execute('DELETE FROM reviews WHERE id = ?', [id]);

    return result.affectedRows > 0;
};

module.exports = {
    listVisibleByProductId,
    create,
    approveById,
    deleteById
};
