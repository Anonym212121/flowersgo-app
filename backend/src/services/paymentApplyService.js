const db = require('../config/db');
const OrderModel = require('../models/Order');
const StatusModel = require('../models/Status');
const OrderStatusLogModel = require('../models/OrderStatusLog');
const orderRoleNotifyService = require('./orderRoleNotifyService');
const orderWarehouseNotifyService = require('./orderWarehouseNotifyService');
const orderDispatchService = require('./orderDispatchService');
const paymentService = require('./paymentService');
const liqpayService = require('./liqpayService');

const PAID_LIQPAY_STATUSES = ['success', 'sandbox', 'wait_accept'];
const REFUND_OK = ['reversed', 'success', 'sandbox', 'wait_accept'];

const isIncomingPaid = (payload) => {
    if (!payload || !payload.status) {
        return false;
    }
    return PAID_LIQPAY_STATUSES.includes(String(payload.status));
};

const tryRefundIncoming = (payload, amount) => {
    setImmediate(() => {
        tryRefundIncomingAsync(payload, amount).catch((err) => {
            console.error('tryRefundIncoming:', err.message);
        });
    });
};

const tryRefundIncomingAsync = async (payload, amount) => {
    const ref = payload && payload.order_id ? String(payload.order_id).trim() : '';
    const sum = Number(amount);
    if (!ref || !Number.isFinite(sum) || sum <= 0) {
        return { ok: false, message: 'Немає даних для повернення' };
    }

    const keys = liqpayService.getKeys();
    if (!keys.publicKey || !keys.privateKey) {
        return { ok: false, message: 'LiqPay не налаштовано' };
    }

    try {
        const result = await liqpayService.refundPayment(ref, sum);
        if (result && REFUND_OK.includes(result.status)) {
            return { ok: true, message: 'Кошти повернено через LiqPay' };
        }
        return { ok: false, message: 'LiqPay не підтвердив повернення' };
    } catch (err) {
        return { ok: false, message: 'Помилка LiqPay при поверненні' };
    }
};

const isOrderClosedForPayment = (order, options) => {
    if (!order) {
        return true;
    }
    if (Number(order.admin_approved) === -1) {
        return true;
    }
    if (order.cancel_request_at) {
        return true;
    }
    const statusName = order.status_name ? String(order.status_name) : '';
    if (statusName === 'cancelled') {
        return true;
    }
    if (options && options.ignorePaymentWindow) {
        return false;
    }
    if (order.payment_status === 'unpaid' && !paymentService.isPaymentWindowOpenForOrder(order)) {
        return true;
    }
    return false;
};

const loadOrderForPaymentApply = async (orderId) => {
    const oid = Number(orderId);
    const [rows] = await db.execute(
        `SELECT o.id,
                o.user_id,
                o.status_id,
                o.total_amount,
                o.payment_status,
                o.payment_deadline_at,
                o.createdAt,
                o.admin_approved,
                o.cancel_request_at,
                o.liqpay_last_ref,
                s.status_name
         FROM orders o
         INNER JOIN statuses s ON s.id = o.status_id
         WHERE o.id = ?
         LIMIT 1`,
        [oid]
    );
    return rows && rows[0] ? rows[0] : null;
};

const markOrderPaidFromLiqpay = async (order, payload) => {
    const oid = Number(order.id);

    if (order.payment_status === 'paid' || order.payment_status === 'cod') {
        return { ok: true, reason: 'already_paid' };
    }

    if (paymentService.isLegacyLiqpayPaidStatus(order.payment_status)) {
        await OrderModel.updatePaymentStatus(oid, 'paid');
        return { ok: true, reason: 'already_paid' };
    }

    if (isOrderClosedForPayment(order, { ignorePaymentWindow: true })) {
        tryRefundIncoming(payload, order.total_amount);
        return { ok: false, reason: 'closed_refunded' };
    }

    const incomingAmount = Number(payload.amount);
    const orderAmount = Number(order.total_amount);
    if (Number.isFinite(incomingAmount) && Number.isFinite(orderAmount)) {
        if (Math.abs(incomingAmount - orderAmount) > 0.015) {
            tryRefundIncoming(payload, incomingAmount);
            return { ok: false, reason: 'amount_mismatch' };
        }
    }

    await OrderModel.updatePaymentStatus(oid, 'paid');

    if (order.status_name === 'pending') {
        const confirmedId = await OrderModel.getStatusIdByName('confirmed');
        const fromStatusId = Number(order.status_id);
        if (confirmedId && Number.isFinite(fromStatusId) && fromStatusId !== confirmedId) {
            const can = await StatusModel.canTransition(fromStatusId, confirmedId);
            if (can) {
                const ok = await OrderModel.updateStatusIfCurrent(oid, fromStatusId, confirmedId);
                if (ok) {
                    await OrderStatusLogModel.insert({
                        order_id: oid,
                        user_id: null,
                        from_status_id: fromStatusId,
                        to_status_id: confirmedId
                    });
                }
            }
        }
    }

    try {
        await orderRoleNotifyService.onNewOrderForAdmin(oid);
    } catch (notifyErr) {
        console.error('onNewOrderForAdmin:', notifyErr.message);
    }

    try {
        await orderWarehouseNotifyService.notifyCustomerPaymentSuccess(oid);
    } catch (notifyErr) {
        console.error('notifyCustomerPaymentSuccess:', notifyErr.message);
    }

    try {
        await orderDispatchService.dispatchToWarehouse(oid);
    } catch (dispatchErr) {
        console.error('dispatchToWarehouse after pay:', dispatchErr.message);
    }

    return { ok: true, reason: 'paid' };
};

const applyLiqpayStatus = async (orderId, payload) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0 || !payload) {
        return { ok: false, reason: 'bad_request' };
    }

    if (isIncomingPaid(payload)) {
        const order = await loadOrderForPaymentApply(oid);
        if (!order) {
            return { ok: false, reason: 'not_found' };
        }

        return markOrderPaidFromLiqpay(order, payload);
    }

    const order = await OrderModel.getByIdForPayment(oid);
    if (!order) {
        return { ok: false, reason: 'not_found' };
    }

    if (paymentService.isPaymentPaid(order) || order.payment_status === 'cod') {
        return { ok: true, reason: 'already_paid' };
    }

    return { ok: false, reason: 'not_paid' };
};

module.exports = {
    PAID_LIQPAY_STATUSES,
    applyLiqpayStatus,
    isIncomingPaid,
    isOrderClosedForPayment
};
