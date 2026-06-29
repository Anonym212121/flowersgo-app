const OrderModel = require('../models/Order');
const StatusModel = require('../models/Status');
const OrderStatusLogModel = require('../models/OrderStatusLog');
const orderStatusService = require('../services/orderStatusService');
const orderWarehouseNotifyService = require('../services/orderWarehouseNotifyService');
const orderRoleNotifyService = require('../services/orderRoleNotifyService');
const courierAssignService = require('../services/courierAssignService');
const paymentToken = require('../utils/paymentToken');
const deliveryService = require('../services/deliveryService');
const DeliverySettings = require('../models/DeliverySettings');
const phoneValidator = require('../validators/phoneValidator');
const emailValidator = require('../validators/emailValidator');
const constructorService = require('../services/constructorService');
const bouquetPreviewService = require('../services/bouquetPreviewService');
const orderStockService = require('../services/orderStockService');
const orderPriceService = require('../services/orderPriceService');
const UserModel = require('../models/User');

const getUserId = (res) => {
    const raw = res.locals.currentUser && res.locals.currentUser.user_id;
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
        return null;
    }
    return userId;
};

const wantsJson = (req) => {
    const accept = req.headers.accept || '';
    return accept.includes('application/json');
};

const parseItemsFromBody = (raw) => {
    if (raw == null || raw === '') {
        return [];
    }
    if (Array.isArray(raw)) {
        return raw;
    }
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }
    return [];
};

const buildWarehouseRedirect = (req, body, suffix) => {
    const returnTo = typeof body.return_to === 'string' ? body.return_to.trim() : '';
    if (returnTo === 'detail') {
        const orderId = Number(req.params.id);
        return '/warehouse/orders/' + orderId + suffix;
    }

    const parts = [];
    const day = typeof body.return_day === 'string' ? body.return_day.trim() : '';
    const status = typeof body.return_status === 'string' ? body.return_status.trim() : '';
    const tab = typeof body.return_tab === 'string' ? body.return_tab.trim() : '';
    if (day) {
        parts.push('day=' + encodeURIComponent(day));
    }
    if (status) {
        parts.push('status=' + encodeURIComponent(status));
    }
    if (tab) {
        parts.push('tab=' + encodeURIComponent(tab));
    }

    let url = '/warehouse/orders' + suffix;
    if (parts.length > 0) {
        url += (suffix.indexOf('?') === -1 ? '?' : '&') + parts.join('&');
    }
    return url;
};

const parseDeliveryTimeFromBody = (body) => {
    const exact =
        typeof body.delivery_time_exact === 'string' && body.delivery_time_exact.trim() !== ''
            ? body.delivery_time_exact.trim()
            : '';
    if (exact) {
        return exact;
    }

    const slot = typeof body.delivery_slot === 'string' ? body.delivery_slot.trim() : '';
    if (slot) {
        return slot;
    }

    return typeof body.delivery_time === 'string' ? body.delivery_time.trim() : '';
};

