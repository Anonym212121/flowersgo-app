const navCountsService = require('../services/navCountsService');

const skipHeavyCounts = (req) => {
    const method = String(req.method || '').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        return true;
    }
    const path = String(req.path || '');
    if (path.startsWith('/api/')) {
        return true;
    }
    if (path.endsWith('/poll')) {
        return true;
    }
    return false;
};

const pageNavCounts = async (req, res, next) => {
    if (skipHeavyCounts(req)) {
        res.locals.navCartCount = navCountsService.getCartCount(req);
        res.locals.cartProductIds = navCountsService.getCartProductIds(req);
        res.locals.navWishlistCount = 0;
        res.locals.wishlistProductIds = [];
        return next();
    }

    try {
        res.locals.navCartCount = navCountsService.getCartCount(req);
        res.locals.cartProductIds = navCountsService.getCartProductIds(req);
        const ids = await navCountsService.getWishlistProductIds(req, res);
        res.locals.wishlistProductIds = ids;
        res.locals.navWishlistCount = ids.length;
    } catch (err) {
        res.locals.navCartCount = 0;
        res.locals.cartProductIds = [];
        res.locals.navWishlistCount = 0;
        res.locals.wishlistProductIds = [];
    }
    return next();
};

module.exports = pageNavCounts;
