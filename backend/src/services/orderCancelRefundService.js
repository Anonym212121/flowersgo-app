const liqpayService = require('./liqpayService');

const REFUND_OK = ['reversed', 'success', 'sandbox', 'wait_accept'];

const tryRefundPaidOrder = async (order) => {
    if (!order || order.payment_status !== 'paid') {
        return { refund_status: 'not_needed', message: '' };
    }

    const amount = Number(order.total_amount);
    const ref = order.liqpay_last_ref ? String(order.liqpay_last_ref).trim() : '';

    if (!ref || !Number.isFinite(amount) || amount <= 0) {
        return {
            refund_status: 'manual',
            message: 'Немає даних LiqPay — повернення оформлює адмін вручну'
        };
    }

    const keys = liqpayService.getKeys();
    if (!keys.publicKey || !keys.privateKey) {
        return {
            refund_status: 'manual',
            message: 'LiqPay не налаштовано — повернення вручну'
        };
    }

    try {
        const result = await liqpayService.refundPayment(ref, amount);
        if (result && REFUND_OK.includes(result.status)) {
            return { refund_status: 'refunded', message: 'Кошти повернено на картку через LiqPay' };
        }

        const errText = result && result.err_description ? String(result.err_description) : '';
        return {
            refund_status: 'manual',
            message: errText || 'LiqPay не підтвердив повернення — адмін оформить вручну'
        };
    } catch (err) {
        return {
            refund_status: 'manual',
            message: 'Помилка LiqPay — повернення вручну'
        };
    }
};

module.exports = {
    tryRefundPaidOrder
};
