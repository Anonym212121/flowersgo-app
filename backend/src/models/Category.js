const db = require('../config/db');

const allCategories = async () => {
    const [rows] = await db.execute(
        `SELECT id, name, parent_id, image_url, sort_order, IFNULL(is_packaging, 0) AS is_packaging
         FROM categories
         ORDER BY parent_id IS NULL DESC, parent_id ASC, sort_order ASC, name ASC`
    );

    return rows;
};

const nextSortOrder = async (parentId) => {
    if (parentId == null) {
        const [rows] = await db.execute(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories WHERE parent_id IS NULL'
        );
        return Number(rows[0].n);
    }

    const [rows] = await db.execute(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories WHERE parent_id = ?',
        [parentId]
    );
    return Number(rows[0].n);
};

const create = async ({ name, parent_id, is_packaging }) => {
    const label = typeof name === 'string' ? name.trim() : '';
    if (!label) {
        return null;
    }

    let parentId = null;
    if (parent_id != null && parent_id !== '') {
        const pid = Number(parent_id);
        if (Number.isFinite(pid) && pid > 0) {
            parentId = pid;
        }
    }

    let packagingFlag = 0;
    if (parentId == null && (is_packaging === 1 || is_packaging === '1' || is_packaging === true)) {
        packagingFlag = 1;
    }

    const sortOrder = await nextSortOrder(parentId);

    const [result] = await db.execute(
        'INSERT INTO categories (name, parent_id, sort_order, is_packaging) VALUES (?, ?, ?, ?)',
        [label, parentId, sortOrder, packagingFlag]
    );

    const id = Number(result && result.insertId);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    return id;
};

const updateById = async (id, { name, parent_id, is_packaging }) => {
    const cid = Number(id);
    if (!Number.isFinite(cid) || cid <= 0) {
        return false;
    }

    const label = typeof name === 'string' ? name.trim() : '';
    if (!label) {
        return false;
    }

    let parentId = null;
    if (parent_id != null && parent_id !== '') {
        const pid = Number(parent_id);
        if (Number.isFinite(pid) && pid > 0 && pid !== cid) {
            parentId = pid;
        }
    }

    let packagingFlag = 0;
    if (parentId == null && (is_packaging === 1 || is_packaging === '1' || is_packaging === true)) {
        packagingFlag = 1;
    }

    const [result] = await db.execute(
        'UPDATE categories SET name = ?, parent_id = ?, is_packaging = ? WHERE id = ?',
        [label, parentId, packagingFlag, cid]
    );

    return result && result.affectedRows > 0;
};

const updateImageUrl = async (categoryId, imageUrl) => {
    const cid = Number(categoryId);
    if (!Number.isFinite(cid) || cid <= 0) {
        return false;
    }

    const url = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    if (!url) {
        return false;
    }

    const [result] = await db.execute(
        'UPDATE categories SET image_url = ? WHERE id = ?',
        [url, cid]
    );

    return result.affectedRows > 0;
};

const moveSort = async (id, direction) => {
    const cid = Number(id);
    if (!Number.isFinite(cid) || cid <= 0) {
        return false;
    }
    if (direction !== 'up' && direction !== 'down') {
        return false;
    }

    const [currentRows] = await db.execute(
        'SELECT id, parent_id, sort_order FROM categories WHERE id = ?',
        [cid]
    );
    if (!currentRows || currentRows.length === 0) {
        return false;
    }

    const current = currentRows[0];
    let siblings = [];

    if (current.parent_id == null) {
        const [rows] = await db.execute(
            'SELECT id, sort_order FROM categories WHERE parent_id IS NULL ORDER BY sort_order ASC, id ASC'
        );
        siblings = rows;
    } else {
        const [rows] = await db.execute(
            'SELECT id, sort_order FROM categories WHERE parent_id = ? ORDER BY sort_order ASC, id ASC',
            [current.parent_id]
        );
        siblings = rows;
    }

    let index = -1;
    for (let i = 0; i < siblings.length; i += 1) {
        if (Number(siblings[i].id) === cid) {
            index = i;
            break;
        }
    }
    if (index === -1) {
        return false;
    }

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= siblings.length) {
        return false;
    }

    const ids = [];
    for (let i = 0; i < siblings.length; i += 1) {
        ids.push(Number(siblings[i].id));
    }
    const tmp = ids[index];
    ids[index] = ids[swapIndex];
    ids[swapIndex] = tmp;

    for (let i = 0; i < ids.length; i += 1) {
        await db.execute('UPDATE categories SET sort_order = ? WHERE id = ?', [i, ids[i]]);
    }

    return true;
};

const deleteById = async (id) => {
    const cid = Number(id);
    if (!Number.isFinite(cid) || cid <= 0) {
        return false;
    }

    const [childRows] = await db.execute(
        'SELECT id FROM categories WHERE parent_id = ? LIMIT 1',
        [cid]
    );
    if (childRows && childRows.length > 0) {
        return false;
    }

    const [productRows] = await db.execute(
        'SELECT id FROM products WHERE category_id = ? LIMIT 1',
        [cid]
    );
    if (productRows && productRows.length > 0) {
        return false;
    }

    const [result] = await db.execute('DELETE FROM categories WHERE id = ?', [cid]);
    return result && result.affectedRows > 0;
};

module.exports = {
    allCategories,
    create,
    updateById,
    updateImageUrl,
    moveSort,
    deleteById
};
