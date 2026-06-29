const db = require('../config/db');
const paymentService = require('../services/paymentService');
const orderStockService = require('../services/orderStockService');
const ProductColorVariant = require('./ProductColorVariant');
const StatusModel = require('./Status');
const OrderStatusLog = require('./OrderStatusLog');
const orderDeliveryFields = require('../utils/orderDeliveryFields');

const ORDER_DELIVERY_STRUCT_SQL = `
                o.customer_first_name,
                o.customer_last_name,
                o.customer_phone,
                o.customer_email,
                o.delivery_street,
                o.delivery_house,
                o.delivery_apartment,
                o.recipient_note,
                o.bouquet_note,`;

const getStatusIdByName = async (name) => {
    const [rows] = await db.execute(
        'SELECT id FROM statuses WHERE status_name = ? LIMIT 1',
        [name]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return Number(rows[0].id) || null;
};

const getPendingStatusId = async () => {
    return getStatusIdByName('pending');
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

        cleaned.push({
            product_id,
            color_variant_id:
                item.color_variant_id != null && item.color_variant_id !== ''
                    ? Number(item.color_variant_id) || null
                    : null,
            quantity,
            unit_price
        });
    }

    return cleaned;
};


const createWithTransaction = async (payload) => {
    let user_id = payload && payload.user_id;
    if (user_id != null && user_id !== '') {
        user_id = Number(user_id);
        if (!user_id || user_id <= 0) {
            user_id = null;
        }
    } else {
        user_id = null;
    }

    const deliveryMeta = orderDeliveryFields.normalizeOrderDeliveryPayload(payload);
    const customerName = orderDeliveryFields.customerNameFromRow(deliveryMeta);

    if (!customerName || !deliveryMeta.customer_phone) {
        return null;
    }

    if (deliveryMeta.delivery_method !== 'pickup') {
        if (!deliveryMeta.delivery_street || !deliveryMeta.delivery_house) {
            return null;
        }
    }

    const items = normalizeItems(payload && payload.items);
    if (items.length === 0) {
        return null;
    }

    const status_id = await getPendingStatusId();
    if (!status_id) {
        return null;
    }

    const total_price = Number(payload && payload.total_price);
    if (!Number.isFinite(total_price) || total_price < 0) {
        return null;
    }

    let delivery_date = null;
    let delivery_timeslot = null;
    const rawDatetime =
        typeof payload.delivery_datetime === 'string' ? payload.delivery_datetime.trim() : '';
    if (rawDatetime !== '') {
        const parts = rawDatetime.split(' ');
        delivery_date = parts[0];
        if (parts[1]) {
            delivery_timeslot = parts[1].slice(0, 5);
        }
    }

    if (!delivery_date) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        delivery_date = `${yyyy}-${mm}-${dd}`;
    }

    const receiver_name =
        typeof payload.receiver_name === 'string' && payload.receiver_name.trim() !== ''
            ? payload.receiver_name.trim()
            : null;
    const receiver_phone =
        typeof payload.receiver_phone === 'string' && payload.receiver_phone.trim() !== ''
            ? payload.receiver_phone.trim()
            : null;

    const summaryPayload = {
        ...deliveryMeta,
        receiver_name,
        receiver_phone
    };
    const delivery_address = orderDeliveryFields.buildDeliverySummary(summaryPayload);

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const stockCheck = await orderStockService.validateItemsStockInConn(conn, items);
        if (!stockCheck.ok) {
            await conn.rollback();
            return null;
        }

        const payWindowMin = paymentService.PAYMENT_WINDOW_MINUTES;

        const [orderResult] = await conn.execute(
            `INSERT INTO orders (
                user_id, status_id, delivery_address,
                customer_first_name, customer_last_name, customer_phone, customer_email,
                delivery_street, delivery_house, delivery_apartment,
                recipient_note, bouquet_note,
                delivery_date, delivery_timeslot, delivery_method,
                total_amount, receiver_name, receiver_phone, admin_approved, payment_deadline_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
            [
                user_id,
                status_id,
                delivery_address,
                deliveryMeta.customer_first_name,
                deliveryMeta.customer_last_name,
                deliveryMeta.customer_phone,
                deliveryMeta.customer_email,
                deliveryMeta.delivery_street,
                deliveryMeta.delivery_house,
                deliveryMeta.delivery_apartment,
                deliveryMeta.recipient_note,
                deliveryMeta.bouquet_note,
                delivery_date,
                delivery_timeslot,
                deliveryMeta.delivery_method,
                total_price,
                receiver_name,
                receiver_phone,
                payWindowMin
            ]
        );

        const orderId = Number(orderResult && orderResult.insertId);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            await conn.rollback();
            return null;
        }

        for (const item of items) {
            const variantId =
                item.color_variant_id != null && item.color_variant_id !== ''
                    ? Number(item.color_variant_id)
                    : null;
            const [itemResult] = await conn.execute(
                `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, color_variant_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [orderId, item.product_id, item.quantity, item.unit_price, variantId]
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

const listByUserId = async (userId) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.total_amount AS total_price,
                o.delivery_address,${ORDER_DELIVERY_STRUCT_SQL}
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                o.admin_approved,
                o.payment_status,
                o.refund_status,
                o.cancel_request_at,
                o.cancel_request_note,
                o.createdAt,
                o.payment_deadline_at,
                COALESCE(o.is_archived, 0) AS is_archived,
                o.status_id, s.status_name AS status_name, s.label_uk AS status_label
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.user_id = ?
         ORDER BY o.id DESC`,
        [uid]
    );

    return rows;
};

const listForWarehouse = async ({ day, status_id } = {}) => {
    const where = [
        'o.admin_approved = 1',
        "o.payment_status IN ('paid', 'cod')",
        "s.status_name IN ('confirmed', 'processing', 'ready_for_pickup')"
    ];
    const params = [];

    const dayFilter = typeof day === 'string' ? day.trim() : '';
    if (dayFilter === 'today') {
        where.push('DATE(o.delivery_date) = CURDATE()');
    } else if (dayFilter === 'tomorrow') {
        where.push('DATE(o.delivery_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
    }

    const sid = Number(status_id);
    if (Number.isFinite(sid) && sid > 0) {
        where.push('o.status_id = ?');
        params.push(sid);
    }

    const [rows] = await db.execute(
        `SELECT o.id, o.user_id,
                o.total_amount AS total_price,
                o.delivery_address,${ORDER_DELIVERY_STRUCT_SQL}
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                o.payment_status,
                o.receiver_name,
                o.receiver_phone,
                o.cancel_request_at,
                o.cancel_request_note,
                o.courier_id,
                o.status_id, s.status_name AS status_name,
                s.label_uk AS status_label,
                COALESCE(u.email, '') AS customer_email,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                    o.receiver_name,
                    'Гість'
                ) AS customer_name,
                (
                    SELECT GROUP_CONCAT(CONCAT(p.name, ' ×', oi.quantity) SEPARATOR ', ')
                    FROM order_items oi
                    INNER JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = o.id
                ) AS products_summary,
                NULLIF(
                    TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))),
                    ''
                ) AS courier_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN users cu ON o.courier_id = cu.id
         WHERE ${where.join(' AND ')}
         ORDER BY o.delivery_date ASC, o.delivery_timeslot ASC, o.id ASC`,
        params
    );

    return rows;
};

const listForWarehouseStats = async () => {
    const [rows] = await db.execute(
        `SELECT o.id,
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                o.courier_id,
                o.cancel_request_at,
                s.status_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.admin_approved = 1
           AND o.payment_status IN ('paid', 'cod')
           AND s.status_name IN ('confirmed', 'processing', 'ready_for_pickup')
         ORDER BY o.id ASC`
    );

    return rows || [];
};

const listForCourier = async ({ courier_id, day, status_id } = {}) => {
    const cid = Number(courier_id);
    if (!Number.isFinite(cid) || cid <= 0) {
        return [];
    }

    const where = [
        'o.admin_approved = 1',
        "o.payment_status IN ('paid', 'cod')",
        'o.courier_id = ?',
        "s.status_name IN ('processing', 'ready_for_pickup', 'shipped', 'delivered')"
    ];
    const params = [cid];

    const dayFilter = typeof day === 'string' ? day.trim() : '';
    if (dayFilter === 'today') {
        where.push('DATE(o.delivery_date) = CURDATE()');
    } else if (dayFilter === 'tomorrow') {
        where.push('DATE(o.delivery_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
    }

    const sid = Number(status_id);
    if (Number.isFinite(sid) && sid > 0) {
        where.push('o.status_id = ?');
        params.push(sid);
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.total_amount AS total_price,
                o.delivery_address,${ORDER_DELIVERY_STRUCT_SQL}
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                o.payment_status,
                o.receiver_name,
                o.receiver_phone,
                o.courier_id,
                o.assigned_at,
                o.status_id,
                s.status_name,
                s.label_uk AS status_label,
                (
                    SELECT GROUP_CONCAT(CONCAT(p.name, ' ×', oi.quantity) SEPARATOR ', ')
                    FROM order_items oi
                    INNER JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = o.id
                ) AS products_summary
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE ${where.join(' AND ')}
         ORDER BY o.delivery_date ASC, o.delivery_timeslot ASC, o.id ASC`,
        params
    );

    return rows || [];
};

