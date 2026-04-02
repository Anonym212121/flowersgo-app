const db = require('../config/db');

const splitSearchWords = (raw) => {
    if (!raw || typeof raw !== 'string') {
        return [];
    }
    return raw
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .slice(0, 8);
};

const allProducts = async (categoryId = null, searchText = '') => {
    const words = splitSearchWords(searchText);

    let sql = `SELECT
            p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
            p.stock_quantity, p.image_url, p.average_rating,
            c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         LEFT JOIN categories parent_cat ON c.parent_id = parent_cat.id
         WHERE p.is_active = 1`;

    const params = [];
    if (categoryId) {
        sql += ' AND (c.id = ? OR c.parent_id = ?)';
        params.push(categoryId, categoryId);
    }

    for (const word of words) {
        const like = `%${word}%`;

        const [subRows] = await db.execute(
            `SELECT id FROM categories WHERE parent_id IS NOT NULL AND LOWER(name) LIKE ?`,
            [like]
        );
        const subCategoryIds = subRows.map((row) => row.id);

        if (subCategoryIds.length > 0) {
            const inPlaceholders = subCategoryIds.map(() => '?').join(', ');
            sql += ` AND (
                LOWER(p.name) LIKE ?
                OR LOWER(IFNULL(p.description, '')) LIKE ?
                OR LOWER(IFNULL(p.slug, '')) LIKE ?
                OR p.category_id IN (${inPlaceholders})
            )`;
            params.push(like, like, like, ...subCategoryIds);
        } else {
            sql += ' AND (LOWER(p.name) LIKE ? OR LOWER(IFNULL(p.description, \'\')) LIKE ? OR LOWER(IFNULL(p.slug, \'\')) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(IFNULL(parent_cat.name, \'\')) LIKE ?)';
            params.push(like, like, like, like, like);
        }
    } 
    

    sql += ' ORDER BY p.id DESC';

    const [rows] = await db.execute(sql, params);
    return rows;
};
module.exports = {
    allProducts
};

