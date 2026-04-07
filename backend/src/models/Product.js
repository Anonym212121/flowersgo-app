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

const updateImageUrl = async (productId, imageUrl) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const url = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    if (!url) {
        return false;
    }

    const [result] = await db.execute(
        'UPDATE products SET image_url = ? WHERE id = ?',
        [url, id]
    );

    return result.affectedRows > 0;
};
const findById = async (productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

     const [rows] = await db.execute(
        `SELECT
            p.id, p.category_id, p.name, p.slug, p.description,
            p.base_price, p.sale_price, p.stock_quantity, p.image_url,
            p.average_rating, p.is_active, p.unit_type,
        c.name AS category_name
FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?
          LIMIT 1`,
        [id]
    );

    return rows[0] || null;
};
const updateById = async (productId, payload) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const category_id = Number(payload.category_id);
    if (!Number.isFinite(category_id) || category_id <= 0) {
        return false;
    }

    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
        return false;
    }
    let slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
    if (!slug) {
        slug = name;
    }

    const descriptionRaw = payload.description;
    const description =
        typeof descriptionRaw === 'string' && descriptionRaw.trim() !== ''
            ? descriptionRaw.trim()
            : null;
    const base_price = Number(payload.base_price);
    const sale_price = Number(payload.sale_price);
    if (!Number.isFinite(base_price) || base_price < 0) {
        return false;
    }
    if (!Number.isFinite(sale_price) || sale_price < 0) {
        return false;
    }





    const stock_quantity = Number(payload.stock_quantity);
    if (!Number.isFinite(stock_quantity) || stock_quantity < 0) {
        return false;
    }
    const unitRaw = payload.unit_type;
    const unit_type =
        typeof unitRaw === 'string' && unitRaw.trim() !== '' ? unitRaw.trim() : 'шт';

    let is_active = 1;
    if (
        payload.is_active === false ||
        payload.is_active === 0 ||
        payload.is_active === '0'
    ) {
        is_active = 0;
    }

    const [result] = await db.execute(
        `UPDATE products SET
            category_id = ?, name = ?, slug = ?, description = ?,
             base_price = ?, sale_price = ?, stock_quantity = ?,
        unit_type = ?, is_active = ?
         WHERE id = ?`,
        [
            category_id,
            name,
            slug,
            description,
            base_price,
            sale_price,
            stock_quantity,
            unit_type,
            is_active,
            id
        ]
    );

    return result.affectedRows > 0;
};
const create = async (payload) => {
    const category_id = Number(payload.category_id);
    if (!Number.isFinite(category_id) || category_id <= 0) {
        return false;
    }
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
        return false;
    }
    let sku = typeof payload.sku === 'string' ? payload.sku.trim() : '';
    if(sku === ''){
        sku = null;
    } 
    let slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
    if(slug === ''){
        slug = null;
    }        
    const descriptionRaw = payload.description;
    const description =
        typeof descriptionRaw === 'string' && descriptionRaw.trim() !== ''
            ? descriptionRaw.trim() : null;
    const base_price = Number(payload.base_price);
    const sale_price = Number(payload.sale_price);
    if (!Number.isFinite(base_price) || base_price < 0) {
        return null;
    }
    if (!Number.isFinite(sale_price) || sale_price < 0) {
        return null;
    }
    if (!Number.isFinite(sale_price) || sale_price < 0) {
        return null;
    }
    const stock_quantity = Number(payload.stock_quantity);
    const sq = Number.isFinite(stock_quantity) && stock_quantity >= 0 ? stock_quantity : 0;
    const unitRaw = payload.unit_type;
    const unit_type =
        typeof unitRaw === 'string' && unitRaw.trim() !== '' ? unitRaw.trim() : 'шт';
    let is_active = 1;
    if (
        payload.is_active === false ||
        payload.is_active === 0 ||
        payload.is_active === '0'
    ) {
        is_active = 0;
    }
    try {
        const [result] = await db.execute(
            `INSERT INTO products (
                category_id, sku, name, slug, description,
                base_price, sale_price, stock_quantity, unit_type, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                category_id,
                sku,
                name,
                slug,
                description,
                base_price,
                sale_price,
                sq,
                unit_type,
                is_active
            ]
        );
        return result.insertId;
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            throw new Error('помилка');
        }
        throw err;
    }

};
const allForAdmin = async () => {
    const [rows] = await db.execute(
        `SELECT
            p.id, p.category_id, p.sku, p.name, p.slug,
            p.base_price, p.sale_price, p.stock_quantity,
            p.is_active, p.image_url,
            c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         ORDER BY p.id DESC`
    );
    return rows;
};
module.exports = {
    allProducts,
    productsByIds,
    updateImageUrl,
    findById,
    updateById,
    create,
    allForAdmin
};