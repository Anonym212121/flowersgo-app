const db = require('../config/db');
const OrderModel = require('../models/Order');
const StatusModel = require('../models/Status');
const OrderStatusLogModel = require('../models/OrderStatusLog');
const orderRoleNotifyService = require('./orderRoleNotifyService');
const orderWarehouseNotifyService = require('./orderWarehouseNotifyService');
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

const tryRefundIncoming = async (payload, amount) => {
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

const isOrderClosedForPayment = (order) => {
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
    if (order.payment_status === 'unpaid' && !paymentService.isPaymentWindowOpenForOrder(order)) {
        return true;
    }
    return false;
};

const confirmPaidInTransaction = async (conn, order, toStatusId) => {
    const oid = Number(order.id);
    await conn.execute(
        `UPDATE orders
         SET payment_status = 'paid', paid_at = COALESCE(paid_at, NOW())
         WHERE id = ? AND payment_status = 'unpaid'`,
        [oid]
    );

    const fromStatusId = Number(order.status_id);
    if (Number.isFinite(toStatusId) && toStatusId > 0 && fromStatusId !== toStatusId) {
        const can = await StatusModel.canTransition(fromStatusId, toStatusId);
        if (can) {
            const [statusResult] = await conn.execute(
                `UPDATE orders SET status_id = ? WHERE id = ? AND status_id = ?`,
                [toStatusId, oid, fromStatusId]
            );
            if (statusResult && statusResult.affectedRows > 0) {
                await OrderStatusLogModel.insert({
                    order_id: oid,
                    user_id: null,
                    from_status_id: fromStatusId,
                    to_status_id: toStatusId
                });
            }
        }
    }
};

const applyLiqpayStatus = async (orderId, payload) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0 || !payload) {
        return { ok: false, reason: 'bad_request' };
    }

    if (isIncomingPaid(payload)) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.execute(
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
                 LIMIT 1
                 FOR UPDATE`,
                [oid]
            );

            const order = rows && rows[0];
            if (!order) {
                await conn.rollback();
                return { ok: false, reason: 'not_found' };
            }

            if (order.payment_status === 'paid') {
                const incomingRef = payload.order_id ? String(payload.order_id).trim() : '';
                const savedRef = order.liqpay_last_ref ? String(order.liqpay_last_ref).trim() : '';
                if (incomingRef && savedRef && incomingRef !== savedRef) {
                    await tryRefundIncoming(payload, order.total_amount);
                }
                await conn.commit();
                return { ok: true, reason: 'already_paid' };
            }

            if (order.payment_status === 'cod') {
                await conn.commit();
                return { ok: true, reason: 'cod' };
            }

            if (isOrderClosedForPayment(order)) {
                await conn.rollback();
                await tryRefundIncoming(payload, order.total_amount);
                return { ok: false, reason: 'closed_refunded' };
            }

            const incomingAmount = Number(payload.amount);
            const orderAmount = Number(order.total_amount);
            if (Number.isFinite(incomingAmount) && Number.isFinite(orderAmount)) {
                if (Math.abs(incomingAmount - orderAmount) > 0.015) {
                    await conn.rollback();
                    await tryRefundIncoming(payload, incomingAmount);
                    return { ok: false, reason: 'amount_mismatch' };
                }
            }

            let confirmedId = null;
            if (order.status_name === 'pending') {
                confirmedId = await OrderModel.getStatusIdByName('confirmed');
            }

            await confirmPaidInTransaction(conn, order, confirmedId);
            await conn.commit();

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

            return { ok: true, reason: 'paid' };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    const order = await OrderModel.getByIdForPayment(oid);
    if (!order) {
        return { ok: false, reason: 'not_found' };
    }

    if (order.payment_status === 'paid' || order.payment_status === 'cod') {
        return { ok: true, reason: 'already_paid' };
    }

    if (order.payment_status === 'unpaid') {
        const newStatus = String(payload.status || '');
        if (newStatus) {
            await OrderModel.updatePaymentStatus(oid, newStatus);
        }
    }

    return { ok: false, reason: 'not_paid' };
};

module.exports = {
    PAID_LIQPAY_STATUSES,
    applyLiqpayStatus,
    isIncomingPaid,
    isOrderClosedForPayment
};
