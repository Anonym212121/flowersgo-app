const navCountsService = require('../services/navCountsService');

const pageNavCounts = async (req, res, next) => {
    try {
        res.locals.navCartCount = navCountsService.getCartCount(req);
        res.locals.navWishlistCount = await navCountsService.getWishlistCount(req, res);
        res.locals.wishlistProductIds = await navCountsService.getWishlistProductIds(req, res);
    } catch (err) {
        res.locals.navCartCount = 0;
        res.locals.navWishlistCount = 0;
        res.locals.wishlistProductIds = [];
    }
    return next();
};

module.exports = pageNavCounts;
