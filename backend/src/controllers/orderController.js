const OrderModel = require('../models/Order');

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

const createOrder = async (req, res) => {
    try {
        const userId = getUserId(res);
        if (!userId) {
            if (wantsJson(req)) {
                return res.status(401).json({ message: 'Потрібно увійти' });
            }
            return res.redirect('/login');
        }

        if (wantsJson(req)) {
            return res.status(501).json({ message: 'Оформлення замовлення ще підключається' });
        }
        return res.status(501).send('Оформлення замовлення ще підключається');
    } catch (err) {
        console.error('createOrder:', err.message);
        if (wantsJson(req)) {
            return res.status(500).json({ message: 'помилка' });
        }
        return res.status(500).send('помилка');
    }
};

module.exports = {};
module.exports.createOrder = createOrder;