const listForCourierStats = async (courierId) => {
    const cid = Number(courierId);
    if (!Number.isFinite(cid) || cid <= 0) {
        return [];
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                s.status_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.courier_id = ?
           AND o.admin_approved = 1
           AND s.status_name IN ('processing', 'ready_for_pickup', 'shipped', 'delivered')`,
        [cid]
    );

    return rows || [];
};

const getByIdForAssign = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.courier_id,
                o.delivery_method,
                o.delivery_date,
                o.delivery_timeslot,
                s.status_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.id = ?
           AND o.admin_approved = 1
           AND o.payment_status IN ('paid', 'cod')
           AND o.delivery_method <> 'pickup'
         LIMIT 1`,
        [oid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const assignCourier = async (orderId, courierId) => {
    const oid = Number(orderId);
    const cid = Number(courierId);
    if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(cid) || cid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE orders o
         INNER JOIN statuses s ON o.status_id = s.id
         SET o.courier_id = ?, o.assigned_at = NOW()
         WHERE o.id = ?
           AND o.admin_approved = 1
           AND o.payment_status IN ('paid', 'cod')
           AND o.delivery_method <> 'pickup'
           AND o.cancel_request_at IS NULL
           AND s.status_name IN ('processing', 'ready_for_pickup', 'shipped')
           AND (o.courier_id IS NULL OR o.courier_id = ?)`,
        [cid, oid, cid]
    );

    return result && result.affectedRows > 0;
};

const unassignCourier = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE orders o
         INNER JOIN statuses s ON o.status_id = s.id
         SET o.courier_id = NULL, o.assigned_at = NULL
         WHERE o.id = ?
           AND o.courier_id IS NOT NULL
           AND s.status_name IN ('processing', 'ready_for_pickup')`,
        [oid]
    );

    return result && result.affectedRows > 0;
};

const listActiveAssignmentsForDispatch = async () => {
    const [rows] = await db.execute(
        `SELECT o.courier_id,
                o.delivery_date,
                o.delivery_timeslot,
                s.status_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.courier_id IS NOT NULL
           AND o.admin_approved = 1
           AND s.status_name IN ('ready_for_pickup', 'shipped')`
    );

    return rows || [];
};

const getByIdForCourier = async (orderId, courierId) => {
    const oid = Number(orderId);
    const cid = Number(courierId);
    if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(cid) || cid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.status_id,
                o.courier_id,
                o.delivery_method,
                s.status_name,
                o.cancel_request_at
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.id = ?
           AND o.courier_id = ?
           AND o.admin_approved = 1
         LIMIT 1`,
        [oid, cid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const getDetailForCourier = async (orderId, courierId) => {
    const oid = Number(orderId);
    const cid = Number(courierId);
    if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(cid) || cid <= 0) {
        return null;
    }

    const [orderRows] = await db.execute(
        `SELECT o.id,
                o.total_amount AS total_price,
                o.delivery_address,
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                o.payment_status,
                o.receiver_name,
                o.receiver_phone,
                o.cancel_request_at,
                o.cancel_request_note,
                o.courier_id,
                o.assigned_at,
                o.status_id,
                s.status_name,
                s.label_uk AS status_label
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.id = ?
           AND o.courier_id = ?
           AND o.admin_approved = 1
           AND o.payment_status IN ('paid', 'cod')
           AND s.status_name NOT IN ('cancelled')
         LIMIT 1`,
        [oid, cid]
    );

    if (!orderRows || orderRows.length === 0) {
        return null;
    }

    const [items] = await db.execute(
        `SELECT oi.quantity,
                p.name AS product_name
         FROM order_items oi
         INNER JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`,
        [oid]
    );

    return {
        order: orderRows[0],
        items: items || []
    };
};

const listForWarehouseHistory = async ({ day, history_filter } = {}) => {
    const where = [
        'o.admin_approved = 1',
        "o.payment_status IN ('paid', 'cod')"
    ];
    const params = [];

    const hf = typeof history_filter === 'string' ? history_filter.trim() : 'done';
    if (hf === 'cancelled') {
        where.push("s.status_name IN ('cancelled')");
    } else if (hf === 'done') {
        where.push("s.status_name IN ('shipped', 'delivered', 'accepted', 'rejected')");
    } else {
        where.push("s.status_name NOT IN ('pending', 'confirmed', 'processing', 'ready_for_pickup')");
    }

    const dayFilter = typeof day === 'string' ? day.trim() : '';
    if (dayFilter === 'today') {
        where.push('DATE(o.delivery_date) = CURDATE()');
    } else if (dayFilter === 'tomorrow') {
        where.push('DATE(o.delivery_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
    }

    const [rows] = await db.execute(
        `SELECT o.id, o.user_id,
                o.total_amount AS total_price,
                o.delivery_address,${ORDER_DELIVERY_STRUCT_SQL}
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                o.payment_status,
                o.receiver_name,
                o.receiver_phone,
                o.cancel_request_at,
                o.courier_id,
                o.status_id, s.status_name AS status_name,
                s.label_uk AS status_label,
                (
                    SELECT GROUP_CONCAT(CONCAT(p.name, ' ×', oi.quantity) SEPARATOR ', ')
                    FROM order_items oi
                    INNER JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = o.id
                ) AS products_summary
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE ${where.join(' AND ')}
         ORDER BY o.delivery_date DESC, o.id DESC
         LIMIT 200`,
        params
    );

    return rows || [];
};

const listForCourierHistory = async ({ courier_id, day, history_filter } = {}) => {
    const cid = Number(courier_id);
    if (!Number.isFinite(cid) || cid <= 0) {
        return [];
    }

    const where = [
        'o.admin_approved = 1',
        'o.courier_id = ?'
    ];
    const params = [cid];

    const hf = typeof history_filter === 'string' ? history_filter.trim() : 'done';
    if (hf === 'cancelled') {
        where.push("s.status_name IN ('cancelled')");
    } else if (hf === 'done') {
        where.push("s.status_name IN ('accepted', 'rejected')");
    } else {
        where.push("s.status_name IN ('accepted', 'rejected', 'cancelled')");
    }

    const dayFilter = typeof day === 'string' ? day.trim() : '';
    if (dayFilter === 'today') {
        where.push('DATE(o.delivery_date) = CURDATE()');
    } else if (dayFilter === 'tomorrow') {
        where.push('DATE(o.delivery_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.total_amount AS total_price,
                o.delivery_address,${ORDER_DELIVERY_STRUCT_SQL}
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                o.payment_status,
                o.receiver_name,
                o.receiver_phone,
                o.courier_id,
                o.status_id,
                s.status_name,
                s.label_uk AS status_label,
                (
                    SELECT GROUP_CONCAT(CONCAT(p.name, ' ×', oi.quantity) SEPARATOR ', ')
                    FROM order_items oi
                    INNER JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = o.id
                ) AS products_summary
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE ${where.join(' AND ')}
         ORDER BY o.delivery_date DESC, o.id DESC
         LIMIT 200`,
        params
    );

    return rows || [];
};

const confirmCodPaidByCourier = async (orderId, courierId) => {
    const oid = Number(orderId);
    const cid = Number(courierId);
    if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(cid) || cid <= 0) {
        return { ok: false, code: 'bad_id' };
    }

    const [rows] = await db.execute(
        `SELECT o.id, o.payment_status, s.status_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.id = ?
           AND o.courier_id = ?
           AND o.admin_approved = 1
         LIMIT 1`,
        [oid, cid]
    );

    if (!rows || rows.length === 0) {
        return { ok: false, code: 'not_found' };
    }

    const order = rows[0];
    if (order.status_name !== 'delivered') {
        return { ok: false, code: 'not_delivered' };
    }
    if (order.payment_status !== 'cod') {
        return { ok: false, code: 'not_cod' };
    }

    const ok = await updatePaymentStatus(oid, 'paid');
    return ok ? { ok: true } : { ok: false, code: 'update_failed' };
};

