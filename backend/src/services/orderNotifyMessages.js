const orderDeliveryFields = require('../utils/orderDeliveryFields');
const formatDelivery = require('../utils/formatDelivery');

const baseUrl = () => String(process.env.APP_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const footer = () => '\n\n— FlowersGo';

const openLink = (path) => {
    if (!path) {
        return '';
    }
    const link = path.startsWith('http') ? path : baseUrl() + path;
    return '\n\nВідкрити в системі: ' + link;
};

const money = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return '—';
    }
    return n.toFixed(2) + ' грн';
};

const paymentLabel = (status) => {
    const map = {
        paid: 'Оплачено карткою',
        cod: 'Оплата при отриманні',
        unpaid: 'Очікує оплату',
        refunded: 'Кошти повернуто'
    };
    return map[status] || status || '—';
};

const deliveryMethodLabel = (method) => {
    if (method === 'pickup') {
        return 'Самовивіз';
    }
    if (method === 'express') {
        return 'Експрес-доставка';
    }
    return 'Стандартна доставка';
};

const customerName = (order) => orderDeliveryFields.customerNameFromRow(order) || 'Клієнте';

const orderSummaryLines = (order) => {
    if (!order) {
        return ['Замовлення №?'];
    }

    const lines = [
        'Замовлення №' + order.id,
        'Сума: ' + money(order.total_amount),
        'Оплата: ' + paymentLabel(order.payment_status),
        'Доставка: ' + deliveryMethodLabel(order.delivery_method)
    ];

    const when = formatDelivery.formatDeliveryDisplay(order.delivery_date, order.delivery_timeslot);
    if (when && when !== '—') {
        lines.push('Дата та час: ' + when);
    }

    const place = orderDeliveryFields.formatDeliveryPlaceFromRow(order);
    if (place && place !== '—') {
        lines.push('Адреса: ' + place);
    }

    if (order.receiver_name && order.receiver_phone) {
        lines.push('Одержувач: ' + order.receiver_name + ', тел. ' + order.receiver_phone);
    }

    return lines;
};

const orderBlock = (order) => orderSummaryLines(order).join('\n');

const customerText = (greeting, main, order, linkPath) => {
    let text = greeting + '\n\n' + main;
    if (order) {
        text += '\n\n' + orderBlock(order);
    }
    text += openLink(linkPath || '/cabinet');
    text += footer();
    return text;
};

const roleEmail = (greeting, main, order, linkPath) => {
    let text = greeting + '\n\n' + main;
    if (order) {
        text += '\n\n' + orderBlock(order);
    }
    text += openLink(linkPath);
    text += footer();
    return text;
};

