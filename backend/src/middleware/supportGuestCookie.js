const crypto = require('crypto');
const cookieBase = require('../utils/cookieBase');

const GUEST_COOKIE = 'support_guest_token';
const GUEST_COOKIE_DAYS = 365;

const hasGuestCookie = (cookieHeader) => {
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return false;
    }
    const parts = cookieHeader.split(';');
    for (let i = 0; i < parts.length; i++) {
        const trimmed = parts[i].trim();
        if (trimmed.indexOf(GUEST_COOKIE + '=') !== 0) {
            continue;
        }
        const value = trimmed.slice(GUEST_COOKIE.length + 1).trim();
        return value.length >= 8;
    }
    return false;
};

const supportGuestCookie = (req, res, next) => {
    if (!hasGuestCookie(req.headers.cookie)) {
        const token = crypto.randomBytes(16).toString('hex');
        res.cookie(GUEST_COOKIE, token, cookieBase({
            maxAge: GUEST_COOKIE_DAYS * 24 * 60 * 60 * 1000
        }));
    }
    return next();
};

module.exports = supportGuestCookie;
