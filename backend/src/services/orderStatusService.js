const OrderModel = require('../models/Order');
const StatusModel = require('../models/Status');

const OrderStatusLogModel = require('../models/OrderStatusLog');

const applySystemStatus = async (orderId, toStatusName) => {
    const order = await OrderModel.getByIdForStatusChange(orderId);
    if (!order) {
        return false;
    }

    const toId = await OrderModel.getStatusIdByName(toStatusName);
    if (!toId) {
        return false;
    }

    if (Number(order.status_id) === Number(toId)) {
        return true;
    }

    const can = await StatusModel.canTransition(order.status_id, toId);
    if (!can) {
        return false;
    }

    const fromId = Number(order.status_id);
    const ok = await OrderModel.updateStatusIfCurrent(orderId, fromId, toId);
    if (ok && fromId !== toId) {
        try {
            await OrderStatusLogModel.insert({
                order_id: orderId,
                user_id: null,
                from_status_id: fromId,
                to_status_id: toId
            });
        } catch (logErr) {
            console.error('system status log:', logErr.message);
        }
    }
    return ok;
};

const onPaymentConfirmed = async (orderId) => {
    return applySystemStatus(orderId, 'confirmed');
};

const onCodConfirmed = async (orderId) => {
    return applySystemStatus(orderId, 'confirmed');
};

module.exports = {
    applySystemStatus,
    onPaymentConfirmed,
    onCodConfirmed
};