const createOrder = async (req, res) => {
    try {
        const userId = getUserId(res);

        if (userId) {
            const blocked = await UserModel.isBlocked(userId);
            if (blocked) {
                if (wantsJson(req)) {
                    return res.status(403).json({ message: 'Обліковий запис заблоковано' });
                }
                return res.status(403).send('Обліковий запис заблоковано');
            }
        }

        const rawItems = parseItemsFromBody(req.body.items);
        const priceResult = await orderPriceService.resolveItemsPrices(rawItems);
        if (!priceResult.ok) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: priceResult.message });
            }
            return res.status(400).send(priceResult.message);
        }

        const items = priceResult.items;
        if (items.length === 0) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Додай хоча б один товар до замовлення' });
            }
            return res.status(400).send('Додай хоча б один товар до замовлення');
        }

        const first = typeof req.body.customer_first_name === 'string' ? req.body.customer_first_name.trim() : '';
        const last = typeof req.body.customer_last_name === 'string' ? req.body.customer_last_name.trim() : '';
        let phone = typeof req.body.customer_phone === 'string' ? req.body.customer_phone.trim() : '';
        let emailOpt = typeof req.body.customer_email === 'string' ? req.body.customer_email.trim() : '';

        if (!first || !last || !phone) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: "Заповни ім'я, прізвище та телефон" });
            }
            return res.status(400).send("Заповни ім'я, прізвище та телефон");
        }

        const phoneCheck = phoneValidator(phone);
        if (!phoneCheck.ok) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: phoneCheck.message });
            }
            return res.status(400).send(phoneCheck.message);
        }
        phone = phoneCheck.phone;

        if (emailOpt) {
            const emailCheck = emailValidator(emailOpt);
            if (!emailCheck.ok) {
                if (wantsJson(req)) {
                    return res.status(400).json({ message: emailCheck.message });
                }
                return res.status(400).send(emailCheck.message);
            }
            emailOpt = emailCheck.email;
        }

        const deliverySettingsRow = await DeliverySettings.get();
        const deliveryConfig = deliveryService.buildConfig(deliverySettingsRow);

        const delivery_method = req.body.delivery_method;
        const deliveryCheck = deliveryService.validateSelection({
            method: delivery_method,
            date: typeof req.body.delivery_date === 'string' ? req.body.delivery_date.trim() : '',
            time: parseDeliveryTimeFromBody(req.body)
        }, new Date(), deliveryConfig);

        if (!deliveryCheck.ok) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: deliveryCheck.message });
            }
            return res.status(400).send(deliveryCheck.message);
        }

        const delivery_fee = deliveryCheck.fee;
        const delivery_datetime = deliveryCheck.deliveryDatetime;

        let street = typeof req.body.delivery_street === 'string' ? req.body.delivery_street.trim() : '';
        let house = typeof req.body.delivery_house === 'string' ? req.body.delivery_house.trim() : '';
        let apartment = typeof req.body.delivery_apartment === 'string' ? req.body.delivery_apartment.trim() : '';

        if (delivery_method === 'pickup') {
            street = null;
            house = null;
            apartment = null;
        } else if (!street || !house) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Вкажи вулицю та будинок' });
            }
            return res.status(400).send('Вкажи вулицю та будинок');
        }

        const recipient_mode = req.body.recipient_mode === 'other' ? 'other' : 'self';
        const recFirst =
            typeof req.body.recipient_first_name === 'string' ? req.body.recipient_first_name.trim() : '';
        const recLast =
            typeof req.body.recipient_last_name === 'string' ? req.body.recipient_last_name.trim() : '';
        let recPhone =
            typeof req.body.recipient_phone === 'string' ? req.body.recipient_phone.trim() : '';
        const recNote =
            typeof req.body.recipient_note === 'string' ? req.body.recipient_note.trim() : '';

        if (recipient_mode === 'other') {
            if (!recFirst || !recLast || !recPhone) {
                if (wantsJson(req)) {
                    return res.status(400).json({ message: "Заповни ім'я, прізвище та телефон одержувача" });
                }
                return res.status(400).send("Заповни ім'я, прізвище та телефон одержувача");
            }

            const recPhoneCheck = phoneValidator(recPhone);
            if (!recPhoneCheck.ok) {
                if (wantsJson(req)) {
                    return res.status(400).json({ message: 'Телефон одержувача: ' + recPhoneCheck.message });
                }
                return res.status(400).send('Телефон одержувача: ' + recPhoneCheck.message);
            }
            recPhone = recPhoneCheck.phone;
        }

        const bouquetNote = constructorService.getNoteFromRequest(req);

        let receiver_name = '';
        let receiver_phone = '';
        if (recipient_mode === 'other' && recFirst && recLast && recPhone) {
            receiver_name = `${recFirst} ${recLast}`.replace(/\s+/g, ' ').trim();
            receiver_phone = recPhone;
        } else if (first && last) {
            receiver_name = `${first} ${last}`.replace(/\s+/g, ' ').trim();
            receiver_phone = phone;
        }

        const itemsTotal = priceResult.itemsTotal;
        const total_price = orderPriceService.roundMoney(itemsTotal + delivery_fee);

        const stockCheck = await orderStockService.validateItemsStock(items);
        if (!stockCheck.ok) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: stockCheck.message });
            }
            return res.status(400).send(stockCheck.message);
        }

        const orderId = await OrderModel.createWithTransaction({
            user_id: userId || null,
            customer_first_name: first,
            customer_last_name: last,
            customer_phone: phone,
            customer_email: emailOpt || null,
            delivery_street: delivery_method === 'pickup' ? null : street,
            delivery_house: delivery_method === 'pickup' ? null : house,
            delivery_apartment: delivery_method === 'pickup' ? null : apartment || null,
            recipient_note: recipient_mode === 'other' ? recNote || null : null,
            bouquet_note: bouquetNote || null,
            delivery_method,
            delivery_datetime,
            total_price,
            receiver_name,
            receiver_phone,
            items
        });

        if (!orderId) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Не вдалося оформити замовлення' });
            }
            return res.status(400).send('Не вдалося оформити замовлення');
        }

        const payment_method = req.body.payment_method === 'cod' ? 'cod' : 'card';
        if (payment_method === 'cod') {
            await OrderModel.updatePaymentStatus(orderId, 'cod');
            await orderStatusService.onCodConfirmed(orderId);
            try {
                await orderRoleNotifyService.onNewOrderForAdmin(orderId);
            } catch (notifyErr) {
                console.error('onNewOrderForAdmin:', notifyErr.message);
            }
            try {
                await orderWarehouseNotifyService.notifyCustomerOrderPlaced(
                    orderId,
                    'Оплата при отриманні. Очікуйте підтвердження адміністратора.'
                );
            } catch (notifyErr) {
                console.error('notifyCustomerOrderPlaced:', notifyErr.message);
            }
        } else {
            await OrderModel.updatePaymentStatus(orderId, 'unpaid');
            try {
                await orderWarehouseNotifyService.notifyCustomerOrderPlaced(
                    orderId,
                    'Завершіть оплату протягом 10 хвилин на сторінці оплати.'
                );
            } catch (notifyErr) {
                console.error('notifyCustomerOrderPlaced:', notifyErr.message);
            }
        }

        if (String(req.body.checkout_source || '') === 'cart') {
            res.clearCookie('cart_items');
            constructorService.clearNoteCookie(res);
            bouquetPreviewService.clearPreviewCookie(res);
        }

        const token = paymentToken.makeForOrder(orderId, userId || 0);
        const t = encodeURIComponent(token);

        let redirectUrl = '/cabinet?ok=order_created';
        if (!userId) {
            if (payment_method === 'cod') {
                redirectUrl = '/order/success/' + orderId + '?t=' + t + '&ok=order_created';
            } else {
                redirectUrl = '/payment/' + orderId + '?t=' + t;
            }
        } else if (payment_method !== 'cod') {
            redirectUrl = '/payment/' + orderId + '?t=' + t;
        }
        if (wantsJson(req)) {
            return res.status(200).json({ ok: true, order_id: orderId, redirect: redirectUrl });
        }
        return res.redirect(redirectUrl);
    } catch (err) {
        console.error('createOrder:', err.message);
        if (wantsJson(req)) {
            return res.status(500).json({ message: 'помилка' });
        }
        return res.status(500).send('помилка');
    }
};

