const OrderModel = require('../models/Order');
const liqpayService = require('./liqpayService');
const paymentApplyService = require('./paymentApplyService');

const syncOrderPaymentFromLiqpay = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return null;
    }

    let order = await OrderModel.getByIdForPayment(oid);
    if (!order) {
        return null;
    }

    if (order.payment_status === 'paid' || order.payment_status === 'cod') {
        return order;
    }

    if (!order.liqpay_last_ref) {
        return order;
    }

    try {
        const statusPayload = await liqpayService.fetchPaymentStatus(order.liqpay_last_ref);
        if (statusPayload && paymentApplyService.isIncomingPaid(statusPayload)) {
            await paymentApplyService.applyLiqpayStatus(oid, statusPayload);
            order = await OrderModel.getByIdForPayment(oid);
        }
    } catch (err) {
        console.error('syncOrderPaymentFromLiqpay:', err.message);
    }

    return order;
};

module.exports = {
    syncOrderPaymentFromLiqpay
};
