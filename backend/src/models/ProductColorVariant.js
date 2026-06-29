const db = require('../config/db');

const normalizeFlowerColor = (raw) => {
    if (typeof raw !== 'string') {
        return null;
    }
    const value = raw.trim();
    if (!value) {
        return null;
    }
    return value.slice(0, 50);
};

const normalizeColorHex = (raw) => {
    if (typeof raw !== 'string') {
        return null;
    }
    const value = raw.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        return value.toLowerCase();
    }
    return null;
};

const listByProductId = async (productId) => {
    const pid = Number(productId);
    if (!Number.isFinite(pid) || pid <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT id, product_id, flower_color, color_hex, image_url, stock_quantity, is_active, sort_order
         FROM product_color_variants
         WHERE product_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [pid]
    );
    return rows || [];
};

const listByProductIds = async (productIds) => {
    const ids = (productIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) {
        return [];
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await db.execute(
        `SELECT id, product_id, flower_color, color_hex, image_url, stock_quantity, is_active, sort_order
         FROM product_color_variants
         WHERE product_id IN (${placeholders}) AND is_active = 1
         ORDER BY product_id ASC, sort_order ASC, id ASC`,
        ids
    );
    return rows || [];
};

const findById = async (variantId) => {
    const id = Number(variantId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT v.*, p.name AS product_name, p.sale_price, p.is_constructor, c.name AS category_name
         FROM product_color_variants v
         INNER JOIN products p ON p.id = v.product_id
         INNER JOIN categories c ON c.id = p.category_id
         WHERE v.id = ?
         LIMIT 1`,
        [id]
    );
    return rows && rows.length > 0 ? rows[0] : null;
};

const create = async (productId, payload) => {
    const pid = Number(productId);
    if (!Number.isFinite(pid) || pid <= 0) {
        return null;
    }

    const flower_color = normalizeFlowerColor(payload && payload.flower_color);
    if (!flower_color) {
        return null;
    }

    const color_hex = normalizeColorHex(payload && payload.color_hex) || '#94a3b8';
    const stockRaw = Number(payload && payload.stock_quantity);
    const stock_quantity = Number.isFinite(stockRaw) && stockRaw >= 0 ? Math.floor(stockRaw) : 0;

    let is_active = 1;
    if (payload.is_active === 0 || payload.is_active === '0' || payload.is_active === false) {
        is_active = 0;
    }

    const [sortRows] = await db.execute(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM product_color_variants WHERE product_id = ?',
        [pid]
    );
    const sort_order = Number(sortRows[0].n);

    const [result] = await db.execute(
        `INSERT INTO product_color_variants
            (product_id, flower_color, color_hex, stock_quantity, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pid, flower_color, color_hex, stock_quantity, is_active, sort_order]
    );

    return result && result.insertId ? Number(result.insertId) : null;
};

const updateById = async (variantId, payload) => {
    const id = Number(variantId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const current = await findById(id);
    if (!current) {
        return false;
    }

    const flower_color =
        payload && payload.flower_color !== undefined
            ? normalizeFlowerColor(payload.flower_color)
            : current.flower_color;
    if (!flower_color) {
        return false;
    }

    let color_hex = current.color_hex;
    if (payload && payload.color_hex !== undefined) {
        color_hex = normalizeColorHex(payload.color_hex) || current.color_hex;
    }

    let stock_quantity = Number(current.stock_quantity || 0);
    if (payload && payload.stock_quantity !== undefined && payload.stock_quantity !== '') {
        const stockRaw = Number(payload.stock_quantity);
        if (Number.isFinite(stockRaw) && stockRaw >= 0) {
            stock_quantity = Math.floor(stockRaw);
        }
    }

    let is_active = Number(current.is_active) === 0 ? 0 : 1;
    if (payload.is_active === 0 || payload.is_active === '0' || payload.is_active === false) {
        is_active = 0;
    } else if (payload.is_active === 1 || payload.is_active === '1' || payload.is_active === true) {
        is_active = 1;
    }

    const [result] = await db.execute(
        `UPDATE product_color_variants
         SET flower_color = ?, color_hex = ?, stock_quantity = ?, is_active = ?
         WHERE id = ?`,
        [flower_color, color_hex, stock_quantity, is_active, id]
    );

    return result && result.affectedRows > 0;
};

const updateImageUrl = async (variantId, imageUrl) => {
    const id = Number(variantId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const url = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    if (!url) {
        return false;
    }

    const [result] = await db.execute(
        'UPDATE product_color_variants SET image_url = ? WHERE id = ?',
        [url, id]
    );
    return result && result.affectedRows > 0;
};

const deleteById = async (variantId) => {
    const id = Number(variantId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const [result] = await db.execute('DELETE FROM product_color_variants WHERE id = ?', [id]);
    return result && result.affectedRows > 0;
};

const deductStock = async (conn, variantId, quantity) => {
    const id = Number(variantId);
    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(qty) || qty <= 0) {
        return false;
    }

    const [result] = await conn.execute(
        `UPDATE product_color_variants
         SET stock_quantity = stock_quantity - ?
         WHERE id = ? AND stock_quantity >= ?`,
        [qty, id, qty]
    );
    return result && result.affectedRows > 0;
};

const restoreStock = async (conn, variantId, quantity) => {
    const id = Number(variantId);
    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(qty) || qty <= 0) {
        return false;
    }

    await conn.execute(
        'UPDATE product_color_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [qty, id]
    );
    return true;
};

module.exports = {
    listByProductId,
    listByProductIds,
    findById,
    create,
    updateById,
    updateImageUrl,
    deleteById,
    deductStock,
    restoreStock
};