const closeByCourier = async (orderId, courierId) => {
    const oid = Number(orderId);
    const cid = Number(courierId);
    if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(cid) || cid <= 0) {
        return { ok: false, code: 'bad_id' };
    }

    const [rows] = await db.execute(
        `SELECT o.id, o.payment_status, o.status_id, s.status_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.id = ?
           AND o.courier_id = ?
           AND o.admin_approved = 1
         LIMIT 1`,
        [oid, cid]
    );

    if (!rows || rows.length === 0) {
        return { ok: false, code: 'not_found' };
    }

    const order = rows[0];
    if (order.status_name !== 'delivered') {
        return { ok: false, code: 'not_delivered' };
    }
    if (order.payment_status !== 'paid') {
        return { ok: false, code: 'not_paid' };
    }

    const acceptedId = await getStatusIdByName('accepted');
    if (!acceptedId) {
        return { ok: false, code: 'no_status' };
    }

    const can = await StatusModel.canTransition(order.status_id, acceptedId);
    if (!can) {
        return { ok: false, code: 'invalid_transition' };
    }

    const ok = await updateStatusById(oid, acceptedId);
    return ok ? { ok: true, from_status_id: order.status_id, to_status_id: acceptedId } : { ok: false, code: 'update_failed' };
};

const listIdsUnassignedReady = async () => {
    const [rows] = await db.execute(
        `SELECT o.id
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.admin_approved = 1
           AND o.courier_id IS NULL
           AND o.delivery_method <> 'pickup'
           AND s.status_name = 'ready_for_pickup'
         ORDER BY o.delivery_date ASC, o.delivery_timeslot ASC, o.id ASC`
    );

    if (!rows || rows.length === 0) {
        return [];
    }

    const ids = [];
    for (const row of rows) {
        ids.push(Number(row.id));
    }
    return ids;
};

