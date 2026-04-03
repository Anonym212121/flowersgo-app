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

const categoryIdsForSearchWord = async (likeParam) => {
    const [subRows] = await db.execute(
        `SELECT id FROM categories WHERE parent_id IS NOT NULL AND LOWER(name) LIKE ?`,
        [likeParam]
    );
    const subIds = subRows.map((row) => row.id);
    if (subIds.length > 0) {
        return subIds;
    }

    const [parentRows] = await db.execute(
        `SELECT id FROM categories WHERE parent_id IS NULL AND LOWER(name) LIKE ?`,
        [likeParam]
    );
    const underParent = new Set();
    for (const row of parentRows) {
        const [childRows] = await db.execute(
            `SELECT id FROM categories WHERE id = ? OR parent_id = ?`,
            [row.id, row.id]
        );
        for (const c of childRows) {
            underParent.add(c.id);
        }
    }
    if (underParent.size > 0) {
        return Array.from(underParent);
    }

    const [textRows] = await db.execute(
        `SELECT DISTINCT category_id FROM products
         WHERE is_active = 1 AND (
             LOWER(name) LIKE ?
             OR LOWER(IFNULL(description, '')) LIKE ?
             OR LOWER(IFNULL(slug, '')) LIKE ?
         )`,
        [likeParam, likeParam, likeParam]
    );
    const fromProducts = textRows
        .map((row) => row.category_id)
        .filter((id) => id != null);
    return [...new Set(fromProducts)];
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
        const ids = await categoryIdsForSearchWord(like);

        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(', ');
            sql += ` AND (
                p.category_id IN (${placeholders})
                OR LOWER(p.name) LIKE ?
                OR LOWER(IFNULL(p.description, '')) LIKE ?
                OR LOWER(IFNULL(p.slug, '')) LIKE ?
            )`;
            params.push(...ids, like, like, like);
        } else {
            sql += ` AND (
                LOWER(p.name) LIKE ?
                OR LOWER(IFNULL(p.description, '')) LIKE ?
                OR LOWER(IFNULL(p.slug, '')) LIKE ?
            )`;
            params.push(like, like, like);
        }
    }

    sql += ' ORDER BY p.id DESC';

    const [rows] = await db.execute(sql, params);
    return rows;
};

const productsByIds = async (ids = []) => {
    const clean = ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);

    if (clean.length === 0) {
        return [];
    }

    const placeholders = clean.map(() => '?').join(', ');
    const [rows] = await db.execute(
        `SELECT
            p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
            p.stock_quantity, p.image_url, p.average_rating,
            c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND p.id IN (${placeholders})
         ORDER BY p.id DESC`,
        clean
    );
    return rows;
};

module.exports = {
    allProducts,
    productsByIds
};