const updateOrderStatusForWarehouse = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const statusId = Number(req.body.status_id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=bad_order'));
        }
        if (!Number.isFinite(statusId) || statusId <= 0) {
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=bad_status'));
        }

        const allowedStatuses = await StatusModel.listForWarehouse();
        const currentOrder = await OrderModel.getByIdForWarehouse(orderId);
        if (!currentOrder) {
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=not_found'));
        }
        if (currentOrder.cancel_request_at) {
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=cancel_pending'));
        }

        const allowedStatusIds = allowedStatuses.map((row) => Number(row.id));
        if (!allowedStatusIds.includes(statusId)) {
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=status_unavailable'));
        }

        const transitionOk = await StatusModel.canTransition(currentOrder.status_id, statusId);
        if (!transitionOk) {
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=invalid_transition'));
        }

        let targetStatusName = '';
        for (const row of allowedStatuses) {
            if (Number(row.id) === statusId) {
                targetStatusName = row.status_name;
                break;
            }
        }
        if (!targetStatusName) {
            const targetRow = await StatusModel.getById(statusId);
            if (targetRow) {
                targetStatusName = targetRow.status_name;
            }
        }

        if (targetStatusName === 'delivered') {
            if (currentOrder.delivery_method !== 'pickup' || currentOrder.status_name !== 'ready_for_pickup') {
                return res.redirect(buildWarehouseRedirect(req, req.body, '?err=invalid_transition'));
            }
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=use_pickup_complete'));
        }

        if (targetStatusName === 'shipped') {
            if (currentOrder.delivery_method === 'pickup') {
                return res.redirect(buildWarehouseRedirect(req, req.body, '?err=invalid_transition'));
            }
            if (currentOrder.status_name !== 'ready_for_pickup') {
                return res.redirect(buildWarehouseRedirect(req, req.body, '?err=invalid_transition'));
            }
            if (!currentOrder.courier_id) {
                return res.redirect(buildWarehouseRedirect(req, req.body, '?err=no_courier'));
            }
        }

        const ok = await OrderModel.updateStatusByWarehouse(orderId, statusId, Number(currentOrder.status_id));
        if (!ok) {
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=update_failed'));
        }

        const oldStatusId = Number(currentOrder.status_id);
        if (oldStatusId !== statusId) {
            const workerId = getUserId(res);
            try {
                await OrderStatusLogModel.insert({
                    order_id: orderId,
                    user_id: workerId,
                    from_status_id: oldStatusId,
                    to_status_id: statusId
                });
            } catch (logErr) {
                console.error('order status log:', logErr.message);
            }
        }

        let newStatusName = targetStatusName || currentOrder.status_name;

        if (newStatusName !== currentOrder.status_name) {
            try {
                await orderWarehouseNotifyService.notifyCustomerOnStatus(orderId, newStatusName);
            } catch (notifyErr) {
                console.error('notifyCustomerOnStatus:', notifyErr.message);
            }
        }

        if (newStatusName === 'ready_for_pickup') {
            try {
                await courierAssignService.tryAutoAssign(orderId);
            } catch (assignErr) {
                console.error('tryAutoAssign:', assignErr.message);
            }
        }

        if (newStatusName === 'ready_for_pickup') {
            try {
                const updated = await OrderModel.getByIdForAssign(orderId);
                if (updated && updated.courier_id) {
                    await orderRoleNotifyService.onOrderReadyForCourier(orderId, updated.courier_id);
                }
            } catch (readyErr) {
                console.error('onOrderReadyForCourier:', readyErr.message);
            }
        }

        return res.redirect(buildWarehouseRedirect(req, req.body, '?ok=1'));
    } catch (err) {
        console.error('updateOrderStatusForWarehouse:', err.message);
        return res.redirect(buildWarehouseRedirect(req, req.body, '?err=server'));
    }
};

