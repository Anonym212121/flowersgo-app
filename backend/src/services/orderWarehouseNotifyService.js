const emailService = require('./emailService');
const OrderModel = require('../models/Order');
const NotificationModel = require('../models/Notification');
const orderDeliveryFields = require('../utils/orderDeliveryFields');
const orderNotifyMessages = require('./orderNotifyMessages');

const sendMail = async (order, subject, text) => {
    const email = orderDeliveryFields.customerEmailFromRow(order);
    if (!email) {
        console.error('orderWarehouseNotify mail: немає email для замовлення #' + (order && order.id ? order.id : '?'));
        return;
    }

    const result = await emailService.sendEmail({
        to: email,
        subject: subject,
        text: text
    });
    if (!result.ok) {
        console.error('orderWarehouseNotify mail:', subject, result.message || 'failed');
    }
};

const sendSiteNotification = async (order, payload) => {
    const uid = Number(order.user_id);
    if (!Number.isFinite(uid) || uid <= 0) {
        return;
    }

    try {
        await NotificationModel.insertForUser({
            user_id: uid,
            order_id: order.id,
            ntype: payload.ntype,
            title: payload.title,
            body: payload.body,
            link_url: payload.link_url || '/cabinet'
        });
    } catch (err) {
        console.error('site notify customer:', err.message);
    }
};

const loadOrderForCustomerNotify = async (orderId) => {
    return OrderModel.getRowForCustomerNotify(orderId);
};

const notifyCustomerEvent = async (orderId, buildMsg, extraArg) => {
    const order = await loadOrderForCustomerNotify(orderId);
    if (!order) {
        return;
    }

    const msg =
        extraArg !== undefined ? buildMsg(order, extraArg) : buildMsg(order);

    await sendMail(order, msg.subject, msg.text);
    await sendSiteNotification(order, {
        ntype: msg.ntype,
        title: msg.title,
        body: msg.body,
        link_url: msg.link_url || '/cabinet'
    });
};

const notifyCustomerOnStatus = async (orderId, statusName) => {
    const status = typeof statusName === 'string' ? statusName.trim() : '';
    if (!status) {
        return;
    }

    if (status === 'processing') {
        await notifyCustomerEvent(orderId, orderNotifyMessages.customer.processing);
        return;
    }
    if (status === 'ready_for_pickup') {
        await notifyCustomerEvent(orderId, orderNotifyMessages.customer.readyForPickup);
        return;
    }
    if (status === 'shipped') {
        await notifyCustomerEvent(orderId, orderNotifyMessages.customer.shipped);
        return;
    }
    if (status === 'delivered') {
        await notifyCustomerEvent(orderId, orderNotifyMessages.customer.delivered);
        return;
    }
    if (status === 'accepted') {
        await notifyCustomerEvent(orderId, orderNotifyMessages.customer.completed);
    }
};

const notifyCustomerOrderPlaced = async (orderId, paymentNote) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.orderPlaced, paymentNote);
};

const notifyCustomerPaymentSuccess = async (orderId) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.paymentSuccess);
};

const notifyCustomerOrderConfirmed = async (orderId) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.orderConfirmed);
};

const notifyCustomerOrderRejected = async (orderId) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.orderRejected);
};

const notifyCustomerCancelRequestSent = async (orderId) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.cancelRequestSent);
};

const notifyCustomerCancelApproved = async (orderId, refundNote) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.cancelApproved, refundNote || '');
};

const notifyCustomerCancelRejected = async (orderId) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.cancelRejected);
};

const notifyCustomerOrderExpired = async (orderId) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.orderExpired);
};

const notifyCustomerRefundProcessed = async (orderId, note) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.refundProcessed, note || '');
};

const notifyCustomerAssembledPhoto = async (orderId) => {
    await notifyCustomerEvent(orderId, orderNotifyMessages.customer.assembledPhoto);
};

module.exports = {
    notifyCustomerOnStatus,
    notifyCustomerOrderPlaced,
    notifyCustomerPaymentSuccess,
    notifyCustomerOrderConfirmed,
    notifyCustomerOrderRejected,
    notifyCustomerCancelRequestSent,
    notifyCustomerCancelApproved,
    notifyCustomerCancelRejected,
    notifyCustomerOrderExpired,
    notifyCustomerRefundProcessed,
    notifyCustomerAssembledPhoto
};
