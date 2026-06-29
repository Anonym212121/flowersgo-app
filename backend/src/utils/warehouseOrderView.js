const formatDelivery = require('./formatDelivery');
const orderDeliveryFields = require('./orderDeliveryFields');
const {
    extractRecipientNote,
    extractCustomerEmail
} = require('./orderDeliveryLegacyParse');
const { buildPhoneLinks } = require('./phoneMessengerLinks');
const { buildDeliveryDateTime } = require('./deliveryDateTime');

const LOW_STOCK_LIMIT = 5;

const getWarehouseUrgency = (row) => {
    const doneStatuses = ['delivered', 'accepted', 'rejected', 'cancelled'];
    const statusName = row && row.status_name ? String(row.status_name) : '';

    const result = {
        isExpress: row && row.delivery_method === 'express',
        isSoon: false,
        isOverdue: false
    };

    if (doneStatuses.includes(statusName)) {
        return result;
    }

    const deliveryAt = buildDeliveryDateTime(row);
    if (!deliveryAt) {
        return result;
    }

    const now = new Date();
    const diffHours = (deliveryAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours <= 3 && diffHours >= -0.5) {
        result.isSoon = true;
    }
    if (diffHours < -1) {
        result.isOverdue = true;
    }

    return result;
};

const buildWarehouseStats = (rows) => {
    let today = 0;
    let express = 0;
    let soon = 0;
    let overdue = 0;
    let cancelPending = 0;
    let unassignedCourier = 0;

    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    const list = Array.isArray(rows) ? rows : [];

    for (const row of list) {
        if (row.cancel_request_at) {
            cancelPending++;
        }

        if (
            (row.status_name === 'ready_for_pickup' || row.status_name === 'processing') &&
            !row.courier_id &&
            row.delivery_method !== 'pickup'
        ) {
            unassignedCourier++;
        }

        if (row.delivery_date) {
            let d = null;
            if (row.delivery_date instanceof Date && !Number.isNaN(row.delivery_date.getTime())) {
                d = row.delivery_date;
            } else {
                const text = String(row.delivery_date).trim();
                const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (m) {
                    d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                }
            }
            if (d && d.getFullYear() === todayY && d.getMonth() === todayM && d.getDate() === todayD) {
                today++;
            }
        }

        if (row.delivery_method === 'express') {
            express++;
        }

        const urgency = getWarehouseUrgency(row);
        if (urgency.isSoon) {
            soon++;
        }
        if (urgency.isOverdue) {
            overdue++;
        }
    }

    let maxOrderId = 0;
    for (const row of list) {
        const id = Number(row.id);
        if (Number.isFinite(id) && id > maxOrderId) {
            maxOrderId = id;
        }
    }

    return {
        total: list.length,
        today,
        express,
        soon,
        overdue,
        cancel_pending: cancelPending,
        unassigned_courier: unassignedCourier,
        max_order_id: maxOrderId
    };
};

const isDeliveryToday = (deliveryDate) => {
    if (!deliveryDate) {
        return false;
    }

    const now = new Date();
    let d = null;

    if (deliveryDate instanceof Date && !Number.isNaN(deliveryDate.getTime())) {
        d = deliveryDate;
    } else {
        const text = String(deliveryDate).trim();
        const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
            d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        }
    }

    if (!d) {
        return false;
    }

    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
};

const filterWarehouseOrdersByTab = (orders, tab) => {
    const key = typeof tab === 'string' ? tab.trim() : '';
    if (!key || key === 'total') {
        return orders;
    }

    const list = Array.isArray(orders) ? orders : [];

    if (key === 'today') {
        return list.filter((o) => isDeliveryToday(o.delivery_date));
    }
    if (key === 'express') {
        return list.filter((o) => o.delivery_method === 'express');
    }
    if (key === 'overdue') {
        return list.filter((o) => o.is_overdue);
    }
    if (key === 'soon') {
        return list.filter((o) => o.is_soon && !o.is_overdue);
    }
    if (key === 'cancel') {
        return list.filter((o) => o.cancel_request_at);
    }
    if (key === 'unassigned') {
        return list.filter((o) => o.needs_courier);
    }

    return list;
};

const mapOrderForWarehouse = (row) => {
    const withDate = formatDelivery.withDeliveryDisplay(row);
    const urgency = getWarehouseUrgency(row);
    const phoneLinks = buildPhoneLinks(row.receiver_phone);
    const needsCourier =
        (row.status_name === 'ready_for_pickup' || row.status_name === 'processing') &&
        !row.courier_id &&
        row.delivery_method !== 'pickup';

    return {
        ...withDate,
        delivery_place_display: orderDeliveryFields.formatDeliveryPlaceFromRow(row),
        recipient_note: orderDeliveryFields.recipientNoteFromRow(row),
        bouquet_note: orderDeliveryFields.bouquetNoteFromRow(row),
        phone_links: phoneLinks,
        courier_name: row.courier_name || '',
        needs_courier: needsCourier,
        is_express: urgency.isExpress,
        is_soon: urgency.isSoon,
        is_overdue: urgency.isOverdue
    };
};

module.exports = {
    LOW_STOCK_LIMIT,
    extractRecipientNote,
    extractCustomerEmail,
    buildWarehouseStats,
    filterWarehouseOrdersByTab,
    mapOrderForWarehouse
};
