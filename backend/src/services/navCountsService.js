const cartService = require('./cartService');
const WishlistModel = require('../models/Wishlist');

const parseCookies = (cookieHeader) => {
    const result = {};
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return result;
    }
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const trimmed = part.trim();
        const idx = trimmed.indexOf('=');
        if (idx === -1) {
            continue;
        }
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (key) {
            result[key] = decodeURIComponent(val);
        }
    }
    return result;
};

const readGuestWishlistIds = (cookieHeader) => {
    const cookies = parseCookies(cookieHeader);
    if (!cookies.guest_wishlist) {
        return [];
    }
    try {
        const arr = JSON.parse(cookies.guest_wishlist);
        if (!Array.isArray(arr)) {
            return [];
        }
        return arr
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
            .slice(0, 100);
    } catch {
        return [];
    }
};

const getCartCount = (req) => {
    const items = cartService.getCartFromRequest(req);
    return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
};

const getWishlistCount = async (req, res) => {
    const raw = res.locals.currentUser && res.locals.currentUser.user_id;
    const userId = Number(raw);
    if (Number.isFinite(userId) && userId > 0) {
        return WishlistModel.countForUser(userId);
    }
    return readGuestWishlistIds(req.headers.cookie).length;
};

const getWishlistProductIds = async (req, res) => {
    const raw = res.locals.currentUser && res.locals.currentUser.user_id;
    const userId = Number(raw);
    if (Number.isFinite(userId) && userId > 0) {
        return WishlistModel.productIdsForUser(userId);
    }
    return readGuestWishlistIds(req.headers.cookie);
};

module.exports = {
    getCartCount,
    getWishlistCount,
    getWishlistProductIds,
    readGuestWishlistIds
};
