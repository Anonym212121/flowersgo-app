const db = require('../config/db');

const cyrillicToLatin = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ё: 'e', ж: 'zh', з: 'z',
    и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '',
    ъ: '', ы: 'y', э: 'e', ю: 'iu', я: 'ia'
};

const slugFromName = (raw) => {
    const s = String(raw || '').trim().toLowerCase();
    let out = '';
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        if (cyrillicToLatin[ch]) {
            out += cyrillicToLatin[ch];
        } else if (/[a-z0-9]/.test(ch)) {
            out += ch;
        } else if (ch === ' ' || ch === '-' || ch === '_') {
            out += '-';
        }
    }
    out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return out || 'tovar';
};

const ensureUniqueSlug = async (base, excludeId) => {
    let candidate = base;
    let n = 0;
    while (n < 50) {
        let sql = 'SELECT id FROM products WHERE slug = ? LIMIT 1';
        const params = [candidate];
        if (excludeId != null) {
            sql = 'SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1';
            params.push(excludeId);
        }
        const [rows] = await db.execute(sql, params);
        if (rows.length === 0) {
            return candidate;
        }
        n += 1;
        candidate = `${base}-${n}`;
    }
    return `${base}-${Date.now().toString(36)}`;
};

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

const allProducts = async (categoryId = null, searchText = '', excludeIds = []) => {
    const words = splitSearchWords(searchText);

    let sql = `SELECT
            p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
            p.stock_quantity, p.image_url, p.average_rating, p.unit_type,
            c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         LEFT JOIN categories parent_cat ON c.parent_id = parent_cat.id
         WHERE p.is_active = 1 AND IFNULL(p.is_constructor, 0) = 0
           AND IFNULL(c.is_packaging, 0) = 0`;

    const params = [];

    const skipIds = Array.isArray(excludeIds)
        ? excludeIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : [];
    if (skipIds.length > 0) {
        sql += ` AND p.id NOT IN (${skipIds.map(() => '?').join(', ')})`;
        params.push(...skipIds);
    }

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

const listHitProducts = async (limit = 8) => {
    const take = Number(limit);
    const safeLimit = Number.isFinite(take) && take > 0 ? Math.min(Math.floor(take), 20) : 8;

    const [rows] = await db.execute(
        `SELECT
            p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
            p.stock_quantity, p.image_url, p.average_rating, p.unit_type,
            c.name AS category_name,
            stats.orders_count
         FROM (
            SELECT oi.product_id, SUM(oi.quantity) AS orders_count
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            INNER JOIN statuses s ON o.status_id = s.id
            WHERE s.status_name NOT IN ('cancelled')
            GROUP BY oi.product_id
            HAVING orders_count > 0
            ORDER BY orders_count DESC
            LIMIT ${safeLimit}
         ) stats
         INNER JOIN products p ON p.id = stats.product_id
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND IFNULL(p.is_constructor, 0) = 0
           AND IFNULL(c.is_packaging, 0) = 0
         ORDER BY stats.orders_count DESC, p.id DESC`
    );
    return rows || [];
};

const normalizeExcludeIds = (excludeIds) => {
    if (!Array.isArray(excludeIds)) {
        return [];
    }
    return excludeIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
};

const appendExcludeSql = (excludeIds, params) => {
    const skipIds = normalizeExcludeIds(excludeIds);
    if (skipIds.length === 0) {
        return '';
    }
    params.push(...skipIds);
    return ` AND p.id NOT IN (${skipIds.map(() => '?').join(', ')})`;
};

const catalogProductFields = `
            p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
            p.stock_quantity, p.image_url, p.average_rating, p.unit_type,
            c.name AS category_name`;

const listDiscountProducts = async (limit = 8, excludeIds = []) => {
    const take = Number(limit);
    const safeLimit = Number.isFinite(take) && take > 0 ? Math.min(Math.floor(take), 20) : 8;
    const params = [];
    let sql = `SELECT ${catalogProductFields}
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND IFNULL(p.is_constructor, 0) = 0
           AND IFNULL(c.is_packaging, 0) = 0
           AND p.base_price > 0
           AND p.sale_price > 0
           AND p.sale_price < p.base_price`;
    sql += appendExcludeSql(excludeIds, params);
    sql += ` ORDER BY ((p.base_price - p.sale_price) / p.base_price) DESC, p.id DESC
         LIMIT ${safeLimit}`;

    const [rows] = await db.execute(sql, params);
    return rows || [];
};

const listProductsForCategory = async (categoryId, limit = 8, excludeIds = []) => {
    const cid = Number(categoryId);
    const take = Number(limit);
    const safeLimit = Number.isFinite(take) && take > 0 ? Math.min(Math.floor(take), 20) : 8;
    if (!Number.isFinite(cid) || cid <= 0) {
        return [];
    }

    const params = [cid, cid];
    let sql = `SELECT ${catalogProductFields}
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND IFNULL(p.is_constructor, 0) = 0
           AND IFNULL(c.is_packaging, 0) = 0
           AND (c.id = ? OR c.parent_id = ?)`;
    sql += appendExcludeSql(excludeIds, params);
    sql += ` ORDER BY p.id DESC
         LIMIT ${safeLimit}`;

    const [rows] = await db.execute(sql, params);
    return rows || [];
};

const listForCheckoutUpsells = async (mainProductId, orderedUpsellIds) => {
    const main = Number(mainProductId);
    const wanted = [];
    if (Array.isArray(orderedUpsellIds)) {
        for (const raw of orderedUpsellIds) {
            const pid = Number(raw);
            if (Number.isFinite(pid) && pid > 0 && pid !== main) {
                wanted.push(pid);
            }
        }
    }

    if (wanted.length > 0) {
        const rows = await productsByIds(wanted);
        const byId = {};
        for (const r of rows) {
            byId[r.id] = r;
        }
        const out = [];
        for (const id of wanted) {
            if (byId[id]) {
                out.push(byId[id]);
            }
        }
        return out;
    }

    if (!Number.isFinite(main) || main <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT
            p.id, p.name, p.slug, p.description, p.base_price, p.sale_price,
            p.stock_quantity, p.image_url, p.average_rating,
            c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND p.stock_quantity > 0
           AND p.id != ?
         ORDER BY p.sale_price ASC
         LIMIT 3`,
        [main]
    );

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
            p.average_rating, p.is_active, p.unit_type, IFNULL(p.is_constructor, 0) AS is_constructor,
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
    const slug = await ensureUniqueSlug(slugFromName(name), id);

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

    let is_constructor = 0;
    if (
        payload.is_constructor === true ||
        payload.is_constructor === 1 ||
        payload.is_constructor === '1'
    ) {
        is_constructor = 1;
    }

    const [result] = await db.execute(
        `UPDATE products SET
            category_id = ?, name = ?, slug = ?, description = ?,
             base_price = ?, sale_price = ?, stock_quantity = ?,
        unit_type = ?, is_active = ?, is_constructor = ?
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
            is_constructor,
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
    const sku = null;
    const slug = await ensureUniqueSlug(slugFromName(name), null);
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

    let is_constructor = 0;
    if (
        payload.is_constructor === true ||
        payload.is_constructor === 1 ||
        payload.is_constructor === '1'
    ) {
        is_constructor = 1;
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO products (
                category_id, sku, name, slug, description,
                base_price, sale_price, stock_quantity, unit_type, is_active, is_constructor
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                is_active,
                is_constructor
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
const allForAdmin = async (options = {}) => {
    const where = ['1 = 1'];
    const params = [];

    const status = typeof options.status === 'string' ? options.status.trim() : 'all';
    if (status === 'active') {
        where.push('p.is_active = 1');
    } else if (status === 'archived') {
        where.push('p.is_active = 0');
    }

    const categoryId = Number(options.category_id);
    if (Number.isFinite(categoryId) && categoryId > 0) {
        where.push('p.category_id = ?');
        params.push(categoryId);
    }

    const productType = typeof options.type === 'string' ? options.type.trim() : 'all';
    if (productType === 'catalog') {
        where.push('IFNULL(p.is_constructor, 0) = 0');
    } else if (productType === 'constructor') {
        where.push('IFNULL(p.is_constructor, 0) = 1');
    }

    const stockFilter = typeof options.stock === 'string' ? options.stock.trim() : '';
    if (stockFilter === 'low') {
        where.push('p.is_active = 1');
        where.push('IFNULL(p.is_constructor, 0) = 0');
        where.push('p.stock_quantity <= 5');
    } else if (stockFilter === 'out') {
        where.push('p.is_active = 1');
        where.push('IFNULL(p.is_constructor, 0) = 0');
        where.push('p.stock_quantity <= 0');
    }

    const q = typeof options.q === 'string' ? options.q.trim() : '';
    if (q) {
        const asId = Number(q);
        if (Number.isFinite(asId) && asId > 0) {
            where.push('(p.name LIKE ? OR c.name LIKE ? OR p.id = ? OR p.slug LIKE ?)');
            const like = '%' + q + '%';
            params.push(like, like, asId, like);
        } else {
            where.push('(p.name LIKE ? OR c.name LIKE ? OR p.slug LIKE ?)');
            const like = '%' + q + '%';
            params.push(like, like, like);
        }
    }

    const sortMap = {
        id_desc: 'p.id DESC',
        id_asc: 'p.id ASC',
        name_asc: 'p.name ASC',
        name_desc: 'p.name DESC',
        price_asc: 'p.sale_price ASC',
        price_desc: 'p.sale_price DESC',
        stock_asc: 'p.stock_quantity ASC',
        stock_desc: 'p.stock_quantity DESC'
    };
    const sortKey = typeof options.sort === 'string' ? options.sort.trim() : 'id_desc';
    const orderBy = sortMap[sortKey] || sortMap.id_desc;

    const [rows] = await db.execute(
        `SELECT
            p.id, p.category_id, p.sku, p.name, p.slug,
            p.base_price, p.sale_price, p.stock_quantity,
            p.is_active, p.image_url, IFNULL(p.is_constructor, 0) AS is_constructor,
            c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE ${where.join(' AND ')}
         ORDER BY ${orderBy}`,
        params
    );
    return rows || [];
};

const setActiveById = async (productId, isActive) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const active = Number(isActive) === 1 ? 1 : 0;
    const [result] = await db.execute('UPDATE products SET is_active = ? WHERE id = ?', [active, id]);
    return result && result.affectedRows > 0;
};

const updateStockById = async (productId, stockQuantity) => {
    const id = Number(productId);
    const stock = Number(stockQuantity);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(stock) || stock < 0) {
        return false;
    }

    const [result] = await db.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [
        Math.floor(stock),
        id
    ]);
    return result && result.affectedRows > 0;
};

const bulkSetActive = async (productIds, isActive) => {
    const ids = (productIds || [])
        .map((row) => Number(row))
        .filter((id) => Number.isFinite(id) && id > 0)
        .slice(0, 100);
    if (ids.length === 0) {
        return 0;
    }

    const active = Number(isActive) === 1 ? 1 : 0;
    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await db.execute(
        `UPDATE products SET is_active = ? WHERE id IN (${placeholders})`,
        [active, ...ids]
    );
    return result && result.affectedRows ? Number(result.affectedRows) : 0;
};

const duplicateById = async (productId) => {
    const ProductColorVariant = require('./ProductColorVariant');

    const source = await findById(productId);
    if (!source) {
        return null;
    }

    const copyName = source.name + ' (копія)';
    const newId = await create({
        category_id: source.category_id,
        name: copyName,
        description: source.description,
        base_price: source.base_price,
        sale_price: source.sale_price,
        stock_quantity: source.stock_quantity,
        unit_type: source.unit_type,
        is_active: 0,
        is_constructor: source.is_constructor
    });

    if (!newId) {
        return null;
    }

    if (source.image_url) {
        await updateImageUrl(newId, source.image_url);
    }

    if (Number(source.is_constructor) === 1) {
        const variants = await ProductColorVariant.listByProductId(source.id);
        for (let i = 0; i < variants.length; i += 1) {
            const variant = variants[i];
            const variantId = await ProductColorVariant.create(newId, {
                flower_color: variant.flower_color,
                color_hex: variant.color_hex,
                stock_quantity: variant.stock_quantity,
                is_active: variant.is_active
            });
            if (variantId && variant.image_url) {
                await ProductColorVariant.updateImageUrl(variantId, variant.image_url);
            }
        }
    }

    return newId;
};
const updateAverageRating = async (productId, averageRating) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    let value = null;
    if (averageRating != null && averageRating !== '') {
        const num = Number(averageRating);
        if (!Number.isFinite(num) || num < 0 || num > 5) {
            return false;
        }
        value = num;
    }

    const [result] = await db.execute(
        'UPDATE products SET average_rating = ? WHERE id = ?',
        [value, id]
    );

    return result.affectedRows > 0;
};

const deleteById = async (productId) => {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }

    const [usedRows] = await db.execute(
        'SELECT id FROM order_items WHERE product_id = ? LIMIT 1',
        [id]
    );
    if (usedRows && usedRows.length > 0) {
        const [result] = await db.execute(
            'UPDATE products SET is_active = 0 WHERE id = ?',
            [id]
        );
        return result && result.affectedRows > 0;
    }

    const [result] = await db.execute('DELETE FROM products WHERE id = ?', [id]);
    return result && result.affectedRows > 0;
};

