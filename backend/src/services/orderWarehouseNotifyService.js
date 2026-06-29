const emailService = require('./emailService');

const OrderModel = require('../models/Order');

const NotificationModel = require('../models/Notification');

const orderDeliveryFields = require('../utils/orderDeliveryFields');



const sendMail = async (order, subject, text) => {
    const email = orderDeliveryFields.customerEmailFromRow(order);
    if (!email) {
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



const notifyCustomerOnStatus = async (orderId, statusName) => {

    const status = typeof statusName === 'string' ? statusName.trim() : '';

    if (!status) {

        return;

    }



    const data = await OrderModel.getDetailForWarehouse(orderId);

    if (!data || !data.order) {

        return;

    }



    const order = data.order;

    const id = order.id;

    const pickup = order.delivery_method === 'pickup';



    if (status === 'processing') {

        if (pickup) {

            await sendMail(

                order,

                'Ваше замовлення комплектується',

                'Замовлення №' + id + ' збирають на складі для самовивозу.'

            );

            await sendSiteNotification(order, {

                ntype: 'order_processing',

                title: 'Замовлення комплектується',

                body: 'Замовлення №' + id + ' збирають для самовивозу.'

            });

        } else {

            await sendMail(

                order,

                'Ваше замовлення комплектується',

                'Замовлення №' + id + ' збирають на складі. Скоро передадуть кур\'єру.'

            );

            await sendSiteNotification(order, {

                ntype: 'order_processing',

                title: 'Замовлення комплектується',

                body: 'Замовлення №' + id + ' збирають на складі.'

            });

        }

        return;

    }



    if (status === 'ready_for_pickup') {

        if (pickup) {

            await sendMail(

                order,

                'Букет готовий до самовивозу',

                'Замовлення №' + id + ' готове. Можете забрати його в нашому магазині у зазначений час.'

            );

            await sendSiteNotification(order, {

                ntype: 'order_ready_pickup',

                title: 'Готовий до самовивозу',

                body: 'Замовлення №' + id + ' можна забрати в магазині.'

            });

        } else {

            await sendMail(

                order,

                'Замовлення готове до доставки',

                'Замовлення №' + id + ' зібрано і незабаром передадуть кур\'єру.'

            );

            await sendSiteNotification(order, {

                ntype: 'order_ready_courier',

                title: 'Готово до доставки',

                body: 'Замовлення №' + id + ' зібрано — скоро передадуть кур\'єру.'

            });

        }

        return;

    }



    if (status === 'shipped') {

        await sendMail(

            order,

            'Замовлення в дорозі',

            'Замовлення №' + id + ' передано кур\'єру і вже в дорозі.'

        );

        await sendSiteNotification(order, {

            ntype: 'order_shipped',

            title: 'Замовлення в дорозі',

            body: 'Замовлення №' + id + ' передано кур\'єру.'

        });

        return;

    }



    if (status === 'delivered') {

        await sendMail(

            order,

            'Замовлення доставлено',

            'Замовлення №' + id + ' доставлено. Дякуємо, що обрали нас!'

        );

        await sendSiteNotification(order, {

            ntype: 'order_delivered',

            title: 'Замовлення доставлено',

            body: 'Замовлення №' + id + ' вже у одержувача. Дякуємо!'

        });

        return;

    }



    if (status === 'accepted') {

        if (pickup) {

            await sendMail(

                order,

                'Самовивіз завершено',

                'Замовлення №' + id + ' видано. Дякуємо, що обрали нас!'

            );

            await sendSiteNotification(order, {

                ntype: 'order_completed',

                title: 'Самовивіз завершено',

                body: 'Замовлення №' + id + ' успішно видано.'

            });

        } else {

            await sendMail(

                order,

                'Замовлення завершено',

                'Замовлення №' + id + ' успішно доставлено. Дякуємо, що обрали нас!'

            );

            await sendSiteNotification(order, {

                ntype: 'order_completed',

                title: 'Замовлення завершено',

                body: 'Замовлення №' + id + ' успішно доставлено. Дякуємо!'

            });

        }

    }

};



const notifyCustomerOrderPlaced = async (orderId, paymentNote) => {

    const order = await loadOrderForCustomerNotify(orderId);

    if (!order) {

        return;

    }

    const id = order.id;

    const note = typeof paymentNote === 'string' && paymentNote.trim() !== ''

        ? paymentNote.trim()

        : 'Очікуйте підтвердження адміністратора.';

    await sendMail(

        order,

        'Замовлення створено',

        'Замовлення №' + id + ' прийнято. ' + note

    );

    await sendSiteNotification(order, {

        ntype: 'order_created',

        title: 'Замовлення створено',

        body: 'Замовлення №' + id + ' прийнято.',

        link_url: '/cabinet'

    });

};



const loadOrderForCustomerNotify = async (orderId) => {

    const data = await OrderModel.getDetailForWarehouse(orderId);

    if (!data || !data.order) {

        return null;

    }

    return data.order;

};



const notifyCustomerPaymentSuccess = async (orderId) => {

    const order = await loadOrderForCustomerNotify(orderId);

    if (!order) {

        return;

    }

    const id = order.id;

    await sendMail(

        order,

        'Оплату отримано',

        'Замовлення №' + id + ' оплачено. Очікуйте підтвердження адміністратора.'

    );

    await sendSiteNotification(order, {

        ntype: 'order_paid',

        title: 'Оплату отримано',

        body: 'Замовлення №' + id + ' оплачено. Очікуйте підтвердження.',

        link_url: '/cabinet'

    });

};



const notifyCustomerOrderRejected = async (orderId) => {

    const order = await loadOrderForCustomerNotify(orderId);

    if (!order) {

        return;

    }

    const id = order.id;

    await sendMail(

        order,

        'Замовлення відхилено',

        'Замовлення №' + id + ' відхилено адміністратором. Якщо оплату вже списано — кошти повернуть за правилами магазину.'

    );

    await sendSiteNotification(order, {

        ntype: 'order_rejected',

        title: 'Замовлення відхилено',

        body: 'Замовлення №' + id + ' відхилено адміністратором.',

        link_url: '/cabinet'

    });

};



const notifyCustomerCancelApproved = async (orderId) => {

    const order = await loadOrderForCustomerNotify(orderId);

    if (!order) {

        return;

    }

    const id = order.id;

    await sendMail(

        order,

        'Скасування підтверджено',

        'Запит на скасування замовлення №' + id + ' схвалено. Замовлення скасовано.'

    );

    await sendSiteNotification(order, {

        ntype: 'order_cancel_ok',

        title: 'Скасування підтверджено',

        body: 'Замовлення №' + id + ' скасовано.',

        link_url: '/cabinet'

    });

};



const notifyCustomerCancelRejected = async (orderId) => {

    const order = await loadOrderForCustomerNotify(orderId);

    if (!order) {

        return;

    }

    const id = order.id;

    await sendMail(

        order,

        'Скасування відхилено',

        'Адміністратор відхилив запит на скасування замовлення №' + id + '. Замовлення залишається активним.'

    );

    await sendSiteNotification(order, {

        ntype: 'order_cancel_no',

        title: 'Скасування відхилено',

        body: 'Запит на скасування замовлення №' + id + ' відхилено.',

        link_url: '/cabinet'

    });

};



const notifyCustomerOrderExpired = async (orderId) => {

    const order = await loadOrderForCustomerNotify(orderId);

    if (!order) {

        return;

    }

    const id = order.id;

    await sendMail(

        order,

        'Час оплати вичерпано',

        'Замовлення №' + id + ' скасовано — час на оплату вичерпано. Оформи нове замовлення, якщо потрібно.'

    );

    await sendSiteNotification(order, {

        ntype: 'order_expired',

        title: 'Час оплати вичерпано',

        body: 'Замовлення №' + id + ' скасовано через прострочення оплати.',

        link_url: '/cabinet'

    });

};



module.exports = {

    notifyCustomerOnStatus,

    notifyCustomerOrderPlaced,

    notifyCustomerPaymentSuccess,

    notifyCustomerOrderRejected,

    notifyCustomerCancelApproved,

    notifyCustomerCancelRejected,

    notifyCustomerOrderExpired

};


