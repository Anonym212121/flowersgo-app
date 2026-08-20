const OrderModel = require('../models/Order');
const OrderStatusLogModel = require('../models/OrderStatusLog');
const orderStatusService = require('./orderStatusService');
const orderRoleNotifyService = require('./orderRoleNotifyService');
const orderWarehouseNotifyService = require('./orderWarehouseNotifyService');
const courierAssignService = require('./courierAssignService');

const startAssembling = async (orderId) => {
    return orderStatusService.applySystemStatus(orderId, 'processing');
};

const notifyWarehouseAndCustomer = async (orderId) => {
    try {
        await orderRoleNotifyService.onOrderApprovedForWarehouse(orderId);
    } catch (err) {
        console.error('onOrderApprovedForWarehouse:', err.message);
    }
    try {
        await orderWarehouseNotifyService.notifyCustomerOrderConfirmed(orderId);
    } catch (err) {
        console.error('notifyCustomerOrderConfirmed:', err.message);
    }
};

const tryAssignCourier = async (orderId) => {
    try {
        await courierAssignService.tryAutoAssign(orderId);
    } catch (err) {
        console.error('tryAutoAssign after dispatch:', err.message);
    }
};

const dispatchToWarehouse = async (orderId) => {
    const oid = Number(orderId);
    if (!Number.isFinite(oid) || oid <= 0) {
        return { ok: false, code: 'bad_id' };
    }

    const result = await OrderModel.approveForAdmin(oid);
    if (result.ok) {
        await startAssembling(oid);
        await notifyWarehouseAndCustomer(oid);
        await tryAssignCourier(oid);
        return { ok: true, code: 'dispatched' };
    }

    if (result.code === 'no_stock') {
        try {
            await orderRoleNotifyService.onOrderStockProblemForAdmin(oid);
        } catch (notifyErr) {
            console.error('onOrderStockProblemForAdmin:', notifyErr.message);
        }
        return result;
    }

    const current = await OrderModel.getByIdForStatusChange(oid);
    if (current && Number(current.admin_approved) === 1) {
        await startAssembling(oid);
        await tryAssignCourier(oid);
        return { ok: true, code: 'already' };
    }

    return result;
};

const tryFinishCourierOrder = async (orderId, courierId) => {
    const result = await OrderModel.closeByCourier(orderId, courierId);
    if (!result.ok) {
        return result;
    }

    try {
        await OrderStatusLogModel.insert({
            order_id: orderId,
            user_id: courierId,
            from_status_id: result.from_status_id,
            to_status_id: result.to_status_id
        });
    } catch (logErr) {
        console.error('courier auto-close log:', logErr.message);
    }

    try {
        await orderRoleNotifyService.onOrderClosed(orderId, courierId);
    } catch (notifyErr) {
        console.error('onOrderClosed:', notifyErr.message);
    }

    try {
        await orderWarehouseNotifyService.notifyCustomerOnStatus(orderId, 'accepted');
    } catch (notifyErr) {
        console.error('notifyCustomerOnStatus close:', notifyErr.message);
    }

    return result;
};

module.exports = {
    dispatchToWarehouse,
    tryFinishCourierOrder
};