const listAllForWarehouse = async () => {
    return listForWarehouse({});
};

const listPendingForAdmin = async () => {
    const [rows] = await db.execute(
        `SELECT o.id,
                o.total_amount AS total_price,
                o.delivery_address,
                o.delivery_date,
                o.delivery_timeslot,
                o.payment_status,
                o.paid_at,
                o.receiver_name,
                o.receiver_phone,
                o.cancel_request_at,
                o.cancel_request_note,
                o.createdAt,
                u.first_name,
                u.last_name,
                u.email AS customer_email,
                o.user_id,
                (
                    SELECT GROUP_CONCAT(CONCAT(p.name, ' x', oi.quantity) SEPARATOR ', ')
                    FROM order_items oi
                    INNER JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = o.id
                ) AS products_summary
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.admin_approved = 0
           AND o.payment_status IN ('paid', 'cod')
         ORDER BY o.id DESC`
    );

    return rows;
};

const listAwaitingPaymentForAdmin = async () => {
    const [rows] = await db.execute(
        `SELECT o.id,
                o.total_amount AS total_price,
                o.delivery_address,
                o.payment_status,
                o.payment_deadline_at,
                o.createdAt,
                u.first_name,
                u.last_name,
                u.email AS customer_email
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.admin_approved = 0
           AND o.payment_status = 'unpaid'
           AND (o.payment_deadline_at IS NULL OR o.payment_deadline_at > NOW())
         ORDER BY o.id DESC`
    );

    return rows;
};

const deductStockForOrder = async (conn, orderId) => {
    const [items] = await conn.execute(
        'SELECT product_id, quantity, color_variant_id FROM order_items WHERE order_id = ?',
        [orderId]
    );

    for (const row of items || []) {
        const qty = Number(row.quantity);
        const pid = Number(row.product_id);
        const variantId =
            row.color_variant_id != null && row.color_variant_id !== ''
                ? Number(row.color_variant_id)
                : null;

        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(pid) || pid <= 0) {
            return false;
        }

        if (variantId && Number.isFinite(variantId) && variantId > 0) {
            const ok = await ProductColorVariant.deductStock(conn, variantId, qty);
            if (!ok) {
                return false;
            }
            continue;
        }

        const [stockResult] = await conn.execute(
            `UPDATE products
             SET stock_quantity = stock_quantity - ?
             WHERE id = ?
               AND stock_quantity >= ?`,
            [qty, pid, qty]
        );
        if (!stockResult || stockResult.affectedRows <= 0) {
            return false;
        }
    }

    return true;
};

const approveForAdmin = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return { ok: false, code: 'bad_id' };
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [orderRows] = await conn.execute(
            `SELECT o.id, o.status_id, o.payment_status, s.status_name
             FROM orders o
             INNER JOIN statuses s ON o.status_id = s.id
             WHERE o.id = ?
               AND o.admin_approved = 0
               AND o.cancel_request_at IS NULL
             LIMIT 1
             FOR UPDATE`,
            [oid]
        );

        const order = orderRows && orderRows[0];
        if (!order) {
            await conn.rollback();
            return { ok: false, code: 'not_found' };
        }

        const pay = String(order.payment_status || '');
        if (pay !== 'paid' && pay !== 'cod') {
            await conn.rollback();
            return { ok: false, code: 'not_paid' };
        }

        const stockOk = await deductStockForOrder(conn, oid);
        if (!stockOk) {
            await conn.rollback();
            return { ok: false, code: 'no_stock' };
        }

        let nextStatusId = Number(order.status_id);
        if (order.status_name === 'pending') {
            const confirmedId = await getStatusIdByName('confirmed');
            if (confirmedId) {
                const can = await StatusModel.canTransition(order.status_id, confirmedId);
                if (can) {
                    nextStatusId = confirmedId;
                }
            }
        }

        const [result] = await conn.execute(
            `UPDATE orders
             SET admin_approved = 1,
                 status_id = ?
             WHERE id = ? AND admin_approved = 0`,
            [nextStatusId, oid]
        );

        if (!result || result.affectedRows <= 0) {
            await conn.rollback();
            return { ok: false, code: 'not_found' };
        }

        await conn.commit();
        return { ok: true };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const rejectForAdmin = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }

    const cancelledId = await getStatusIdByName('cancelled');
    if (!cancelledId) {
        return false;
    }

    const [beforeRows] = await db.execute(
        'SELECT status_id FROM orders WHERE id = ? AND admin_approved = 0 LIMIT 1',
        [oid]
    );
    if (!beforeRows || !beforeRows[0]) {
        return false;
    }

    const fromStatusId = Number(beforeRows[0].status_id);

    const [result] = await db.execute(
        `UPDATE orders
         SET admin_approved = -1, status_id = ?
         WHERE id = ? AND admin_approved = 0`,
        [cancelledId, oid]
    );

    if (!result || result.affectedRows <= 0) {
        return false;
    }

    try {
        await OrderStatusLog.insert({
            order_id: oid,
            user_id: null,
            from_status_id: fromStatusId,
            to_status_id: cancelledId
        });
    } catch (err) {
        console.error('rejectForAdmin log:', err.message);
    }

    return true;
};

