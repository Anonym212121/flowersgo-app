const OrderModel = require('../models/Order');
const UserModel = require('../models/User');
const orderCourierNotifyService = require('./orderCourierNotifyService');
const orderRoleNotifyService = require('./orderRoleNotifyService');
const { pickBestCourierForOrder, attachNearestSlots } = require('../utils/courierDispatchPick');

const assignAndNotify = async (orderId, courierId) => {
    const ok = await OrderModel.assignCourier(orderId, courierId);
    if (!ok) {
        return false;
    }
    try {
        await orderCourierNotifyService.notifyCourierOnAssign(orderId, courierId);
        await orderRoleNotifyService.onCourierBooked(orderId, courierId);
    } catch (err) {
        console.error('notifyCourierOnAssign:', err.message);
    }
    return true;
};

const tryAutoAssign = async (orderId) => {
    const order = await OrderModel.getByIdForAssign(orderId);
    if (!order) {
        return false;
    }
    if (order.delivery_method === 'pickup') {
        return false;
    }
    if (order.status_name !== 'ready_for_pickup') {
        return false;
    }
    if (order.courier_id) {
        return false;
    }

    const couriersRaw = await UserModel.listCouriersOnShiftWithLoad();
    if (!couriersRaw || couriersRaw.length === 0) {
        return false;
    }

    const assignments = await OrderModel.listActiveAssignmentsForDispatch();
    const couriers = attachNearestSlots(couriersRaw, assignments);
    const best = pickBestCourierForOrder(order, couriers, 5);
    if (!best) {
        return false;
    }

    const courierId = Number(best.id);
    if (!Number.isFinite(courierId) || courierId <= 0) {
        return false;
    }

    return assignAndNotify(orderId, courierId);
};

const assignPendingReadyOrders = async () => {
    const ids = await OrderModel.listIdsUnassignedReady();
    let assigned = 0;
    for (let i = 0; i < ids.length; i++) {
        const ok = await tryAutoAssign(ids[i]);
        if (ok) {
            assigned++;
        }
    }
    return assigned;
};

const assignCourierByAdmin = async (orderId, courierId) => {
    const order = await OrderModel.getByIdForAssign(orderId);
    if (!order) {
        return { ok: false, message: 'Замовлення не знайдено або не готове до доставки' };
    }
    if (order.delivery_method === 'pickup') {
        return { ok: false, message: 'Самовивіз — кур\'єр не потрібен' };
    }
    if (
        order.status_name !== 'processing' &&
        order.status_name !== 'ready_for_pickup' &&
        order.status_name !== 'shipped'
    ) {
        return { ok: false, message: 'Призначати кур\'єра можна для комплектації, готових або в дорозі' };
    }

    const cid = Number(courierId);
    if (!Number.isFinite(cid) || cid <= 0) {
        return { ok: false, message: 'Невірний кур\'єр' };
    }

    const ok = await assignAndNotify(orderId, cid);
    if (!ok) {
        return { ok: false, message: 'Не вдалося призначити кур\'єра' };
    }
    return { ok: true };
};

const unassignCourierByAdmin = async (orderId, autoReassign) => {
    const order = await OrderModel.getByIdForAssign(orderId);
    if (!order) {
        return { ok: false, message: 'Замовлення не знайдено' };
    }
    if (order.delivery_method === 'pickup') {
        return { ok: false, message: 'Самовивіз — кур\'єр не потрібен' };
    }
    if (order.status_name !== 'processing' && order.status_name !== 'ready_for_pickup') {
        return { ok: false, message: 'Зняти кур\'єра можна лише до видачі зі складу' };
    }
    if (!order.courier_id) {
        return { ok: false, message: 'Кур\'єра ще не призначено' };
    }

    const ok = await OrderModel.unassignCourier(orderId);
    if (!ok) {
        return { ok: false, message: 'Не вдалося зняти кур\'єра' };
    }

    if (autoReassign && order.status_name === 'ready_for_pickup') {
        try {
            await tryAutoAssign(orderId);
        } catch (err) {
            console.error('tryAutoAssign after unassign:', err.message);
        }
    }

    return { ok: true };
};

module.exports = {
    tryAutoAssign,
    assignPendingReadyOrders,
    assignCourierByAdmin,
    unassignCourierByAdmin
};
