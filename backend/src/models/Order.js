const db = require('../config/db');

const getPendingStatusId = async () => {
    const [rows] = await db.execute(
        'SELECT id FROM statuses WHERE status_name = ? LIMIT 1',
        ['pending']
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return Number(rows[0].id) || null;
};

const normalizeItems = (items) => {
    if (!Array.isArray(items)) {
        return [];
    }

    const cleaned = [];
    for (const item of items) {
        const product_id = Number(item && item.product_id);
        const quantity = Number(item && item.quantity);
        const unit_price = Number(item && item.unit_price);

        if (!Number.isFinite(product_id) || product_id <= 0) {
            continue;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            continue;
        }
        if (!Number.isFinite(unit_price) || unit_price < 0) {
            continue;
        }

        cleaned.push({ product_id, quantity, unit_price });
    }

    return cleaned;
};


const create = async (payload) => {
    const user_id = Number(payload && payload.user_id);
    if (!Number.isFinite(user_id) || user_id <= 0) {
        return null;
    }

    const delivery_address =
        typeof payload.delivery_address === 'string' ? payload.delivery_address.trim() : '';
    if (!delivery_address) {
        return null;
    }

    const items = normalizeItems(payload && payload.items);
    if (items.length === 0) {
        return null;
    }

    const status_id = await getPendingStatusId();
    if (!status_id) {
        return null;
    }

    const delivery_datetime =
        typeof payload.delivery_datetime === 'string' && payload.delivery_datetime.trim() !== ''
            ? payload.delivery_datetime.trim()
            : null;
    const total_price = Number(payload && payload.total_price);
    if (!Number.isFinite(total_price) || total_price < 0) {
        return null;
    }

    const order_id = await insertOrderRow({
        user_id,
        status_id,
        delivery_address,
        delivery_datetime,
        total_price
    });
    if (!order_id) {
        return null;
    }

    for (const item of items) {
        const ok = await insertOrderItemRow({
            order_id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price
        });
        if (!ok) {
            return null;
        }
    }

    return order_id;
};

module.exports.create = create;


const insertOrderRow = async ({ user_id, status_id, delivery_address, delivery_datetime, total_price }) => {
    const [result] = await db.execute(
        `INSERT INTO orders (user_id, status_id, delivery_address, delivery_datetime, total_price)
         VALUES (?, ?, ?, ?, ?)`,
        [user_id, status_id, delivery_address, delivery_datetime, total_price]
    );

    const orderId = Number(result && result.insertId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
        return null;
    }

    return orderId;
};

module.exports.insertOrderRow = insertOrderRow;


const insertOrderItemRow = async ({ order_id, product_id, quantity, unit_price }) => {
    const [result] = await db.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES (?, ?, ?, ?)`,
        [order_id, product_id, quantity, unit_price]
    );

    return result && result.affectedRows > 0;
};

module.exports.insertOrderRow = insertOrderRow;
module.exports.insertOrderItemRow = insertOrderItemRow;


module.exports.insertOrderRow = insertOrderRow;
module.exports.insertOrderItemRow = insertOrderItemRow;

const createWithTransaction = async (payload) => {
    const user_id = Number(payload && payload.user_id);
    if (!Number.isFinite(user_id) || user_id <= 0) {
        return null;
    }

    const delivery_address =
        typeof payload.delivery_address === 'string' ? payload.delivery_address.trim() : '';
    if (!delivery_address) {
        return null;
    }

    const items = normalizeItems(payload && payload.items);
    if (items.length === 0) {
        return null;
    }

    const status_id = await getPendingStatusId();
    if (!status_id) {
        return null;
    }

    const delivery_datetime =
        typeof payload.delivery_datetime === 'string' && payload.delivery_datetime.trim() !== ''
            ? payload.delivery_datetime.trim()
            : null;
    const total_price = Number(payload && payload.total_price);
    if (!Number.isFinite(total_price) || total_price < 0) {
        return null;
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [orderResult] = await conn.execute(
            `INSERT INTO orders (user_id, status_id, delivery_address, delivery_datetime, total_price)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, status_id, delivery_address, delivery_datetime, total_price]
        );

        const orderId = Number(orderResult && orderResult.insertId);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            await conn.rollback();
            return null;
        }

        for (const item of items) {
            const [itemResult] = await conn.execute(
                `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                 VALUES (?, ?, ?, ?)`,
                [orderId, item.product_id, item.quantity, item.unit_price]
            );
            if (!itemResult || itemResult.affectedRows <= 0) {
                await conn.rollback();
                return null;
            }
        }

        await conn.commit();
        return orderId;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

module.exports.createWithTransaction = createWithTransaction;

module.exports = {
    create,
    normalizeItems,
    getPendingStatusId
};

module.exports.createWithTransaction = createWithTransaction;
module.exports.insertOrderRow = insertOrderRow;
module.exports.insertOrderItemRow = insertOrderItemRow;

const listByUserId = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT o.id, o.total_price, o.delivery_address, o.delivery_datetime,
                o.status_id, s.status_name AS status_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.user_id = ?
         ORDER BY o.id DESC`,
        [uid]
    );

    return rows;
};

module.exports.listByUserId = listByUserId;

const listAllForWarehouse = async () => {
    const [rows] = await db.execute(
        `SELECT o.id, o.user_id, o.total_price, o.delivery_address, o.delivery_datetime,
                o.status_id, s.status_name AS status_name,
                u.email AS customer_email,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS customer_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         INNER JOIN users u ON o.user_id = u.id
         ORDER BY o.id DESC`
    );

    return rows;
};

module.exports.listAllForWarehouse = listAllForWarehouse;

const listStatusesForWarehouse = async () => {
    const [rows] = await db.execute(
        `SELECT id, status_name
         FROM statuses
         WHERE status_name IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')
         ORDER BY FIELD(status_name, 'pending', 'processing', 'shipped', 'completed', 'cancelled')`
    );

    return rows;
};

const updateStatusByWarehouse = async (orderId, statusId) => {
    const oid = Number(orderId);
    const sid = Number(statusId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }
    if (!Number.isFinite(sid) || sid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE orders
         SET status_id = ?
         WHERE id = ?`,
        [sid, oid]
    );

    return result && result.affectedRows > 0;
};

module.exports.listStatusesForWarehouse = listStatusesForWarehouse;
module.exports.updateStatusByWarehouse = updateStatusByWarehouse;