const OrderModel = require('../models/Order');
const liqpayService = require('../services/liqpayService');
const paymentService = require('../services/paymentService');
const { paymentStatusLabel } = require('../utils/paymentStatusLabel');
const paymentApplyService = require('../services/paymentApplyService');
const paymentSyncService = require('../services/paymentSyncService');
const { getPageUserId } = require('../utils/pageUser');
const paymentToken = require('../utils/paymentToken');

const getRequestBaseUrl = (req) => {
    const host = req.get('host');
    if (!host) {
        return '';
    }
    const proto = req.protocol || 'http';
    return proto + '://' + host;
};

const getPublicBaseUrl = (req) => {
    const fromEnv = process.env.APP_BASE_URL;
    if (fromEnv && fromEnv.trim() !== '') {
        return fromEnv.trim().replace(/\/+$/, '');
    }
    return getRequestBaseUrl(req);
};

const renderLayout = (res, title, bodyPartial, extraLocals) => {
    const locals = extraLocals || {};
    return res.status(200).render('layout', {
        title: title,
        bodyPartial: bodyPartial,
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null,
        navPath: res.locals.navPath || '/',
        ...locals
    });
};

const tryLiqpayReturnPayload = (req) => {
    let data = req.query.data || (req.body && req.body.data);
    let signature = req.query.signature || (req.body && req.body.signature);
    if (!data || !signature) {
        return null;
    }
    data = String(data).replace(/ /g, '+');
    signature = String(signature).replace(/ /g, '+');
    if (!liqpayService.verifySignature(data, signature)) {
        return null;
    }
    return liqpayService.parseData(data);
};

const resolvePaymentAccess = async (req, res, orderId, order) => {
    const currentUserId = getPageUserId(res);
    if (currentUserId && (await OrderModel.belongsToUser(orderId, currentUserId))) {
        return true;
    }

    const tokenInfo = paymentToken.verify(req.query.t, orderId);
    if (tokenInfo && order) {
        const orderUid = order.user_id == null ? 0 : Number(order.user_id);
        if (tokenInfo.userId === orderUid) {
            return true;
        }
    }

    const liqpayPayload = tryLiqpayReturnPayload(req);
    if (liqpayPayload && order) {
        const parsedId = liqpayService.parseOrderIdFromLiqpay(liqpayPayload.order_id);
        if (parsedId === orderId) {
            return true;
        }
    }

    return false;
};

