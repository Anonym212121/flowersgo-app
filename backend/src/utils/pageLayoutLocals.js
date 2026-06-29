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
        ...extraLocals
    };
};

module.exports = buildPageLayoutLocals;
