const emailService = require('./emailService');
const OrderModel = require('../models/Order');
const UserModel = require('../models/User');
const { mapOrderForWarehouse } = require('../utils/warehouseOrderView');

const getAppBaseUrl = () => {
    const raw = process.env.APP_BASE_URL || 'http://localhost:5000';
    return raw.replace(/\/+$/, '');
};

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

    const data = await OrderModel.getDetailForWarehouse(orderId);
    if (!data || !data.order) {
        return;
    }

    const order = mapOrderForWarehouse(data.order);
    const name =
        [courier.first_name, courier.last_name].filter(Boolean).join(' ').trim() || 'Кур\'єре';

    const lines = [
        'Вітаємо, ' + name + '!',
        '',
        'Вам призначено замовлення №' + orderId + '.'
    ];

    if (data.order.status_name === 'processing') {
        lines.push('Статус: комплектується на складі — забереш, коли буде «Готово до видачі».');
    } else {
        lines.push('Статус: готове до видачі — забери на складі.');
    }

    lines.push('Адреса: ' + (order.delivery_place_display || '—'));
    lines.push('Доставка: ' + (order.delivery_display || '—'));

    if (order.receiver_phone) {
        lines.push('Тел. одержувача: ' + order.receiver_phone);
    }

    lines.push('');
    lines.push('Відкрити в кабінеті: ' + getAppBaseUrl() + '/courier/orders/' + orderId);

    await emailService.sendEmail({
        to: notifyEmail,
        subject: 'Нове замовлення №' + orderId + ' для доставки',
        text: lines.join('\n')
    });
};

module.exports = {
    notifyCourierOnAssign
};
