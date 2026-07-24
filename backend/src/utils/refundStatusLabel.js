const isOrderCancelled = (order) => {
    if (!order) {
        return false;
    }
    if (order.status_name === 'cancelled') {
        return true;
    }
    return Number(order.admin_approved) === -1;
};

const refundStatusLabel = (status) => {
    const s = String(status || '').trim();
    if (s === 'refunded') {
        return 'Кошти повернуто';
    }
    if (s === 'processing') {
        return 'Повернення обробляється';
    }
    if (s === 'pending') {
        return 'Очікує повернення коштів';
    }
    if (s === 'manual') {
        return 'Повернення вручну';
    }
    if (s === 'not_needed') {
        return 'Повернення не потрібне';
    }
    return s || '—';
};

const refundStatusHint = (order) => {
    if (!order || !isOrderCancelled(order)) {
        return '';
    }

    const refund = String(order.refund_status || '').trim();
    const pay = String(order.payment_status || '').trim();

    if (pay === 'refunded' || refund === 'refunded') {
        return 'Кошти повернено на картку. Зазвичай банк зараховує їх протягом 3–10 банківських днів.';
    }
    if (refund === 'processing') {
        return 'Ми ініціювали повернення через LiqPay. Кошти надійдуть на картку протягом 3–10 банківських днів.';
    }
    if (refund === 'pending') {
        return 'Замовлення скасовано. Повернення коштів обробляється — очікуйте зарахування на картку протягом 3–10 банківських днів.';
    }
    if (refund === 'manual') {
        return 'Повернення оформлює наша команда. Якщо кошти не надійдуть протягом 10 днів — зв’яжіться з підтримкою.';
    }

    return '';
};

const orderSummaryBadge = (order) => {
    if (!order) {
        return '—';
    }

    if (isOrderCancelled(order)) {
        const refund = String(order.refund_status || '').trim();
        const pay = String(order.payment_status || '').trim();
        if (pay === 'refunded' || refund === 'refunded') {
            return 'Скасовано · Повернено';
        }
        if (refund === 'processing' || refund === 'pending' || refund === 'manual') {
            return 'Скасовано · Повернення';
        }
        return 'Скасовано';
    }

    if (order.cancel_request_at || order.has_cancel_request) {
        return 'Скасування очікує';
    }

    if (Number(order.admin_approved) === 0) {
        return 'На модерації';
    }

    if (order.status_name === 'ready_for_pickup' && order.delivery_method === 'pickup') {
        return 'Готовий до самовивозу';
    }

    return order.status_label || order.status_name || '—';
};

const paymentBadgeForCabinet = (order) => {
    const pay = String(order && order.payment_status ? order.payment_status : 'unpaid').trim();
    const refund = String(order && order.refund_status ? order.refund_status : '').trim();
    const cancelled = isOrderCancelled(order);

    if (pay === 'refunded' || refund === 'refunded') {
        return { cls: 'pay-ok', text: 'Повернено' };
    }
    if (cancelled && (refund === 'processing' || refund === 'pending' || refund === 'manual')) {
        return { cls: 'pay-refund', text: 'Очікує повернення' };
    }
    if (pay === 'paid') {
        return { cls: 'pay-ok', text: 'Оплачено' };
    }
    if (pay === 'cod') {
        return { cls: 'pay-cod', text: 'При отриманні' };
    }
    if (cancelled) {
        return { cls: 'pay-no', text: 'Скасовано' };
    }
    if (order && (order.cancel_request_at || order.has_cancel_request)) {
        return { cls: 'pay-cod', text: 'Скасування очікує' };
    }
    return { cls: 'pay-no', text: 'Очікує' };
};

const refundNoteForEmail = (order) => {
    if (!order || !isOrderCancelled(order)) {
        return '';
    }

    const pay = String(order.payment_status || '').trim();
    if (pay !== 'paid' && pay !== 'refunded') {
        return '';
    }

    const hint = refundStatusHint(order);
    if (hint) {
        return hint;
    }

    if (pay === 'paid') {
        return 'Оплату карткою отримано — повернення коштів буде оформлено найближчим часом.';
    }

    return '';
};

module.exports = {
    isOrderCancelled,
    refundStatusLabel,
    refundStatusHint,
    orderSummaryBadge,
    paymentBadgeForCabinet,
    refundNoteForEmail
};
