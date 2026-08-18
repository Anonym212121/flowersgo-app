const constructorConfig = require('../config/constructor');

const buildPageLayoutLocals = (res, extraLocals = {}) => {
    return {
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null,
        navPath: res.locals.navPath || '/',
        navCartCount: res.locals.navCartCount ?? 0,
        navWishlistCount: res.locals.navWishlistCount ?? 0,
        wishlistProductIds: Array.isArray(res.locals.wishlistProductIds)
            ? res.locals.wishlistProductIds
            : [],
        cartProductIds: Array.isArray(res.locals.cartProductIds)
            ? res.locals.cartProductIds
            : [],
        constructorEnabled: constructorConfig.isEnabled(),
        lang: res.locals.lang || 'uk',
        usdRate: res.locals.usdRate || 41.5,
        t: typeof res.locals.t === 'function' ? res.locals.t : function (key) { return key; },
        locName: typeof res.locals.locName === 'function' ? res.locals.locName : function (item) {
            return item && item.name ? item.name : '';
        },
        formatMoney: typeof res.locals.formatMoney === 'function'
            ? res.locals.formatMoney
            : function (uah) {
                return Number(uah || 0).toLocaleString('uk-UA') + ' грн';
            },
        translateUnit: typeof res.locals.translateUnit === 'function'
            ? res.locals.translateUnit
            : function (unit) { return unit || 'шт'; },
        localeDict: res.locals.localeDict || {},
        ...extraLocals
    };
};

module.exports = buildPageLayoutLocals;
