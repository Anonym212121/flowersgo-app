const PAYMENT_WINDOW_MINUTES = 10;

const getPaymentDeadlineMs = (createdAt) => {
    const created = new Date(createdAt).getTime();
    if (!Number.isFinite(created)) {
        return null;
    }
    return created + PAYMENT_WINDOW_MINUTES * 60 * 1000;
};

const getPaymentDeadlineMsForOrder = (order) => {
    if (!order) {
        return null;
    }

    if (order.payment_deadline_at) {
        const fromColumn = new Date(order.payment_deadline_at).getTime();
        if (Number.isFinite(fromColumn)) {
            return fromColumn;
        }
    }

    return getPaymentDeadlineMs(order.createdAt);
};

const isPaymentWindowOpenForOrder = (order) => {
    const deadline = getPaymentDeadlineMsForOrder(order);
    if (!deadline) {
        return true;
    }
    return Date.now() < deadline;
};

const getSecondsLeftForOrder = (order) => {
    const deadline = getPaymentDeadlineMsForOrder(order);
    if (!deadline) {
        return 0;
    }

    const left = Math.floor((deadline - Date.now()) / 1000);
    if (left <= 0) {
        return 0;
    }

    return left;
};

const formatTimeLeft = (totalSeconds) => {
    const sec = Number(totalSeconds);
    if (!Number.isFinite(sec) || sec <= 0) {
        return '00:00:00';
    }

    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;

    return (
        String(hours).padStart(2, '0') +
        ':' +
        String(minutes).padStart(2, '0') +
        ':' +
        String(seconds).padStart(2, '0')
    );
};

const getPaymentDeadlineIsoForOrder = (order) => {
    const deadline = getPaymentDeadlineMsForOrder(order);
    if (!deadline) {
        return '';
    }

    return new Date(deadline).toISOString();
};

const canPayOnline = (order) => {
    return getPaymentBlockReason(order) === 'ok';
};

const getPaymentBlockReason = (order) => {
    if (!order) {
        return 'unknown';
    }
    if (order.payment_status === 'paid' || order.payment_status === 'cod' || order.payment_status === 'refunded') {
        return 'none';
    }
    if (order.cancel_request_at) {
        return 'cancel_pending';
    }
    if (Number(order.admin_approved) === -1) {
        return 'rejected';
    }
    if (!isPaymentWindowOpenForOrder(order)) {
        return 'expired';
    }
    return 'ok';
};

module.exports = {
    PAYMENT_WINDOW_MINUTES,
    getPaymentDeadlineMs,
    getPaymentDeadlineMsForOrder,
    getPaymentDeadlineIsoForOrder,
    getSecondsLeftForOrder,
    formatTimeLeft,
    isPaymentWindowOpenForOrder,
    canPayOnline,
    getPaymentBlockReason
};