const updateStatusById = async (orderId, statusId) => {
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

const updateStatusIfCurrent = async (orderId, fromStatusId, toStatusId) => {
    const oid = Number(orderId);
    const fromId = Number(fromStatusId);
    const toId = Number(toStatusId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }
    if (!Number.isFinite(fromId) || fromId <= 0 || !Number.isFinite(toId) || toId <= 0) {
        return false;
    }
    if (fromId === toId) {
        return true;
    }

    const [result] = await db.execute(
        `UPDATE orders
         SET status_id = ?
         WHERE id = ? AND status_id = ?`,
        [toId, oid, fromId]
    );

    return result && result.affectedRows > 0;
};

const updateStatusByWarehouse = async (orderId, statusId, fromStatusId) => {
    if (Number.isFinite(fromStatusId) && fromStatusId > 0) {
        return updateStatusIfCurrent(orderId, fromStatusId, statusId);
    }
    return updateStatusById(orderId, statusId);
};

const updateStatusByCourier = async (orderId, statusId, fromStatusId) => {
    if (Number.isFinite(fromStatusId) && fromStatusId > 0) {
        return updateStatusIfCurrent(orderId, fromStatusId, statusId);
    }
    return updateStatusById(orderId, statusId);
};

const getByIdForStatusChange = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT id, status_id, payment_status, admin_approved
         FROM orders
         WHERE id = ?
         LIMIT 1`,
        [oid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const belongsToUser = async (orderId, userId) => {
    const oid = Number(orderId);
    const uid = Number(userId);
    if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const [rows] = await db.execute(
        'SELECT id FROM orders WHERE id = ? AND user_id = ? LIMIT 1',
        [oid, uid]
    );

    return rows && rows.length > 0;
};

const getSummaryById = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT o.id, o.user_id, o.total_amount, o.payment_status, o.delivery_address,
                o.receiver_name, o.receiver_phone, o.createdAt, o.admin_approved
         FROM orders o
         WHERE o.id = ?
         LIMIT 1`,
        [oid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const getByIdForPayment = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT id, user_id, total_amount, payment_status, createdAt, payment_deadline_at, admin_approved, liqpay_last_ref, cancel_request_at
         FROM orders
         WHERE id = ?
         LIMIT 1`,
        [oid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const updateLiqpayLastRef = async (orderId, liqpayRef) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }

    const ref = typeof liqpayRef === 'string' ? liqpayRef.trim() : '';
    if (!ref) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE orders
         SET liqpay_last_ref = ?
         WHERE id = ?`,
        [ref, oid]
    );

    return result && result.affectedRows > 0;
};

const updatePaymentStatus = async (orderId, paymentStatus) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }

    let sql = 'UPDATE orders SET payment_status = ?';
    const params = [paymentStatus];

    if (paymentStatus === 'paid') {
        sql += ', paid_at = COALESCE(paid_at, NOW())';
    }

    sql += ' WHERE id = ?';
    params.push(oid);

    const [result] = await db.execute(sql, params);

    return result && result.affectedRows > 0;
};

const listForAdminAll = async ({ filter, search }) => {
    let sql = `
        SELECT o.id,
               o.total_amount AS total_price,
               o.delivery_address,
               o.delivery_date,
               o.delivery_timeslot,
               o.payment_status,
               o.paid_at,
               o.receiver_name,
               o.receiver_phone,
               o.admin_approved,
               o.cancel_request_at,
               o.cancel_request_note,
               o.refund_status,
               o.createdAt,
               o.delivery_method,
               o.courier_id,
               s.status_name,
               s.label_uk AS status_label,
               u.first_name,
               u.last_name,
               u.email AS customer_email,
               u.phone AS customer_phone,
               NULLIF(
                   TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))),
                   ''
               ) AS courier_name
        FROM orders o
        INNER JOIN statuses s ON o.status_id = s.id
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN users cu ON o.courier_id = cu.id
    `;

    const params = [];
    const where = [];

    const f = typeof filter === 'string' ? filter.trim() : 'all';
    if (f === 'pending') {
        where.push('o.admin_approved = 0');
    } else if (f === 'rejected') {
        where.push('o.admin_approved = -1');
    } else if (f === 'warehouse') {
        where.push('o.admin_approved = 1');
        where.push("s.status_name IN ('confirmed', 'processing', 'ready_for_pickup', 'shipped')");
    } else if (f === 'unassigned') {
        where.push('o.admin_approved = 1');
        where.push("s.status_name IN ('processing', 'ready_for_pickup')");
        where.push('o.courier_id IS NULL');
        where.push("o.delivery_method <> 'pickup'");
    } else if (f === 'cancel_requests') {
        where.push('o.cancel_request_at IS NOT NULL');
        where.push("s.status_name NOT IN ('cancelled')");
    } else if (f === 'awaiting_unpaid') {
        where.push('o.admin_approved = 0');
        where.push("o.payment_status = 'unpaid'");
        where.push('(o.payment_deadline_at IS NULL OR o.payment_deadline_at > NOW())');
    }

    const q = typeof search === 'string' ? search.trim() : '';
    if (q !== '') {
        const num = Number(q);
        if (Number.isFinite(num) && num > 0) {
            where.push('o.id = ?');
            params.push(num);
        } else {
            const like = `%${q}%`;
            where.push(`(
                u.phone LIKE ? OR o.receiver_phone LIKE ? OR u.email LIKE ?
                OR u.first_name LIKE ? OR u.last_name LIKE ?
                OR o.receiver_name LIKE ? OR o.delivery_address LIKE ?
            )`);
            params.push(like, like, like, like, like, like, like);
        }
    }

    if (where.length > 0) {
        sql += ' WHERE ' + where.join(' AND ');
    }

    sql += ' ORDER BY o.id DESC LIMIT 200';

    const [rows] = await db.execute(sql, params);
    return rows;
};