const payPage = async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        if (!orderId || orderId <= 0) {
            return res.status(404).send('Замовлення не знайдено');
        }

        let order = await OrderModel.getByIdForPayment(orderId);
        if (!order) {
            return res.status(404).send('Замовлення не знайдено');
        }

        const canAccess = await resolvePaymentAccess(req, res, orderId, order);
        if (!canAccess) {
            return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/cabinet'));
        }

        order = await paymentSyncService.syncOrderPaymentFromLiqpay(orderId);

        const isGuest = order.user_id == null;
        const tokenUid = isGuest ? 0 : Number(order.user_id);
        const payToken = paymentToken.makeForOrder(order.id, tokenUid);
        const successBase = '/order/success/' + order.id + '?t=' + encodeURIComponent(payToken);

        if (order.payment_status === 'paid') {
            if (isGuest) {
                return res.redirect(successBase + '&ok=payment_paid');
            }
            return res.redirect('/cabinet?ok=payment_paid');
        }

        if (order.payment_status === 'cod') {
            if (isGuest) {
                return res.redirect(successBase);
            }
            return res.redirect('/cabinet?err=payment_not_needed');
        }

        const blockReason = paymentService.getPaymentBlockReason(order);
        if (blockReason === 'rejected') {
            if (isGuest) {
                return res.redirect(successBase + '&err=rejected');
            }
            return res.redirect('/cabinet?err=payment_rejected');
        }
        if (blockReason === 'cancel_pending') {
            if (isGuest) {
                return res.redirect(successBase + '&err=cancel_pending');
            }
            return res.redirect('/cabinet?err=cancel_pending');
        }
        if (blockReason !== 'ok') {
            if (isGuest) {
                return res.redirect(successBase + '&err=expired');
            }
            return res.redirect('/cabinet?err=payment_expired');
        }

        const keys = liqpayService.getKeys();
        if (!keys.publicKey || !keys.privateKey) {
            return res.status(500).send('LiqPay не налаштовано. Додайте ключі в .env');
        }

        const amount = Number(order.total_amount);
        if (!amount || amount < 1) {
            return res.status(400).send('Сума замовлення некоректна');
        }

        const resultBaseUrl = getRequestBaseUrl(req) || getPublicBaseUrl(req);
        const callbackBaseUrl = getPublicBaseUrl(req);
        const token = paymentToken.makeForOrder(order.id, tokenUid);
        const resultUrl = resultBaseUrl + '/payment/result/' + order.id + '?t=' + encodeURIComponent(token);

        let orderRef = order.liqpay_last_ref ? String(order.liqpay_last_ref).trim() : '';
        if (!orderRef) {
            orderRef = liqpayService.makeLiqpayOrderRef(order.id);
            await OrderModel.updateLiqpayLastRef(order.id, orderRef);
        }

        const form = liqpayService.buildCheckoutForm({
            orderId: order.id,
            amount: amount,
            description: 'Замовлення #' + order.id + ' - FlowersGo',
            resultUrl: resultUrl,
            serverUrl: callbackBaseUrl + '/payment/liqpay/callback',
            orderRef: orderRef
        });

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.status(200).render('pages/payment-submit', {
            order: order,
            liqpayData: form.data,
            liqpaySignature: form.signature,
            isSandbox: liqpayService.isSandbox()
        });
    } catch (err) {
        console.error('payPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const callback = async (req, res) => {
    try {
        const data = req.body.data;
        const signature = req.body.signature;
        if (!liqpayService.verifySignature(data, signature)) {
            return res.status(400).send('bad signature');
        }

        const payload = liqpayService.parseData(data);
        if (!payload || !payload.order_id) {
            return res.status(400).send('bad data');
        }

        const orderId = liqpayService.parseOrderIdFromLiqpay(payload.order_id);
        if (!orderId) {
            return res.status(400).send('bad order id');
        }

        await paymentApplyService.applyLiqpayStatus(orderId, payload);
        return res.status(200).send('ok');
    } catch (err) {
        console.error('liqpay callback:', err.message);
        return res.status(500).send('error');
    }
};

const result = async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        if (!orderId || orderId <= 0) {
            return res.status(404).send('Замовлення не знайдено');
        }

        let order = await OrderModel.getByIdForPayment(orderId);
        if (!order) {
            return res.status(404).send('Замовлення не знайдено');
        }

        const canAccess = await resolvePaymentAccess(req, res, orderId, order);
        if (!canAccess) {
            return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/cabinet'));
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

        const liqpayPayload = tryLiqpayReturnPayload(req);
        if (liqpayPayload) {
            const parsedId = liqpayService.parseOrderIdFromLiqpay(liqpayPayload.order_id);
            if (parsedId === orderId) {
                await paymentApplyService.applyLiqpayStatus(orderId, liqpayPayload);
            }
        }

        order = await paymentSyncService.syncOrderPaymentFromLiqpay(orderId);

        const isGuest = order.user_id == null;
        const tokenUid = isGuest ? 0 : Number(order.user_id);
        const payToken = paymentToken.makeForOrder(order.id, tokenUid);

        if (order.payment_status === 'paid') {
            if (isGuest) {
                return res.redirect(
                    '/order/success/' + order.id + '?t=' + encodeURIComponent(payToken) + '&ok=payment_paid'
                );
            }
            return res.redirect('/cabinet?ok=payment_paid');
        }

        const canPayAgain = paymentService.getPaymentBlockReason(order) === 'ok';
        return renderLayout(res, 'Результат оплати', 'pages/payment-result', {
            order: order,
            payToken: payToken,
            canPayAgain: canPayAgain,
            paymentStatusText: paymentStatusLabel(order.payment_status)
        });
    } catch (err) {
        console.error('payment result:', err.message);
        return res.status(500).send('помилка');
    }
};

const syncStatus = async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        if (!orderId || orderId <= 0) {
            return res.status(400).json({ ok: false, message: 'Невірний номер замовлення' });
        }

        const currentUserId = getPageUserId(res);
        if (!currentUserId || !(await OrderModel.belongsToUser(orderId, currentUserId))) {
            return res.status(403).json({ ok: false, message: 'Немає доступу' });
        }

        const order = await paymentSyncService.syncOrderPaymentFromLiqpay(orderId);
        if (!order) {
            return res.status(404).json({ ok: false, message: 'Замовлення не знайдено' });
        }

        return res.json({
            ok: true,
            payment_status: order.payment_status,
            paid: order.payment_status === 'paid'
        });
    } catch (err) {
        console.error('payment syncStatus:', err.message);
        return res.status(500).json({ ok: false, message: 'помилка' });
    }
};

module.exports = { payPage, callback, result, syncStatus };
