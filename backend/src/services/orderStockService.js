const db = require('../config/db');
const { mergeCartItems } = require('../utils/cartItemMerge');

const pendingWhere = `
    o.admin_approved = 0
    AND o.cancel_request_at IS NULL
    AND (
        o.payment_status IN ('paid', 'cod')
        OR (
            o.payment_status = 'unpaid'
            AND (o.payment_deadline_at IS NULL OR o.payment_deadline_at > NOW())
        )
    )
`;

const getPendingQtyForVariant = async (variantId, conn) => {
    const vid = Number(variantId);
    if (!Number.isFinite(vid) || vid <= 0) {
        return 0;
    }

    const runner = conn && typeof conn.execute === 'function' ? conn : db;

    const [rows] = await runner.execute(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS pending_qty
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE oi.color_variant_id = ?
           AND ${pendingWhere}`,
        [vid]
    );

    if (!rows || !rows[0]) {
        return 0;
    }
    return Number(rows[0].pending_qty) || 0;
};

const getPendingQtyForProduct = async (productId, conn) => {
    const pid = Number(productId);
    if (!Number.isFinite(pid) || pid <= 0) {
        return 0;
    }

    const runner = conn && typeof conn.execute === 'function' ? conn : db;

    const [rows] = await runner.execute(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS pending_qty
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_id = ?
           AND oi.color_variant_id IS NULL
           AND ${pendingWhere}`,
        [pid]
    );

    if (!rows || !rows[0]) {
        return 0;
    }
    return Number(rows[0].pending_qty) || 0;
};

const validateItemsStock = async (items) => {
    const merged = mergeCartItems(items);
    if (!Array.isArray(merged) || merged.length === 0) {
        return { ok: false, message: 'Немає товарів у замовленні' };
    }

    for (let i = 0; i < merged.length; i += 1) {
        const item = merged[i];
        const qty = Number(item.quantity);
        const pid = Number(item.product_id);
        let variantId = null;
        if (item.color_variant_id != null && item.color_variant_id !== '') {
            variantId = Number(item.color_variant_id);
        }

        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(pid) || pid <= 0) {
            continue;
        }

        if (variantId && variantId > 0) {
            const [rows] = await db.execute(
                `SELECT v.stock_quantity, p.name AS product_name, v.flower_color
                 FROM product_color_variants v
                 INNER JOIN products p ON p.id = v.product_id
                 WHERE v.id = ?
                 LIMIT 1`,
                [variantId]
            );
            if (!rows || !rows[0]) {
                return { ok: false, message: 'Один із варіантів товару більше недоступний' };
            }
            const stock = Number(rows[0].stock_quantity) || 0;
            const pending = await getPendingQtyForVariant(variantId, null);
            if (stock - pending < qty) {
                let name = rows[0].product_name;
                if (rows[0].flower_color) {
                    name = name + ' (' + rows[0].flower_color + ')';
                }
                return { ok: false, message: 'Недостатньо на складі: ' + name };
            }
            continue;
        }

        const [rows] = await db.execute(
            'SELECT stock_quantity, name FROM products WHERE id = ? LIMIT 1',
            [pid]
        );
        if (!rows || !rows[0]) {
            return { ok: false, message: 'Один із товарів більше недоступний' };
        }
        const stock = Number(rows[0].stock_quantity) || 0;
        const pending = await getPendingQtyForProduct(pid, null);
        if (stock - pending < qty) {
            return { ok: false, message: 'Недостатньо на складі: ' + rows[0].name };
        }
    }

    return { ok: true };
};

const validateItemsStockInConn = async (conn, items) => {
    if (!conn || !Array.isArray(items) || items.length === 0) {
        return { ok: false, message: 'Немає товарів у замовленні' };
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const qty = Number(item.quantity);
        const pid = Number(item.product_id);
        let variantId = null;
        if (item.color_variant_id != null && item.color_variant_id !== '') {
            variantId = Number(item.color_variant_id);
        }

        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(pid) || pid <= 0) {
            continue;
        }

        if (variantId && variantId > 0) {
            const [rows] = await conn.execute(
                `SELECT v.stock_quantity, p.name AS product_name, v.flower_color
                 FROM product_color_variants v
                 INNER JOIN products p ON p.id = v.product_id
                 WHERE v.id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [variantId]
            );
            if (!rows || !rows[0]) {
                return { ok: false, message: 'Один із варіантів товару більше недоступний' };
            }
            const stock = Number(rows[0].stock_quantity) || 0;
            const pending = await getPendingQtyForVariant(variantId, conn);
            if (stock - pending < qty) {
                let name = rows[0].product_name;
                if (rows[0].flower_color) {
                    name = name + ' (' + rows[0].flower_color + ')';
                }
                return { ok: false, message: 'Недостатньо на складі: ' + name };
            }
            continue;
        }

        const [rows] = await conn.execute(
            'SELECT stock_quantity, name FROM products WHERE id = ? LIMIT 1 FOR UPDATE',
            [pid]
        );
        if (!rows || !rows[0]) {
            return { ok: false, message: 'Один із товарів більше недоступний' };
        }
        const stock = Number(rows[0].stock_quantity) || 0;
        const pending = await getPendingQtyForProduct(pid, conn);
        if (stock - pending < qty) {
            return { ok: false, message: 'Недостатньо на складі: ' + rows[0].name };
        }
    }

    return { ok: true };
};

module.exports = {
    validateItemsStock,
    validateItemsStockInConn,
    getPendingQtyForProduct,
    getPendingQtyForVariant
};
