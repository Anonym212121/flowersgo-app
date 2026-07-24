const OrderModel = require('../models/Order');
const liqpayService = require('./liqpayService');
const paymentApplyService = require('./paymentApplyService');
const paymentService = require('./paymentService');

const repairLegacyPaidStatus = async (orderId, order) => {
    if (!order || !paymentService.isLegacyLiqpayPaidStatus(order.payment_status)) {
        return order;
    }

    await OrderModel.updatePaymentStatus(orderId, 'paid');
    return OrderModel.getByIdForPayment(orderId);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPaymentStatusWithRetry = async (orderRef, options) => {
    const opts = options || {};
    const maxAttempts = opts.quick ? 1 : 2;
    const timeoutMs = opts.quick ? 4000 : 8000;
    const retryDelayMs = opts.quick ? 0 : 1200;
    let lastPayload = null;

    for (let i = 0; i < maxAttempts; i += 1) {
        try {
            const payload = await liqpayService.fetchPaymentStatus(orderRef, { timeoutMs });
            lastPayload = payload;

            if (payload && paymentApplyService.isIncomingPaid(payload)) {
                return payload;
            }

            if (payload && payload.status && payload.status !== 'processing') {
                return payload;
            }
        } catch (err) {
            console.error('fetchPaymentStatusWithRetry:', err.message);
        }

        if (i < maxAttempts - 1 && retryDelayMs > 0) {
            await sleep(retryDelayMs);
        }
    }

    return lastPayload;
};

const syncOrderPaymentFromLiqpay = async (orderId, options) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    let order = await OrderModel.getByIdForPayment(oid);
    if (!order) {
        return null;
    }

    order = await repairLegacyPaidStatus(oid, order);
    if (!order) {
        return null;
    }

    if (paymentService.isPaymentPaid(order) || order.payment_status === 'cod') {
        return order;
    }

    if (!order.liqpay_last_ref) {
        return order;
    }

    try {
        const statusPayload = await fetchPaymentStatusWithRetry(order.liqpay_last_ref, options);
        if (statusPayload && paymentApplyService.isIncomingPaid(statusPayload)) {
            await paymentApplyService.applyLiqpayStatus(oid, statusPayload);
            order = await OrderModel.getByIdForPayment(oid);
            order = await repairLegacyPaidStatus(oid, order);
        }
    } catch (err) {
        console.error('syncOrderPaymentFromLiqpay:', err.message);
    }

    return order;
};

module.exports = {
    repairLegacyPaidStatus,
    syncOrderPaymentFromLiqpay
};
