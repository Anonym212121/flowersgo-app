const UserModel = require('../models/User');
const OrderModel = require('../models/Order');
const NotificationModel = require('../models/Notification');
const notificationEmailService = require('./notificationEmailService');
const orderNotifyMessages = require('./orderNotifyMessages');

const loadOrder = async (orderId) => {
    return OrderModel.getRowForCustomerNotify(orderId);
};

const courierName = (userRow) => {
    if (!userRow) {
        return 'Кур\'єре';
    }
    const name = [userRow.first_name, userRow.last_name].filter(Boolean).join(' ').trim();
    return name || 'Кур\'єре';
};

const notifyUsers = async (userIds, payload) => {
    const ids = Array.isArray(userIds) ? userIds : [];
    if (ids.length === 0) {
        return 0;
    }
    const count = await NotificationModel.insertForUsers(ids, payload);
    await notificationEmailService.sendForUserIds(ids, payload);
    return count;
};

const notifyRole = async (roleName, payload) => {
    const ids = await UserModel.listUserIdsByRole(roleName);
    return notifyUsers(ids, payload);
};

const notifyUser = async (userId, payload) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
        return false;
    }
    const ok = await NotificationModel.insertForUser({ user_id: uid, ...payload });
    await notificationEmailService.sendForUserId(uid, payload);
    return ok;
};

const notifyRoleWithOrder = async (roleName, orderId, buildMsg) => {
    try {
        const order = await loadOrder(orderId);
        const msg = buildMsg(orderId, order);
        await notifyRole(roleName, { order_id: orderId, ...msg });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onNewOrderForAdmin = async (orderId) => {
    await notifyRoleWithOrder('admin', orderId, orderNotifyMessages.admin.newOrder);
};

const onOrderApprovedForWarehouse = async (orderId) => {
    await notifyRoleWithOrder('warehouse_worker', orderId, orderNotifyMessages.warehouse.orderToAssemble);
};

const onCancelRequestForAdmin = async (orderId) => {
    await notifyRoleWithOrder('admin', orderId, orderNotifyMessages.admin.cancelRequest);
};

const onCancelRequestForWarehouse = async (orderId) => {
    await notifyRoleWithOrder('warehouse_worker', orderId, orderNotifyMessages.warehouse.cancelRequest);
};

const onOrderCancelledForWarehouse = async (orderId) => {
    await notifyRoleWithOrder('warehouse_worker', orderId, orderNotifyMessages.warehouse.orderCancelled);
};

const onWarehouseCourierPickedUp = async (orderId) => {
    await notifyRoleWithOrder('warehouse_worker', orderId, orderNotifyMessages.warehouse.courierPickedUp);
};

const onOrderShippedForAdmin = async (orderId) => {
    await notifyRoleWithOrder('admin', orderId, orderNotifyMessages.admin.orderShipped);
};

const onOrderDeliveredForAdmin = async (orderId) => {
    await notifyRoleWithOrder('admin', orderId, orderNotifyMessages.admin.orderDelivered);
};

const onOrderExpiredForAdmin = async (orderId) => {
    try {
        const msg = orderNotifyMessages.admin.orderExpired(orderId);
        await notifyRole('admin', { order_id: orderId, ...msg });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onCourierBooked = async (orderId, courierId) => {
    try {
        const order = await loadOrder(orderId);
        const courier = await UserModel.getUserid(courierId);
        const msg = orderNotifyMessages.courier.booked(orderId, order, courierName(courier));
        await notifyUser(courierId, { order_id: orderId, ...msg });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onOrderReadyForCourier = async (orderId, courierId) => {
    if (!courierId) {
        return;
    }
    try {
        const order = await loadOrder(orderId);
        const courier = await UserModel.getUserid(courierId);
        const msg = orderNotifyMessages.courier.readyForPickup(orderId, order, courierName(courier));
        await notifyUser(courierId, { order_id: orderId, ...msg });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onOrderClosed = async (orderId, courierId) => {
    try {
        const order = await loadOrder(orderId);
        const adminMsg = orderNotifyMessages.admin.orderClosed(orderId, order);
        await notifyRole('admin', { order_id: orderId, ...adminMsg });

        if (courierId) {
            const courier = await UserModel.getUserid(courierId);
            const msg = orderNotifyMessages.courier.closed(orderId, order, courierName(courier));
            await notifyUser(courierId, { order_id: orderId, ...msg });
        }
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onPickupCompleted = async (orderId) => {
    try {
        const order = await loadOrder(orderId);
        const adminMsg = orderNotifyMessages.admin.pickupCompleted(orderId, order);
        await notifyRole('admin', { order_id: orderId, ...adminMsg });

        const whMsg = orderNotifyMessages.warehouse.pickupCompleted(orderId, order);
        await notifyRole('warehouse_worker', { order_id: orderId, ...whMsg });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onOrderCancelledForCourier = async (orderId, courierId) => {
    const cid = Number(courierId);
    if (!Number.isFinite(cid) || cid <= 0) {
        return;
    }
    try {
        const order = await loadOrder(orderId);
        const courier = await UserModel.getUserid(cid);
        const msg = orderNotifyMessages.courier.cancelled(orderId, order, courierName(courier));
        await notifyUser(cid, { order_id: orderId, ...msg });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onReviewChangeRequestForAdmin = async (reviewId, requestType) => {
    const rid = Number(reviewId);
    if (!Number.isFinite(rid) || rid <= 0) {
        return;
    }
    try {
        const msg = orderNotifyMessages.admin.reviewChangeRequest(rid, requestType);
        await notifyRole('admin', { ...msg });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

module.exports = {
    onNewOrderForAdmin,
    onOrderApprovedForWarehouse,
    onCancelRequestForAdmin,
    onCancelRequestForWarehouse,
    onOrderCancelledForWarehouse,
    onWarehouseCourierPickedUp,
    onOrderShippedForAdmin,
    onOrderDeliveredForAdmin,
    onOrderExpiredForAdmin,
    onCourierBooked,
    onOrderReadyForCourier,
    onOrderClosed,
    onPickupCompleted,
    onOrderCancelledForCourier,
    onReviewChangeRequestForAdmin
};
