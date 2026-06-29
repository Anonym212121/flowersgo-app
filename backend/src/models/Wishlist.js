const db = require('../config/db');
const add = async (userId, productId) => {
    await db.execute(
        'INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)',
        [userId, productId]
    );
};

const addMany = async (userId, productIds = []) => {
    for (const productId of productIds) {
        await db.execute(
            'INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)',
            [userId, productId]
        );
    }
};

const remove = async (userId, productId) => {
    await db.execute(
        'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
            [userId, productId]
    );
};





const listForUser = async (userId) => {
       const [rows] = await db.execute(
        `SELECT
            p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
            p.stock_quantity, p.image_url, p.average_rating,
            c.name AS category_name
        FROM wishlist w
         INNER JOIN products p ON p.id = w.product_id
         INNER JOIN categories c ON p.category_id = c.id
         WHERE w.user_id = ? AND p.is_active = 1
         ORDER BY w.id DESC`,
        [userId]
    );
    return rows;
};

const productIdsForUser = async (userId) => {
    const [rows] = await db.execute(
        'SELECT product_id FROM wishlist WHERE user_id = ?',
        [userId]
    );
    return rows.map((r) => Number(r.product_id));
};

const countForUser = async (userId) => {
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS cnt
         FROM wishlist w
         INNER JOIN products p ON p.id = w.product_id
         WHERE w.user_id = ? AND p.is_active = 1`,
        [userId]
    );
    return Number(rows[0] && rows[0].cnt ? rows[0].cnt : 0);
};

module.exports = {
    add,
    addMany,
    remove,
    listForUser,
    productIdsForUser,
    countForUser
};