const customer = {
    orderPlaced(order, note) {
        const id = order.id;
        const extra = note || 'Очікуйте підтвердження адміністратора.';
        return {
            subject: 'Замовлення №' + id + ' прийнято',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Ваше замовлення прийнято в роботу.\n' + extra,
                order,
                '/cabinet'
            ),
            ntype: 'order_created',
            title: 'Замовлення створено',
            body: 'Замовлення №' + id + ' прийнято.',
            link_url: '/cabinet'
        };
    },

    paymentSuccess(order) {
        const id = order.id;
        return {
            subject: 'Оплату за замовлення №' + id + ' отримано',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Оплату зафіксовано. Замовлення передано на перевірку адміністратору — після підтвердження почнемо комплектацію.',
                order,
                '/cabinet'
            ),
            ntype: 'order_paid',
            title: 'Оплату отримано',
            body: 'Замовлення №' + id + ' оплачено. Очікуйте підтвердження.',
            link_url: '/cabinet'
        };
    },

    orderConfirmed(order) {
        const id = order.id;
        const pickup = order.delivery_method === 'pickup';
        const main = pickup
            ? 'Адміністратор підтвердив замовлення. Склад уже готує букет — повідомимо, коли можна забирати.'
            : 'Адміністратор підтвердив замовлення. Склад комплектує букет — далі передамо кур\'єру.';
        return {
            subject: 'Замовлення №' + id + ' підтверджено',
            text: customerText('Вітаємо, ' + customerName(order) + '!', main, order, '/cabinet'),
            ntype: 'order_confirmed',
            title: 'Замовлення підтверджено',
            body: 'Замовлення №' + id + ' підтверджено адміністратором.',
            link_url: '/cabinet'
        };
    },

    orderRejected(order) {
        const id = order.id;
        return {
            subject: 'Замовлення №' + id + ' відхилено',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'На жаль, адміністратор не зможе виконати це замовлення. Якщо оплату вже списано — кошти повернуть за правилами магазину.',
                order,
                '/cabinet'
            ),
            ntype: 'order_rejected',
            title: 'Замовлення відхилено',
            body: 'Замовлення №' + id + ' відхилено адміністратором.',
            link_url: '/cabinet'
        };
    },

    processing(order) {
        const id = order.id;
        const pickup = order.delivery_method === 'pickup';
        const main = pickup
            ? 'Флорист збирає ваш букет для самовивозу.'
            : 'На складі комплектують букет. Після збірки передадуть кур\'єру.';
        return {
            subject: 'Замовлення №' + id + ' комплектується',
            text: customerText('Вітаємо, ' + customerName(order) + '!', main, order, '/cabinet'),
            ntype: 'order_processing',
            title: 'Замовлення комплектується',
            body: pickup
                ? 'Замовлення №' + id + ' збирають для самовивозу.'
                : 'Замовлення №' + id + ' збирають на складі.',
            link_url: '/cabinet'
        };
    },

    readyForPickup(order) {
        const id = order.id;
        const pickup = order.delivery_method === 'pickup';
        const main = pickup
            ? 'Букет готовий! Заберіть його в магазині у зазначений час.'
            : 'Букет зібрано і незабаром передадуть кур\'єру для доставки.';
        return {
            subject: pickup ? 'Букет №' + id + ' готовий до самовивозу' : 'Замовлення №' + id + ' готове до доставки',
            text: customerText('Вітаємо, ' + customerName(order) + '!', main, order, '/cabinet'),
            ntype: pickup ? 'order_ready_pickup' : 'order_ready_courier',
            title: pickup ? 'Готовий до самовивозу' : 'Готово до доставки',
            body: pickup
                ? 'Замовлення №' + id + ' можна забрати в магазині.'
                : 'Замовлення №' + id + ' зібрано — скоро передадуть кур\'єру.',
            link_url: '/cabinet'
        };
    },

    shipped(order) {
        const id = order.id;
        return {
            subject: 'Замовлення №' + id + ' в дорозі',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Кур\'єр уже везе букет за вказаною адресою. Тримайте телефон увімкненим.',
                order,
                '/cabinet'
            ),
            ntype: 'order_shipped',
            title: 'Замовлення в дорозі',
            body: 'Замовлення №' + id + ' передано кур\'єру.',
            link_url: '/cabinet'
        };
    },

    delivered(order) {
        const id = order.id;
        return {
            subject: 'Замовлення №' + id + ' доставлено',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Букет передано одержувачу. Сподіваємось, подарунок принесе радість!',
                order,
                '/cabinet'
            ),
            ntype: 'order_delivered',
            title: 'Замовлення доставлено',
            body: 'Замовлення №' + id + ' вже у одержувача.',
            link_url: '/cabinet'
        };
    },

    completed(order) {
        const id = order.id;
        const pickup = order.delivery_method === 'pickup';
        const main = pickup
            ? 'Дякуємо, що забрали замовлення! Будемо раді бачити вас знову.'
            : 'Замовлення успішно завершено. Дякуємо, що обрали FlowersGo!';
        return {
            subject: 'Замовлення №' + id + ' завершено',
            text: customerText('Вітаємо, ' + customerName(order) + '!', main, order, '/cabinet'),
            ntype: 'order_completed',
            title: pickup ? 'Самовивіз завершено' : 'Замовлення завершено',
            body: pickup
                ? 'Замовлення №' + id + ' успішно видано.'
                : 'Замовлення №' + id + ' успішно доставлено.',
            link_url: '/cabinet'
        };
    },

    cancelRequestSent(order) {
        const id = order.id;
        return {
            subject: 'Запит на скасування №' + id + ' надіслано',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Ми отримали ваш запит на скасування. Адміністратор розгляне його протягом робочого дня.',
                order,
                '/cabinet'
            ),
            ntype: 'order_cancel_sent',
            title: 'Запит на скасування',
            body: 'Запит на скасування замовлення №' + id + ' надіслано.',
            link_url: '/cabinet'
        };
    },

    cancelApproved(order) {
        const id = order.id;
        return {
            subject: 'Скасування №' + id + ' підтверджено',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Замовлення скасовано за вашим запитом.',
                order,
                '/cabinet'
            ),
            ntype: 'order_cancel_ok',
            title: 'Скасування підтверджено',
            body: 'Замовлення №' + id + ' скасовано.',
            link_url: '/cabinet'
        };
    },

    cancelRejected(order) {
        const id = order.id;
        return {
            subject: 'Скасування №' + id + ' відхилено',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Адміністратор не погодив скасування — замовлення залишається активним і буде виконане.',
                order,
                '/cabinet'
            ),
            ntype: 'order_cancel_no',
            title: 'Скасування відхилено',
            body: 'Запит на скасування замовлення №' + id + ' відхилено.',
            link_url: '/cabinet'
        };
    },

    orderExpired(order) {
        const id = order.id;
        return {
            subject: 'Час оплати №' + id + ' вичерпано',
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Замовлення скасовано автоматично — час на оплату минув. Можете оформити нове замовлення на сайті.',
                order,
                '/catalog'
            ),
            ntype: 'order_expired',
            title: 'Час оплати вичерпано',
            body: 'Замовлення №' + id + ' скасовано через прострочення оплати.',
            link_url: '/cabinet'
        };
    },

    refundProcessed(order, note) {
        const id = order.id;
        const extra = note ? '\n' + note : '';
        return {
            subject: 'Повернення коштів за №' + id,
            text: customerText(
                'Вітаємо, ' + customerName(order) + '!',
                'Кошти за замовлення повертаються на вашу картку.' + extra,
                order,
                '/cabinet'
            ),
            ntype: 'order_refund',
            title: 'Повернення коштів',
            body: 'Кошти за замовлення №' + id + ' повертаються.',
            link_url: '/cabinet'
        };
    }
};