const listStockForWarehouse = async ({ search, filter, lowLimit, typeFilter } = {}) => {
    const low = Number(lowLimit) > 0 ? Number(lowLimit) : 5;
    const filterRaw = typeof filter === 'string' ? filter.trim() : 'all';
    const typeRaw = typeof typeFilter === 'string' ? typeFilter.trim() : 'all';
    const q = typeof search === 'string' ? search.trim() : '';

    const pendingWhere = `
        o.admin_approved = 0
        AND o.cancel_request_at IS NULL
        AND (
            o.payment_status IN ('paid', 'cod')
            OR (
                o.payment_status = 'unpaid'
                AND (o.payment_deadline_at IS NULL OR o.payment_deadline_at > NOW())
            )
        )`;

    let catalogSql = `
        SELECT 'catalog' AS row_type,
               p.id AS product_id,
               NULL AS variant_id,
               p.name AS display_name,
               p.stock_quantity,
               p.unit_type,
               c.name AS category_name,
               (
                   SELECT COALESCE(SUM(oi.quantity), 0)
                   FROM order_items oi
                   INNER JOIN orders o ON oi.order_id = o.id
                   WHERE oi.product_id = p.id
                     AND oi.color_variant_id IS NULL
                     AND ${pendingWhere}
               ) AS pending_qty
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND IFNULL(p.is_constructor, 0) = 0
           AND IFNULL(c.is_packaging, 0) = 0`;

    const catalogParams = [];

    if (q !== '') {
        catalogSql += ' AND p.name LIKE ?';
        catalogParams.push('%' + q + '%');
    }

    let variantSql = `
        SELECT 'constructor' AS row_type,
               p.id AS product_id,
               v.id AS variant_id,
               CONCAT(p.name, ' — ', v.flower_color) AS display_name,
               v.stock_quantity,
               p.unit_type,
               c.name AS category_name,
               (
                   SELECT COALESCE(SUM(oi.quantity), 0)
                   FROM order_items oi
                   INNER JOIN orders o ON oi.order_id = o.id
                   WHERE oi.color_variant_id = v.id
                     AND ${pendingWhere}
               ) AS pending_qty
         FROM product_color_variants v
         INNER JOIN products p ON p.id = v.product_id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND v.is_active = 1
           AND IFNULL(p.is_constructor, 0) = 1`;

    const variantParams = [];

    if (q !== '') {
        variantSql += ' AND (p.name LIKE ? OR v.flower_color LIKE ?)';
        variantParams.push('%' + q + '%', '%' + q + '%');
    }

    let rows = [];

    if (typeRaw !== 'constructor') {
        const [catalogRows] = await db.execute(catalogSql, catalogParams);
        rows = rows.concat(catalogRows || []);
    }

    if (typeRaw !== 'catalog') {
        const [variantRows] = await db.execute(variantSql, variantParams);
        rows = rows.concat(variantRows || []);
    }

    const mapped = [];
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const qty = Number(row.stock_quantity) || 0;
        const pending = Number(row.pending_qty) || 0;
        const free = qty - pending;
        const item = {
            row_type: row.row_type,
            product_id: row.product_id,
            variant_id: row.variant_id,
            name: row.display_name,
            category_name: row.category_name,
            stock_quantity: qty,
            pending_qty: pending,
            free_qty: free,
            unit_type: row.unit_type || 'шт'
        };

        if (filterRaw === 'low' && !(qty > 0 && qty <= low)) {
            continue;
        }
        if (filterRaw === 'zero' && qty > 0) {
            continue;
        }
        if (filterRaw === 'shortage' && free >= 0) {
            continue;
        }

        mapped.push(item);
    }

    mapped.sort((a, b) => {
        if (a.free_qty !== b.free_qty) {
            return a.free_qty - b.free_qty;
        }
        if (a.stock_quantity !== b.stock_quantity) {
            return a.stock_quantity - b.stock_quantity;
        }
        return String(a.name).localeCompare(String(b.name), 'uk');
    });

    return mapped;
};

