const UserModel = require('../models/User');
const NotificationModel = require('../models/Notification');
const notificationEmailService = require('./notificationEmailService');

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

const onNewOrderForAdmin = async (orderId) => {
    try {
        await notifyRole('admin', {
            order_id: orderId,
            ntype: 'order_pending_admin',
            title: 'Нове замовлення',
            body: 'Замовлення №' + orderId + ' очікує підтвердження адміністратора',
            link_url: '/admin'
        });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onOrderApprovedForWarehouse = async (orderId) => {
    try {
        await notifyRole('warehouse_worker', {
            order_id: orderId,
            ntype: 'order_to_warehouse',
            title: 'Замовлення від адміна',
            body: 'Замовлення №' + orderId + ' підтверджено — можна комплектувати',
            link_url: '/warehouse/orders/' + orderId
        });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onCourierBooked = async (orderId, courierId) => {
    try {
        await notifyUser(courierId, {
            order_id: orderId,
            ntype: 'courier_booked',
            title: 'Замовлення заброньовано',
            body: 'Замовлення №' + orderId + ' призначено вам — очікуйте збірку на складі',
            link_url: '/courier/orders/' + orderId
        });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onOrderReadyForCourier = async (orderId, courierId) => {
    if (!courierId) {
        return;
    }
    try {
        await notifyUser(courierId, {
            order_id: orderId,
            ntype: 'courier_ready',
            title: 'Готово до видачі',
            body: 'Замовлення №' + orderId + ' зібрано — забирай на складі',
            link_url: '/courier/orders/' + orderId
        });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onOrderClosed = async (orderId, courierId) => {
    try {
        await notifyRole('admin', {
            order_id: orderId,
            ntype: 'order_closed',
            title: 'Замовлення завершено',
            body: 'Замовлення №' + orderId + ' закрито кур\'єром',
            link_url: '/admin'
        });
        if (courierId) {
            await notifyUser(courierId, {
                order_id: orderId,
                ntype: 'order_closed_courier',
                title: 'Замовлення закрито',
                body: 'Замовлення №' + orderId + ' успішно завершено',
                link_url: '/courier/orders?view=history'
            });
        }
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onPickupCompleted = async (orderId) => {
    try {
        await notifyRole('admin', {
            order_id: orderId,
            ntype: 'order_pickup_done',
            title: 'Самовивіз завершено',
            body: 'Замовлення №' + orderId + ' видано клієнту на складі',
            link_url: '/admin'
        });
        await notifyRole('warehouse_worker', {
            order_id: orderId,
            ntype: 'order_pickup_done_wh',
            title: 'Самовивіз завершено',
            body: 'Замовлення №' + orderId + ' закрито',
            link_url: '/warehouse/orders/' + orderId
        });
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
        await notifyUser(cid, {
            order_id: orderId,
            ntype: 'courier_order_cancelled',
            title: 'Замовлення скасовано',
            body: 'Замовлення №' + orderId + ' знято з вашого маршруту',
            link_url: '/courier/orders'
        });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onCancelRequestForAdmin = async (orderId) => {
    try {
        await notifyRole('admin', {
            order_id: orderId,
            ntype: 'order_cancel_request',
            title: 'Запит на скасування',
            body: 'Клієнт просить скасувати замовлення №' + orderId,
            link_url: '/admin'
        });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

const onReviewChangeRequestForAdmin = async (reviewId, requestType) => {
    const rid = Number(reviewId);
    if (!Number.isFinite(rid) || rid <= 0) {
        return;
    }
    const kind = requestType === 'delete' ? 'видалення' : 'редагування';
    try {
        await notifyRole('admin', {
            ntype: 'review_change_request',
            title: 'Запит на зміну відгуку',
            body: 'Клієнт просить ' + kind + ' відгуку №' + rid,
            link_url: '/admin'
        });
    } catch (err) {
        console.error('orderRoleNotify:', err.message);
    }
};

module.exports = {
    onNewOrderForAdmin,
    onOrderApprovedForWarehouse,
    onCourierBooked,
    onOrderReadyForCourier,
    onOrderClosed,
    onPickupCompleted,
    onOrderCancelledForCourier,
    onCancelRequestForAdmin,
    onReviewChangeRequestForAdmin
};