const completePickupByWarehouse = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=bad_order'));
        }

        const confirmCod =
            req.body.confirm_cod === '1' ||
            req.body.confirm_cod === 'on' ||
            req.body.confirm_cod === true;

        const result = await OrderModel.completePickupByWarehouse(orderId, { confirmCod });
        if (!result.ok) {
            const codeMap = {
                not_found: 'not_found',
                not_ready: 'pickup_not_ready',
                need_cod_confirm: 'pickup_need_cod',
                not_paid: 'pickup_not_paid',
                invalid_transition: 'invalid_transition',
                no_status: 'bad_status'
            };
            const errCode = codeMap[result.code] || 'update_failed';
            return res.redirect(buildWarehouseRedirect(req, req.body, '?err=' + errCode));
        }

        const workerId = getUserId(res);
        if (result.from_status_id && result.to_status_id && result.from_status_id !== result.to_status_id) {
            try {
                await OrderStatusLogModel.insert({
                    order_id: orderId,
                    user_id: workerId,
                    from_status_id: result.from_status_id,
                    to_status_id: result.to_status_id
                });
            } catch (logErr) {
                console.error('pickup complete log:', logErr.message);
            }
        }

        try {
            await orderWarehouseNotifyService.notifyCustomerOnStatus(orderId, 'accepted');
        } catch (notifyErr) {
            console.error('notifyCustomerOnStatus pickup:', notifyErr.message);
        }

        try {
            await orderRoleNotifyService.onPickupCompleted(orderId);
        } catch (notifyErr) {
            console.error('onPickupCompleted:', notifyErr.message);
        }

        return res.redirect(buildWarehouseRedirect(req, req.body, '?ok=pickup_done'));
    } catch (err) {
        console.error('completePickupByWarehouse:', err.message);
        return res.redirect(buildWarehouseRedirect(req, req.body, '?err=server'));
    }
};

module.exports = {
    createOrder,
    updateOrderStatusForWarehouse,
    completePickupByWarehouse
};
