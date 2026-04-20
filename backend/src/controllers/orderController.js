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

module.exports = {};
