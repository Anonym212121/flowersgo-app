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

module.exports = {
    listVisibleByProductId
};