const countUnassignedCourier = async () => {
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS c FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.admin_approved = 1
           AND s.status_name IN ('processing', 'ready_for_pickup')
           AND o.courier_id IS NULL
           AND o.delivery_method <> 'pickup'`
    );
    return Number(rows && rows[0] ? rows[0].c : 0) || 0;
};

const getDetailForAdmin = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [orderRows] = await db.execute(
        `SELECT o.id,
                o.total_amount AS total_price,
                o.delivery_address,${ORDER_DELIVERY_STRUCT_SQL}
                o.delivery_date,
                o.delivery_timeslot,
                o.payment_status,
                o.paid_at,
                o.payment_deadline_at,
                o.refunded_at,
                o.receiver_name,
                o.receiver_phone,
                o.admin_approved,
                o.cancel_request_at,
                o.cancel_request_note,
                o.refund_status,
                o.liqpay_last_ref,
                o.createdAt,
                o.delivery_method,
                o.courier_id,
                s.status_name,
                s.label_uk AS status_label,
                u.first_name,
                u.last_name,
                u.email AS customer_email,
                u.phone AS customer_phone,
                NULLIF(
                    TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))),
                    ''
                ) AS courier_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN users cu ON o.courier_id = cu.id
         WHERE o.id = ?
         LIMIT 1`,
        [oid]
    );

    if (!orderRows || orderRows.length === 0) {
        return null;
    }

    const [items] = await db.execute(
        `SELECT oi.quantity,
                oi.price_at_purchase AS unit_price,
                p.name AS product_name,
                pcv.flower_color AS color_name
         FROM order_items oi
         INNER JOIN products p ON p.id = oi.product_id
         LEFT JOIN product_color_variants pcv ON pcv.id = oi.color_variant_id
         WHERE oi.order_id = ?`,
        [oid]
    );

    const status_log = await OrderStatusLog.listByOrderId(oid);

    return {
        order: orderRows[0],
        items: items || [],
        status_log: status_log || []
    };
};

const getByIdForCancelCheck = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.user_id,
                o.total_amount,
                o.payment_status,
                o.admin_approved,
                o.delivery_date,
                o.delivery_timeslot,
                o.cancel_request_at,
                o.liqpay_last_ref,
                s.status_name
         FROM orders o
         INNER JOIN statuses s ON s.id = o.status_id
         WHERE o.id = ?
         LIMIT 1`,
        [oid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const createCancelRequestForOrder = async (orderId, note) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }

    const text = typeof note === 'string' ? note.trim().slice(0, 500) : '';

    const [result] = await db.execute(
        `UPDATE orders
         SET cancel_request_at = NOW(), cancel_request_note = ?
         WHERE id = ? AND cancel_request_at IS NULL`,
        [text || null, oid]
    );

    return result && result.affectedRows > 0;
};

const getByIdForUserCancel = async (orderId, userId) => {
    const oid = Number(orderId);
    const uid = Number(userId);
    if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(uid) || uid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.user_id,
                o.total_amount,
                o.payment_status,
                o.admin_approved,
                o.delivery_date,
                o.delivery_timeslot,
                o.cancel_request_at,
                o.liqpay_last_ref,
                s.status_name
         FROM orders o
         INNER JOIN statuses s ON s.id = o.status_id
         WHERE o.id = ? AND o.user_id = ?
         LIMIT 1`,
        [oid, uid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const createCancelRequest = async (orderId, userId, note) => {
    const order = await getByIdForUserCancel(orderId, userId);
    if (!order || order.cancel_request_at) {
        return false;
    }

    const text = typeof note === 'string' ? note.trim().slice(0, 500) : '';

    const [result] = await db.execute(
        `UPDATE orders
         SET cancel_request_at = NOW(), cancel_request_note = ?
         WHERE id = ? AND user_id = ? AND cancel_request_at IS NULL`,
        [text || null, Number(orderId), Number(userId)]
    );

    return result && result.affectedRows > 0;
};

const getByIdForCancelAdmin = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT o.id,
                o.total_amount,
                o.payment_status,
                o.admin_approved,
                o.liqpay_last_ref,
                o.courier_id,
                o.cancel_request_at,
                o.cancel_request_note,
                s.status_name
         FROM orders o
         INNER JOIN statuses s ON s.id = o.status_id
         WHERE o.id = ?
         LIMIT 1`,
        [oid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const rejectCancelRequest = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE orders
         SET cancel_request_at = NULL, cancel_request_note = NULL
         WHERE id = ? AND cancel_request_at IS NOT NULL`,
        [oid]
    );

    return result && result.affectedRows > 0;
};

const restoreStockForOrder = async (conn, orderId) => {
    const [items] = await conn.execute(
        'SELECT product_id, quantity, color_variant_id FROM order_items WHERE order_id = ?',
        [orderId]
    );

    for (const row of items || []) {
        const qty = Number(row.quantity);
        const pid = Number(row.product_id);
        const variantId =
            row.color_variant_id != null && row.color_variant_id !== ''
                ? Number(row.color_variant_id)
                : null;

        if (!Number.isFinite(qty) || qty <= 0) {
            continue;
        }

        if (variantId && Number.isFinite(variantId) && variantId > 0) {
            await ProductColorVariant.restoreStock(conn, variantId, qty);
            continue;
        }

        if (Number.isFinite(pid) && pid > 0) {
            await conn.execute(
                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                [qty, pid]
            );
        }
    }
};

const finishCancelAfterApprove = async (orderId, refundStatus) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return false;
    }

    const status = typeof refundStatus === 'string' ? refundStatus.trim() : 'not_needed';
    const cancelledId = await getStatusIdByName('cancelled');
    if (!cancelledId) {
        return false;
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [orderRows] = await conn.execute(
            `SELECT id, status_id, payment_status, admin_approved, cancel_request_at
             FROM orders
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [oid]
        );

        const order = orderRows && orderRows[0];
        if (!order || !order.cancel_request_at) {
            await conn.rollback();
            return false;
        }

        const fromStatusId = Number(order.status_id);

        if (Number(order.admin_approved) === 1) {
            await restoreStockForOrder(conn, oid);
        }

        let paymentStatus = order.payment_status;
        let refundedAt = null;

        if (status === 'refunded') {
            paymentStatus = 'refunded';
            refundedAt = new Date();
        }

        let adminApproved = order.admin_approved;
        if (Number(adminApproved) === 0) {
            adminApproved = -1;
        }

        await conn.execute(
            `UPDATE orders
             SET status_id = ?,
                 payment_status = ?,
                 refund_status = ?,
                 refunded_at = ?,
                 admin_approved = ?,
                 courier_id = NULL,
                 assigned_at = NULL
             WHERE id = ?`,
            [cancelledId, paymentStatus, status, refundedAt, adminApproved, oid]
        );

        try {
            await OrderStatusLog.insert({
                order_id: oid,
                user_id: null,
                from_status_id: fromStatusId,
                to_status_id: cancelledId
            });
        } catch (logErr) {
            console.error('finishCancelAfterApprove log:', logErr.message);
        }

        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const archiveByUserId = async (orderId, userId) => {
    const oid = Number(orderId);
    const uid = Number(userId);
    if (!Number.isFinite(oid) || oid <= 0 || !Number.isFinite(uid) || uid <= 0) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE orders
         SET is_archived = 1
         WHERE id = ? AND user_id = ? AND COALESCE(is_archived, 0) = 0`,
        [oid, uid]
    );

    return result && result.affectedRows > 0;
};

const getByIdForWarehouse = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT o.id, o.status_id, o.delivery_method, o.courier_id, o.payment_status, s.status_name, o.cancel_request_at
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.id = ?
           AND o.admin_approved = 1
           AND o.payment_status IN ('paid', 'cod')
         LIMIT 1`,
        [oid]
    );

    return rows && rows.length > 0 ? rows[0] : null;
};

