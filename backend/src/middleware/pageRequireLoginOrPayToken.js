const { getPageUserId } = require('../utils/pageUser');
const paymentToken = require('../utils/paymentToken');
const liqpayService = require('../services/liqpayService');

const pageRequireLoginOrPayToken = (req, res, next) => {
    if (getPageUserId(res)) {
        return next();
    }

    const orderId = Number(req.params.orderId);
    if (orderId > 0 && paymentToken.verify(req.query.t, orderId)) {
        return next();
    }

    if (orderId > 0) {
        let data = req.query.data || (req.body && req.body.data) || '';
        let signature = req.query.signature || (req.body && req.body.signature) || '';
        const normalize = (raw) => {
            let value = String(raw).trim().replace(/ /g, '+');
            if (value.indexOf('%') !== -1) {
                try {
                    value = decodeURIComponent(value);
                } catch (err) {
                }
            }
            return value;
        };
        if (data) {
            data = normalize(data);
        }
        if (signature) {
            signature = normalize(signature);
        }
        if (data && signature && liqpayService.verifySignature(data, signature)) {
            const payload = liqpayService.parseData(data);
            if (payload && payload.order_id) {
                const parsedId = liqpayService.parseOrderIdFromLiqpay(payload.order_id);
                if (parsedId === orderId) {
                    return next();
                }
            }
        }
    }

    const accept = String(req.headers.accept || '').toLowerCase();
    if (accept.includes('application/json')) {
        return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
    }

    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/cabinet'));
};

module.exports = pageRequireLoginOrPayToken;