const admin = {
    newOrder(orderId, order) {
        const pay = order ? paymentLabel(order.payment_status) : '';
        const sum = order ? money(order.total_amount) : '';
        return {
            title: 'Нове замовлення',
            body: 'Замовлення №' + orderId + ' очікує підтвердження.',
            email_subject: 'FlowersGo: нове замовлення №' + orderId,
            email_body: roleEmail(
                'Нове замовлення!',
                'Клієнт оформив замовлення №' + orderId + '.\nОплата: ' + pay + '\nСума: ' + sum + '\n\nПотрібне підтвердження адміністратора.',
                order,
                '/admin'
            ),
            ntype: 'order_pending_admin',
            link_url: '/admin'
        };
    },

    cancelRequest(orderId, order) {
        return {
            title: 'Запит на скасування',
            body: 'Клієнт просить скасувати №' + orderId,
            email_subject: 'FlowersGo: скасування №' + orderId,
            email_body: roleEmail(
                'Запит на скасування',
                'Клієнт просить скасувати замовлення №' + orderId + '. Перевірте деталі та прийміть рішення.',
                order,
                '/admin'
            ),
            ntype: 'order_cancel_request',
            link_url: '/admin'
        };
    },

    orderClosed(orderId, order) {
        return {
            title: 'Замовлення завершено',
            body: 'Замовлення №' + orderId + ' закрито кур\'єром',
            email_subject: 'FlowersGo: №' + orderId + ' завершено',
            email_body: roleEmail(
                'Замовлення виконано',
                'Кур\'єр закрив замовлення №' + orderId + '.',
                order,
                '/admin'
            ),
            ntype: 'order_closed',
            link_url: '/admin'
        };
    },

    pickupCompleted(orderId, order) {
        return {
            title: 'Самовивіз завершено',
            body: 'Замовлення №' + orderId + ' видано на складі',
            email_subject: 'FlowersGo: самовивіз №' + orderId,
            email_body: roleEmail(
                'Самовивіз завершено',
                'Замовлення №' + orderId + ' видано клієнту на складі.',
                order,
                '/admin'
            ),
            ntype: 'order_pickup_done',
            link_url: '/admin'
        };
    },

    orderShipped(orderId, order) {
        return {
            title: 'Замовлення в дорозі',
            body: '№' + orderId + ' передано кур\'єру',
            email_subject: 'FlowersGo: №' + orderId + ' в дорозі',
            email_body: roleEmail(
                'Замовлення в дорозі',
                'Замовлення №' + orderId + ' передано кур\'єру для доставки.',
                order,
                '/admin'
            ),
            ntype: 'order_shipped_admin',
            link_url: '/admin'
        };
    },

    orderDelivered(orderId, order) {
        return {
            title: 'Замовлення доставлено',
            body: '№' + orderId + ' у одержувача',
            email_subject: 'FlowersGo: №' + orderId + ' доставлено',
            email_body: roleEmail(
                'Доставку завершено',
                'Кур\'єр позначив замовлення №' + orderId + ' як доставлене.',
                order,
                '/admin'
            ),
            ntype: 'order_delivered_admin',
            link_url: '/admin'
        };
    },

    orderExpired(orderId) {
        return {
            title: 'Замовлення прострочено',
            body: '№' + orderId + ' скасовано — не оплачено',
            email_subject: 'FlowersGo: №' + orderId + ' прострочено',
            email_body: roleEmail(
                'Прострочене замовлення',
                'Замовлення №' + orderId + ' скасовано автоматично — клієнт не встиг оплатити.',
                null,
                '/admin'
            ),
            ntype: 'order_expired_admin',
            link_url: '/admin'
        };
    },

    reviewChangeRequest(reviewId, requestType) {
        const kind = requestType === 'delete' ? 'видалення' : 'редагування';
        return {
            title: 'Запит на зміну відгуку',
            body: 'Клієнт просить ' + kind + ' відгуку №' + reviewId,
            email_subject: 'FlowersGo: запит на ' + kind + ' відгуку',
            email_body: roleEmail(
                'Запит на зміну відгуку',
                'Клієнт просить ' + kind + ' відгуку №' + reviewId + '.',
                null,
                '/admin'
            ),
            ntype: 'review_change_request',
            link_url: '/admin'
        };
    }
};

