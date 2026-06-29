const HOURS_BEFORE_DELIVERY = 2;
const HOURS_BEFORE_DELIVERY_PROCESSING = 4;

const CANCELABLE_STATUSES = ['pending', 'confirmed', 'processing', 'ready_for_pickup'];
const TOO_LATE_STATUSES = ['shipped', 'delivered', 'accepted', 'rejected', 'cancelled'];

const parseDeliveryDateTime = (order) => {
    if (!order || !order.delivery_date) {
        return null;
    }

    const datePart = String(order.delivery_date).trim().slice(0, 10);
    let slot = order.delivery_timeslot ? String(order.delivery_timeslot).trim() : '';
    if (slot.length >= 5) {
        slot = slot.slice(0, 5);
    } else {
        slot = '12:00';
    }

    const dt = new Date(datePart + 'T' + slot + ':00');
    if (!Number.isFinite(dt.getTime())) {
        return null;
    }

    return dt;
};

const hoursUntilDelivery = (order) => {
    const dt = parseDeliveryDateTime(order);
    if (!dt) {
        return null;
    }

    return (dt.getTime() - Date.now()) / (1000 * 60 * 60);
};

const hasCancelRequest = (order) => {
    return !!(order && order.cancel_request_at);
};

const getCancelBlockReason = (order) => {
    if (!order) {
        return 'unknown';
    }

    const statusName = order.status_name ? String(order.status_name) : '';

    if (statusName === 'cancelled' || Number(order.admin_approved) === -1) {
        return 'already_cancelled';
    }

    if (hasCancelRequest(order)) {
        return 'pending_request';
    }

    if (TOO_LATE_STATUSES.includes(statusName)) {
        return 'too_late';
    }

    if (!CANCELABLE_STATUSES.includes(statusName)) {
        return 'too_late';
    }

    if (Number(order.admin_approved) === 0) {
        return 'ok';
    }

    const hoursLeft = hoursUntilDelivery(order);
    if (hoursLeft === null) {
        return 'ok';
    }

    if (hoursLeft <= 0) {
        return 'delivery_started';
    }

    if (statusName === 'processing') {
        if (hoursLeft < HOURS_BEFORE_DELIVERY_PROCESSING) {
            return 'processing_soon';
        }
        return 'ok';
    }

    if (statusName === 'ready_for_pickup') {
        if (hoursLeft < 1) {
            return 'too_soon';
        }
        return 'ok';
    }

    if (hoursLeft < HOURS_BEFORE_DELIVERY) {
        return 'too_soon';
    }

    return 'ok';
};

const canCustomerRequestCancel = (order) => {
    return getCancelBlockReason(order) === 'ok';
};

const getCancelBlockMessage = (reason) => {
    const map = {
        ok: '',
        unknown: 'Замовлення не знайдено',
        already_cancelled: 'Замовлення вже скасовано',
        pending_request: 'Запит на скасування уже надіслано',
        too_late: 'Замовлення вже передано кур\'єру — скасування через підтримку',
        delivery_started: 'Час доставки настав — скасувати онлайн не можна',
        too_soon: 'Скасувати можна не пізніше ніж за 2 години до доставки',
        processing_soon:
            'Букет уже збирають — скасувати можна лише за 4+ години до доставки. Зателефонуйте нам.'
    };

    return map[reason] || 'Скасування зараз недоступне';
};

const getRefundHintForCustomer = (order) => {
    if (!order) {
        return '';
    }

    const pay = order.payment_status;
    if (pay === 'paid') {
        return 'Після підтвердження адміном кошти повернуться на картку (3–10 банківських днів).';
    }
    if (pay === 'cod') {
        return 'Оплата при отриманні — після підтвердження замовлення просто не доставлять.';
    }
    if (pay === 'unpaid') {
        return 'Оплата не пройшла — після підтвердження скасування нічого сплачувати не потрібно.';
    }
    if (pay === 'refunded') {
        return 'Кошти вже повернено.';
    }

    return '';
};

module.exports = {
    HOURS_BEFORE_DELIVERY,
    HOURS_BEFORE_DELIVERY_PROCESSING,
    parseDeliveryDateTime,
    hoursUntilDelivery,
    hasCancelRequest,
    getCancelBlockReason,
    canCustomerRequestCancel,
    getCancelBlockMessage,
    getRefundHintForCustomer
};