const completePickupByWarehouse = async (orderId, { confirmCod } = {}) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return { ok: false, code: 'bad_id' };
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [orderRows] = await conn.execute(
            `SELECT o.id, o.status_id, o.payment_status, o.delivery_method, s.status_name
             FROM orders o
             INNER JOIN statuses s ON o.status_id = s.id
             WHERE o.id = ?
               AND o.admin_approved = 1
               AND o.delivery_method = 'pickup'
               AND o.cancel_request_at IS NULL
             LIMIT 1
             FOR UPDATE`,
            [oid]
        );

        const order = orderRows && orderRows[0];
        if (!order) {
            await conn.rollback();
            return { ok: false, code: 'not_found' };
        }

        if (order.status_name !== 'ready_for_pickup' && order.status_name !== 'delivered') {
            await conn.rollback();
            return { ok: false, code: 'not_ready' };
        }

        const pay = String(order.payment_status || '');
        if (pay === 'cod') {
            if (!confirmCod) {
                await conn.rollback();
                return { ok: false, code: 'need_cod_confirm' };
            }
            await conn.execute(
                `UPDATE orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, NOW()) WHERE id = ?`,
                [oid]
            );
        } else if (pay !== 'paid') {
            await conn.rollback();
            return { ok: false, code: 'not_paid' };
        }

        let currentStatusId = Number(order.status_id);
        let currentStatusName = order.status_name;

        if (currentStatusName === 'ready_for_pickup') {
            const deliveredId = await getStatusIdByName('delivered');
            if (!deliveredId) {
                await conn.rollback();
                return { ok: false, code: 'no_status' };
            }
            const canDeliver = await StatusModel.canTransition(currentStatusId, deliveredId);
            if (!canDeliver) {
                await conn.rollback();
                return { ok: false, code: 'invalid_transition' };
            }
            await conn.execute('UPDATE orders SET status_id = ? WHERE id = ?', [deliveredId, oid]);
            currentStatusId = deliveredId;
            currentStatusName = 'delivered';
        }

        const acceptedId = await getStatusIdByName('accepted');
        if (!acceptedId) {
            await conn.rollback();
            return { ok: false, code: 'no_status' };
        }

        const canAccept = await StatusModel.canTransition(currentStatusId, acceptedId);
        if (!canAccept) {
            await conn.rollback();
            return { ok: false, code: 'invalid_transition' };
        }

        await conn.execute('UPDATE orders SET status_id = ? WHERE id = ?', [acceptedId, oid]);

        await conn.commit();
        return {
            ok: true,
            from_status_id: Number(order.status_id),
            to_status_id: acceptedId,
            via_status_name: currentStatusName
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const cancelExpiredUnpaidOrders = async () => {
    const cancelledId = await getStatusIdByName('cancelled');
    if (!cancelledId) {
        return { count: 0, ids: [] };
    }

    const [rows] = await db.execute(
        `SELECT o.id, o.status_id
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.payment_status = 'unpaid'
           AND o.admin_approved = 0
           AND o.payment_deadline_at IS NOT NULL
           AND o.payment_deadline_at <= NOW()
           AND s.status_name = 'pending'
           AND o.cancel_request_at IS NULL`
    );

    if (!rows || rows.length === 0) {
        return { count: 0, ids: [] };
    }

    const cancelledIds = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const oid = Number(row.id);
        const fromStatusId = Number(row.status_id);

        const [result] = await db.execute(
            `UPDATE orders
             SET status_id = ?, admin_approved = -1
             WHERE id = ? AND admin_approved = 0 AND payment_status = 'unpaid'`,
            [cancelledId, oid]
        );

        if (!result || result.affectedRows <= 0) {
            continue;
        }

        cancelledIds.push(oid);

        try {
            await OrderStatusLog.insert({
                order_id: oid,
                user_id: null,
                from_status_id: fromStatusId,
                to_status_id: cancelledId
            });
        } catch (logErr) {
            console.error('cancelExpired log:', logErr.message);
        }
    }

    return { count: cancelledIds.length, ids: cancelledIds };
};

