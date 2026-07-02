const emailService = require('./emailService');
const OrderModel = require('../models/Order');
const UserModel = require('../models/User');
const orderNotifyMessages = require('./orderNotifyMessages');

const notifyCourierOnAssign = async (orderId, courierId) => {
    const cid = Number(courierId);
    if (!Number.isFinite(cid) || cid <= 0) {
        return;
    }

    const courier = await UserModel.getUserid(cid);
    const notifyEmail = UserModel.resolveCourierNotifyEmail(courier);
    if (!courier || !notifyEmail) {
        return;
    }

    const orderRow = await OrderModel.getRowForCustomerNotify(orderId);
    if (!orderRow) {
        return;
    }

    const name = [courier.first_name, courier.last_name].filter(Boolean).join(' ').trim() || 'Кур\'єре';
    const msg = orderNotifyMessages.courier.assignDetail(orderId, orderRow, name);

    const result = await emailService.sendEmail({
        to: notifyEmail,
        subject: msg.subject,
        text: msg.text
    });
    if (!result.ok) {
        console.error('orderCourierNotify mail:', notifyEmail, result.message || 'failed');
    }
};

module.exports = {
    notifyCourierOnAssign
};
