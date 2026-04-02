const db = require('../config/db');
const allProducts = async (categoryId = null) => {
    if (!categoryId) {
    const [rows] = await db.execute(
            `SELECT
                p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
                p.stock_quantity, p.image_url, p.average_rating,
                c.name AS category_name
              FROM products p
             INNER JOIN categories c ON p.category_id = c.id
             WHERE p.is_active = 1
             ORDER  BY p.id DESC`
        );
          return rows;
    }
    const [rows] = await db.execute(
        `SELECT
            p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
            p.stock_quantity, p.image_url, p.average_rating,
            c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND (c.id = ? OR c.parent_id = ?)
         ORDER BY p.id DESC`,
        [categoryId, categoryId]
    );

    return rows;
};
module.exports = {
    allProducts




};