const summarizeStockForWarehouse = async (lowLimit) => {
    const rows = await listStockForWarehouse({ filter: 'all', lowLimit });
    let low = 0;
    let zero = 0;
    let shortage = 0;
    let reserved = 0;
    let catalog = 0;
    let constructor = 0;

    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const qty = Number(row.stock_quantity) || 0;
        const pending = Number(row.pending_qty) || 0;
        const free = Number(row.free_qty) || 0;

        if (row.row_type === 'constructor') {
            constructor += 1;
        } else {
            catalog += 1;
        }

        if (qty <= 0) {
            zero += 1;
        } else if (qty <= lowLimit) {
            low += 1;
        }

        if (free < 0) {
            shortage += 1;
        }

        reserved += pending;
    }

    return {
        total: rows.length,
        catalog,
        constructor,
        low,
        zero,
        shortage,
        reserved
    };
};

const adjustStockForWarehouse = async ({ productId, variantId, delta, userId, note }) => {
    const StockAdjustment = require('./StockAdjustment');
    const pid = Number(productId);
    const deltaQty = Math.floor(Number(delta));
    const uid = Number(userId);

    if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(uid) || uid <= 0) {
        return { ok: false, message: 'Невірні дані' };
    }
    if (!Number.isFinite(deltaQty) || deltaQty === 0) {
        return { ok: false, message: 'Вкажіть зміну кількості' };
    }

    let vid = null;
    if (variantId != null && variantId !== '') {
        vid = Number(variantId);
        if (!Number.isFinite(vid) || vid <= 0) {
            vid = null;
        }
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        let stockBefore = 0;
        let stockAfter = 0;

        if (vid) {
            const [rows] = await conn.execute(
                `SELECT v.stock_quantity
                 FROM product_color_variants v
                 INNER JOIN products p ON p.id = v.product_id
                 WHERE v.id = ? AND v.product_id = ? AND p.is_active = 1 AND v.is_active = 1
                 LIMIT 1
                 FOR UPDATE`,
                [vid, pid]
            );
            if (!rows || !rows[0]) {
                await conn.rollback();
                return { ok: false, message: 'Позицію не знайдено' };
            }
            stockBefore = Number(rows[0].stock_quantity) || 0;
            stockAfter = Math.max(0, stockBefore + deltaQty);
            await conn.execute('UPDATE product_color_variants SET stock_quantity = ? WHERE id = ?', [
                stockAfter,
                vid
            ]);
        } else {
            const [rows] = await conn.execute(
                `SELECT stock_quantity
                 FROM products
                 WHERE id = ? AND is_active = 1 AND IFNULL(is_constructor, 0) = 0
                 LIMIT 1
                 FOR UPDATE`,
                [pid]
            );
            if (!rows || !rows[0]) {
                await conn.rollback();
                return { ok: false, message: 'Товар не знайдено' };
            }
            stockBefore = Number(rows[0].stock_quantity) || 0;
            stockAfter = Math.max(0, stockBefore + deltaQty);
            await conn.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [stockAfter, pid]);
        }

        await StockAdjustment.insert(
            {
                product_id: pid,
                color_variant_id: vid,
                user_id: uid,
                delta_qty: deltaQty,
                stock_before: stockBefore,
                stock_after: stockAfter,
                note: note
            },
            conn
        );

        await conn.commit();
        return { ok: true, stock_after: stockAfter, stock_before: stockBefore };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const findBySlug = async (slug) => {
    const s = typeof slug === 'string' ? slug.trim() : '';
    if (!s) {
        return null;
    }
    const [rows] = await db.execute(
        `SELECT p.*, c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.slug = ? AND p.is_active = 1
         LIMIT 1`,
        [s]
    );
    if (!rows || rows.length === 0) {
        return null;
    }
    return rows[0];
};