const warehouse = {
    orderToAssemble(orderId, order) {
        const express = order && order.delivery_method === 'express';
        return {
            title: express ? 'Експрес-замовлення!' : 'Нове на комплектацію',
            body: 'Замовлення №' + orderId + ' — можна збирати',
            email_subject: express
                ? 'FlowersGo: ЕКСПРЕС №' + orderId
                : 'FlowersGo: комплектувати №' + orderId,
            email_body: roleEmail(
                express ? 'Експрес-замовлення!' : 'Нове замовлення на склад',
                express
                    ? 'Терміново! Замовлення №' + orderId + ' — експрес-доставка. Комплектуйте в пріоритеті.'
                    : 'Адмін підтвердив замовлення №' + orderId + '. Можна починати комплектацію.',
                order,
                '/warehouse/orders/' + orderId
            ),
            ntype: 'order_to_warehouse',
            link_url: '/warehouse/orders/' + orderId
        };
    },

    cancelRequest(orderId, order) {
        return {
            title: 'Запит на скасування',
            body: 'Клієнт просить скасувати №' + orderId,
            email_subject: 'FlowersGo: скасування №' + orderId + ' (склад)',
            email_body: roleEmail(
                'Запит на скасування',
                'Клієнт просить скасувати замовлення №' + orderId + '. Зупиніть комплектацію до рішення адміна.',
                order,
                '/warehouse/orders/' + orderId
            ),
            ntype: 'order_cancel_request_wh',
            link_url: '/warehouse/orders/' + orderId
        };
    },

    orderCancelled(orderId, order) {
        return {
            title: 'Замовлення скасовано',
            body: '№' + orderId + ' знято з роботи',
            email_subject: 'FlowersGo: №' + orderId + ' скасовано',
            email_body: roleEmail(
                'Замовлення скасовано',
                'Замовлення №' + orderId + ' скасовано — комплектацію припиніть.',
                order,
                '/warehouse/orders'
            ),
            ntype: 'order_cancelled_wh',
            link_url: '/warehouse/orders'
        };
    },

    courierPickedUp(orderId, order) {
        return {
            title: 'Кур\'єр забрав замовлення',
            body: '№' + orderId + ' передано кур\'єру',
            email_subject: 'FlowersGo: №' + orderId + ' видано кур\'єру',
            email_body: roleEmail(
                'Замовлення видано',
                'Замовлення №' + orderId + ' передано кур\'єру для доставки.',
                order,
                '/warehouse/orders/' + orderId
            ),
            ntype: 'order_handed_courier',
            link_url: '/warehouse/orders/' + orderId
        };
    },

    pickupCompleted(orderId, order) {
        return {
            title: 'Самовивіз завершено',
            body: '№' + orderId + ' видано клієнту',
            email_subject: 'FlowersGo: самовивіз №' + orderId,
            email_body: roleEmail(
                'Самовивіз завершено',
                'Замовлення №' + orderId + ' видано клієнту на складі.',
                order,
                '/warehouse/orders/' + orderId
            ),
            ntype: 'order_pickup_done_wh',
            link_url: '/warehouse/orders/' + orderId
        };
    }
};