const getDetailForWarehouse = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    const [orderRows] = await db.execute(
        `SELECT o.id,
                o.total_amount AS total_price,
                o.delivery_address,
                o.customer_first_name,
                o.customer_last_name,
                o.customer_phone,
                o.delivery_street,
                o.delivery_house,
                o.delivery_apartment,
                o.recipient_note,
                o.bouquet_note,
                o.delivery_date,
                o.delivery_timeslot,
                o.delivery_method,
                o.payment_status,
                o.receiver_name,
                o.receiver_phone,
                o.cancel_request_at,
                o.cancel_request_note,
                o.courier_id,
                o.user_id,
                o.status_id,
                s.status_name,
                s.label_uk AS status_label,
                NULLIF(
                    TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))),
                    ''
                ) AS courier_name,
                COALESCE(NULLIF(TRIM(o.customer_email), ''), u.email, '') AS customer_email,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                    NULLIF(TRIM(CONCAT(COALESCE(o.customer_first_name, ''), ' ', COALESCE(o.customer_last_name, ''))), ''),
                    o.receiver_name,
                    'Гість'
                ) AS customer_name
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN users cu ON o.courier_id = cu.id
         WHERE o.id = ?
           AND o.admin_approved = 1
           AND o.payment_status IN ('paid', 'cod')
           AND s.status_name NOT IN ('cancelled')
         LIMIT 1`,
        [oid]
    );

    if (!orderRows || orderRows.length === 0) {
        return null;
    }

    const [items] = await db.execute(
        `SELECT oi.quantity,
                oi.price_at_purchase AS unit_price,
                oi.color_variant_id,
                p.name AS product_name,
                p.unit_type,
                COALESCE(v.stock_quantity, p.stock_quantity) AS stock_quantity,
                v.flower_color
         FROM order_items oi
         INNER JOIN products p ON p.id = oi.product_id
         LEFT JOIN product_color_variants v ON v.id = oi.color_variant_id
         WHERE oi.order_id = ?`,
        [oid]
    );

    return {
        order: orderRows[0],
        items: items || []
    };
};

const findLastDeliveredHighlight = async () => {
    const [fromLog] = await db.execute(
        `SELECT o.id AS order_id,
                o.delivery_address,
                o.delivery_method,
                p.id AS product_id,
                p.name AS product_name,
                p.slug AS product_slug,
                p.image_url,
                log_row.delivered_at
         FROM (
            SELECT l.order_id, l.createdAt AS delivered_at, l.id AS log_id
            FROM order_status_log l
            INNER JOIN statuses ts ON l.to_status_id = ts.id AND ts.status_name = 'delivered'
            ORDER BY l.createdAt DESC, l.id DESC
            LIMIT 1
         ) log_row
         INNER JOIN orders o ON o.id = log_row.order_id
         INNER JOIN statuses os ON o.status_id = os.id AND os.status_name = 'delivered'
         INNER JOIN order_items oi ON oi.order_id = o.id
         INNER JOIN products p ON p.id = oi.product_id
         WHERE IFNULL(p.is_constructor, 0) = 0
         ORDER BY oi.id ASC
         LIMIT 1`
    );

    if (fromLog && fromLog.length > 0) {
        return fromLog[0];
    }

    const [fallback] = await db.execute(
        `SELECT o.id AS order_id,
                o.delivery_address,
                o.delivery_method,
                p.id AS product_id,
                p.name AS product_name,
                p.slug AS product_slug,
                p.image_url,
                NULL AS delivered_at
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id AND s.status_name = 'delivered'
         INNER JOIN order_items oi ON oi.order_id = o.id
         INNER JOIN products p ON p.id = oi.product_id
         WHERE IFNULL(p.is_constructor, 0) = 0
         ORDER BY o.id DESC, oi.id ASC
         LIMIT 1`
    );

    if (!fallback || fallback.length === 0) {
        return null;
    }

    return fallback[0];
};

module.exports = {
    createWithTransaction,
    normalizeItems,
    getStatusIdByName,
    getPendingStatusId,
    listByUserId,
    listForWarehouse,
    listForWarehouseHistory,
    listForWarehouseStats,
    listForCourier,
    listForCourierHistory,
    listForCourierStats,
    listIdsUnassignedReady,
    listActiveAssignmentsForDispatch,
    listAllForWarehouse,
    listPendingForAdmin,
    listAwaitingPaymentForAdmin,
    approveForAdmin,
    rejectForAdmin,
    updateStatusById,
    updateStatusIfCurrent,
    updateStatusByWarehouse,
    updateStatusByCourier,
    confirmCodPaidByCourier,
    closeByCourier,
    getByIdForAssign,
    assignCourier,
    unassignCourier,
    getByIdForStatusChange,
    belongsToUser,
    getSummaryById,
    getByIdForPayment,
    updateLiqpayLastRef,
    updatePaymentStatus,
    archiveByUserId,
    listForAdminAll,
    countUnassignedCourier,
    getDetailForAdmin,
    getByIdForWarehouse,
    getByIdForCourier,
    getDetailForWarehouse,
    getDetailForCourier,
    getByIdForUserCancel,
    getByIdForCancelCheck,
    createCancelRequestForOrder,
    createCancelRequest,
    getByIdForCancelAdmin,
    rejectCancelRequest,
    finishCancelAfterApprove,
    completePickupByWarehouse,
    cancelExpiredUnpaidOrders,
    findLastDeliveredHighlight
};