const listConstructorStemsWithVariants = async () => {
    const ProductColorVariant = require('./ProductColorVariant');

    const [stems] = await db.execute(
        `SELECT
            p.id, p.category_id, p.name, p.sale_price, p.stock_quantity, p.image_url, p.unit_type,
            c.name AS category_name
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND p.is_constructor = 1
         ORDER BY c.sort_order ASC, c.name ASC, p.id ASC`
    );

    const list = stems || [];
    if (list.length === 0) {
        return [];
    }

    const ids = list.map((row) => Number(row.id));
    const variants = await ProductColorVariant.listByProductIds(ids);
    const byProduct = {};

    for (let i = 0; i < variants.length; i += 1) {
        const variant = variants[i];
        const pid = Number(variant.product_id);
        if (!byProduct[pid]) {
            byProduct[pid] = [];
        }
        byProduct[pid].push(variant);
    }

    const result = [];
    for (let i = 0; i < list.length; i += 1) {
        const stem = list[i];
        result.push({
            ...stem,
            variants: byProduct[Number(stem.id)] || []
        });
    }

    return result;
};

const listConstructorPartsForAdmin = async () => {
    const [rows] = await db.execute(
        `SELECT
            p.id, p.category_id, p.sku, p.name, p.slug,
            p.base_price, p.sale_price, p.stock_quantity,
            p.is_active, p.image_url, p.is_constructor,
            c.name AS category_name,
            (
                SELECT COUNT(*)
                FROM product_color_variants v
                WHERE v.product_id = p.id
            ) AS colors_count,
            (
                SELECT COALESCE(SUM(v.stock_quantity), 0)
                FROM product_color_variants v
                WHERE v.product_id = p.id AND v.is_active = 1
            ) AS variant_stock_total,
            (
                SELECT v.image_url
                FROM product_color_variants v
                WHERE v.product_id = p.id AND v.is_active = 1
                ORDER BY v.sort_order ASC, v.id ASC
                LIMIT 1
            ) AS preview_image_url
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE IFNULL(p.is_constructor, 0) = 1
           AND p.is_active = 1
         ORDER BY p.id DESC`
    );
    return rows || [];
};