const courier = {
    booked(orderId, order, courierName) {
        const name = courierName || 'Кур\'єре';
        const processing = order && order.status_name === 'processing';
        return {
            title: 'Замовлення заброньовано',
            body: '№' + orderId + ' — очікуйте збірку',
            email_subject: 'FlowersGo: №' + orderId + ' для вас',
            email_body: roleEmail(
                'Вітаємо, ' + name + '!',
                processing
                    ? 'Замовлення №' + orderId + ' призначено вам. Зараз комплектується на складі — заберете, коли буде «Готово до видачі».'
                    : 'Замовлення №' + orderId + ' призначено вам і готове до видачі — забирайте на складі.',
                order,
                '/courier/orders/' + orderId
            ),
            ntype: 'courier_booked',
            link_url: '/courier/orders/' + orderId
        };
    },

    assignDetail(orderId, order, courierName) {
        const name = courierName || 'Кур\'єре';
        const processing = order && order.status_name === 'processing';
        const lines = [
            'Вітаємо, ' + name + '!',
            '',
            'Вам призначено замовлення №' + orderId + '.'
        ];
        if (processing) {
            lines.push('Статус: комплектується — забереш, коли буде «Готово до видачі».');
        } else {
            lines.push('Статус: готове до видачі — забери на складі.');
        }
        if (order) {
            lines.push('');
            lines.push(orderBlock(order));
        }
        lines.push(openLink('/courier/orders/' + orderId));
        lines.push(footer());
        return {
            subject: 'Нове замовлення №' + orderId + ' для доставки',
            text: lines.join('\n')
        };
    },

    readyForPickup(orderId, order, courierName) {
        const name = courierName || 'Кур\'єре';
        return {
            title: 'Готово до видачі',
            body: '№' + orderId + ' — забирай на складі',
            email_subject: 'FlowersGo: №' + orderId + ' готове',
            email_body: roleEmail(
                'Вітаємо, ' + name + '!',
                'Замовлення №' + orderId + ' зібрано на складі. Забери букет для доставки клієнту.',
                order,
                '/courier/orders/' + orderId
            ),
            ntype: 'courier_ready',
            link_url: '/courier/orders/' + orderId
        };
    },

    cancelled(orderId, order, courierName) {
        const name = courierName || 'Кур\'єре';
        return {
            title: 'Замовлення скасовано',
            body: '№' + orderId + ' знято з маршруту',
            email_subject: 'FlowersGo: №' + orderId + ' скасовано',
            email_body: roleEmail(
                'Вітаємо, ' + name + '!',
                'Замовлення №' + orderId + ' скасовано і знято з вашого маршруту.',
                order,
                '/courier/orders'
            ),
            ntype: 'courier_order_cancelled',
            link_url: '/courier/orders'
        };
    },

    closed(orderId, order, courierName) {
        const name = courierName || 'Кур\'єре';
        return {
            title: 'Замовлення закрито',
            body: '№' + orderId + ' успішно завершено',
            email_subject: 'FlowersGo: №' + orderId + ' виконано',
            email_body: roleEmail(
                'Дякуємо, ' + name + '!',
                'Замовлення №' + orderId + ' успішно завершено. Гарної зміни!',
                order,
                '/courier/orders?view=history'
            ),
            ntype: 'order_closed_courier',
            link_url: '/courier/orders?view=history'
        };
    }
};

module.exports = {
    customer,
    admin,
    warehouse,
    courier
};
