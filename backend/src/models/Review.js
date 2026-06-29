const db = require('../config/db');
const ProductModel = require('./Product');

const listVisibleByProductId = async (productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT r.id, r.rating, r.comment, r.\`createdAt\`,
                u.first_name, u.last_name, u.avatar_url
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
    if (ratingVal == null) {
        return false;
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

const findMetaById = async (reviewId) => {
    const id = Number(reviewId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        'SELECT id, product_id, is_visible, rating FROM reviews WHERE id = ? LIMIT 1',
        [id]
    );

    return rows[0] || null;
};

const syncAverageForProduct = async (productId) => {
    const pid = Number(productId);
    if (!Number.isFinite(pid) || pid <= 0) {
        return false;
    }

    const [rows] = await db.execute(
        `SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count
         FROM reviews
         WHERE product_id = ? AND is_visible = 1 AND rating IS NOT NULL`,
        [pid]
    );

    const count = Number(rows[0]?.review_count) || 0;
    let average = null;
    if (count > 0 && rows[0].avg_rating != null) {
        average = Math.round(Number(rows[0].avg_rating) * 10) / 10;
    }

    return ProductModel.updateAverageRating(pid, average);
};

const listPendingForAdmin = async () => {
    const [rows] = await db.execute(
        `SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.\`createdAt\`,
                u.first_name, u.last_name,
                p.name AS product_name
         FROM reviews r
         INNER JOIN users u ON r.user_id = u.id
         INNER JOIN products p ON r.product_id = p.id
         WHERE r.is_visible = 0
         ORDER BY r.id DESC`
    );

    return rows;
};

const listByUserId = async (userId) => {
    const uid = Number(userId);
    if (!uid || uid <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT r.id, r.product_id, r.rating, r.comment, r.is_visible, r.\`createdAt\`,
                p.name AS product_name,
                rr.id AS pending_request_id,
                rr.request_type AS pending_request_type,
                rr.new_rating AS pending_new_rating,
                rr.new_comment AS pending_new_comment
         FROM reviews r
         INNER JOIN products p ON r.product_id = p.id
         LEFT JOIN review_requests rr ON rr.review_id = r.id
         WHERE r.user_id = ?
         ORDER BY r.id DESC`,
        [uid]
    );

    return rows;
};

const belongsToUser = async (reviewId, userId) => {
    const rid = Number(reviewId);
    const uid = Number(userId);
    if (!rid || rid <= 0 || !uid || uid <= 0) {
        return false;
    }

    const [rows] = await db.execute(
        'SELECT id FROM reviews WHERE id = ? AND user_id = ? LIMIT 1',
        [rid, uid]
    );

    return rows && rows.length > 0;
};

const hasPendingRequest = async (reviewId) => {
    const rid = Number(reviewId);
    if (!rid || rid <= 0) {
        return false;
    }

    const [rows] = await db.execute(
        'SELECT id FROM review_requests WHERE review_id = ? LIMIT 1',
        [rid]
    );

    return rows && rows.length > 0;
};

const createChangeRequest = async (payload) => {
    const review_id = Number(payload.review_id);
    const user_id = Number(payload.user_id);
    const request_type = payload.request_type === 'delete' ? 'delete' : 'edit';

    if (!review_id || review_id <= 0 || !user_id || user_id <= 0) {
        return false;
    }

    const ownerOk = await belongsToUser(review_id, user_id);
    if (!ownerOk) {
        return false;
    }

    const already = await hasPendingRequest(review_id);
    if (already) {
        return 'pending';
    }

    let new_rating = null;
    let new_comment = null;

    if (request_type === 'edit') {
        const text = typeof payload.new_comment === 'string' ? payload.new_comment.trim() : '';
        if (text.length < 2 || text.length > 2000) {
            return false;
        }
        const r = Number(payload.new_rating);
        if (!r || r < 1 || r > 5) {
            return false;
        }
        new_rating = Math.round(r);
        new_comment = text;
    }

    const [result] = await db.execute(
        `INSERT INTO review_requests (review_id, user_id, request_type, new_rating, new_comment)
         VALUES (?, ?, ?, ?, ?)`,
        [review_id, user_id, request_type, new_rating, new_comment]
    );

    return result && result.insertId > 0;
};

const listChangeRequestsForAdmin = async () => {
    const [rows] = await db.execute(
        `SELECT rr.id AS request_id, rr.request_type, rr.new_rating, rr.new_comment,
                rr.\`createdAt\` AS request_at,
                r.id AS review_id, r.rating, r.comment, r.is_visible,
                u.first_name, u.last_name,
                p.name AS product_name
         FROM review_requests rr
         INNER JOIN reviews r ON rr.review_id = r.id
         INNER JOIN users u ON rr.user_id = u.id
         INNER JOIN products p ON r.product_id = p.id
         ORDER BY rr.id DESC`
    );

    return rows;
};

const findRequestById = async (requestId) => {
    const id = Number(requestId);
    if (!id || id <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT rr.id, rr.review_id, rr.user_id, rr.request_type, rr.new_rating, rr.new_comment,
                r.product_id, r.is_visible, r.rating AS old_rating, r.comment AS old_comment
         FROM review_requests rr
         INNER JOIN reviews r ON rr.review_id = r.id
         WHERE rr.id = ?
         LIMIT 1`,
        [id]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const rejectRequestById = async (requestId) => {
    const id = Number(requestId);
    if (!id || id <= 0) {
        return false;
    }

    const [result] = await db.execute('DELETE FROM review_requests WHERE id = ?', [id]);
    return result && result.affectedRows > 0;
};

const applyEditRequestById = async (requestId) => {
    const row = await findRequestById(requestId);
    if (!row || row.request_type !== 'edit') {
        return false;
    }

    const text = typeof row.new_comment === 'string' ? row.new_comment.trim() : '';
    const rating = Number(row.new_rating);
    if (!rating || rating < 1 || rating > 5 || text.length < 2) {
        return false;
    }

    const [upd] = await db.execute(
        'UPDATE reviews SET rating = ?, comment = ? WHERE id = ?',
        [rating, text, row.review_id]
    );
    if (!upd || upd.affectedRows <= 0) {
        return false;
    }

    await db.execute('DELETE FROM review_requests WHERE id = ?', [requestId]);

    if (Number(row.is_visible) === 1) {
        await syncAverageForProduct(row.product_id);
    }

    return true;
};

const applyDeleteRequestById = async (requestId) => {
    const row = await findRequestById(requestId);
    if (!row || row.request_type !== 'delete') {
        return false;
    }

    const wasVisible = Number(row.is_visible) === 1;
    const productId = row.product_id;

    await db.execute('DELETE FROM review_requests WHERE id = ?', [requestId]);
    const [del] = await db.execute('DELETE FROM reviews WHERE id = ?', [row.review_id]);
    if (!del || del.affectedRows <= 0) {
        return false;
    }

    if (wasVisible) {
        await syncAverageForProduct(productId);
    }

    return true;
};

module.exports = {
    listVisibleByProductId,
    create,
    approveById,
    deleteById,
    findMetaById,
    syncAverageForProduct,
    listPendingForAdmin,
    listByUserId,
    belongsToUser,
    createChangeRequest,
    listChangeRequestsForAdmin,
    findRequestById,
    rejectRequestById,
    applyEditRequestById,
    applyDeleteRequestById
};