const listConstructorPackaging = async () => {
    const [rows] = await db.execute(
        `SELECT
            p.id, p.name, p.slug, p.sale_price, p.stock_quantity
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND IFNULL(p.is_constructor, 0) = 0
           AND IFNULL(c.is_packaging, 0) = 1
           AND (p.sale_price <= 0 OR p.stock_quantity > 0)
         ORDER BY p.sale_price ASC, p.id ASC`
    );
    return rows || [];
};

const findLatestCatalogProduct = async () => {
    const [rows] = await db.execute(
        `SELECT p.id AS product_id,
                p.name AS product_name,
                p.slug AS product_slug,
                p.image_url
         FROM products p
         INNER JOIN categories c ON p.category_id = c.id
         WHERE p.is_active = 1
           AND IFNULL(p.is_constructor, 0) = 0
           AND IFNULL(c.is_packaging, 0) = 0
         ORDER BY p.id DESC
         LIMIT 1`
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0];
};

module.exports = {
    allProducts,
    listHitProducts,
    listDiscountProducts,
    listProductsForCategory,
    findLatestCatalogProduct,
    productsByIds,
    listForCheckoutUpsells,
    updateImageUrl,
    findById,
    updateById,
    create,
    allForAdmin,
    updateAverageRating,
    deleteById,
    setActiveById,
    updateStockById,
    bulkSetActive,
    duplicateById,
    listStockForWarehouse,
    summarizeStockForWarehouse,
    adjustStockForWarehouse,
    findBySlug,
    listConstructorStemsWithVariants,
    listConstructorPartsForAdmin,
    listConstructorPackaging
};