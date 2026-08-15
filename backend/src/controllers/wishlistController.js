const WishlistModel = require('../models/Wishlist');
const ProductModel = require('../models/Product');
const navCountsService = require('../services/navCountsService');
const buildPageLayoutLocals = require('../utils/pageLayoutLocals');
const cookieBase = require('../utils/cookieBase');
const {
    respondWithMessage,
    respondServerError,
    defaultWishlistActions,
    defaultCatalogActions
} = require('../utils/pageMessage');

const renderLayout = (res, title, bodyPartial, extraLocals = {}) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        ...buildPageLayoutLocals(res, extraLocals)
    });
};

const readGuestWishlist = (req) => {
    return navCountsService.readGuestWishlistIds(req.headers.cookie);
};

const writeGuestWishlist = (res, ids) => {
    const clean = ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
        .slice(0, 100);

    res.cookie('guest_wishlist', JSON.stringify(clean), cookieBase({
        maxAge: 30 * 24 * 60 * 60 * 1000
    }));
};

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

const safeBackUrl = (req, fallback) => {
    const raw = req.get('Referer') || '';
    const host = String(req.get('host') || '');
    if (!raw || !host) {
        return fallback;
    }
    try {
        const url = new URL(raw);
        if (url.host !== host) {
            return fallback;
        }
        return url.pathname + url.search;
    } catch {
        return fallback;
    }
};

const wishlistPage = async (req, res) => {
    try {
        let products = [];

        const userId = getUserId(res);
        if (userId) {
            products = await WishlistModel.listForUser(userId);
        } else {
            const ids = readGuestWishlist(req);
            products = await ProductModel.productsByIds(ids);
        }

        return renderLayout(res, 'Обране', 'pages/wishlist', { products });
    } catch (err) {
        console.error('wishlistPage:', err.message);
        return respondServerError(req, res, { title: 'Обране', actions: defaultWishlistActions() });
    }
};

const addProduct = async (req, res) => {
    try {
        const productId = Number(req.body.product_id);
        if (!Number.isFinite(productId) || productId <= 0) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Невірний товар' });
            }
            return respondWithMessage(req, res, 400, 'Невірний товар', {
                title: 'Обране',
                messageTitle: 'Помилка',
                actions: defaultWishlistActions()
            });
        }

        const userId = getUserId(res);
        let ids = [];
        if (userId) {
            await WishlistModel.add(userId, productId);
            ids = await WishlistModel.productIdsForUser(userId);
        } else {
            ids = readGuestWishlist(req);
            if (!ids.includes(productId)) {
                ids.push(productId);
            }
            writeGuestWishlist(res, ids);
        }

        if (wantsJson(req)) {
            return res.status(200).json({
                ok: true,
                message: 'Додано в обране',
                count: ids.length,
                ids
            });
        }

        return res.redirect(safeBackUrl(req, '/'));
    } catch (err) {
        console.error('addProduct:', err.message);
        if (wantsJson(req)) {
            return res.status(500).json({ message: 'помилка' });
        }
        return respondServerError(req, res, { title: 'Обране', actions: defaultWishlistActions() });
    }
};

const removeProduct = async (req, res) => {
    try {
        const productId = Number(req.body.product_id);
        if (!Number.isFinite(productId) || productId <= 0) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Невірний товар' });
            }
            return respondWithMessage(req, res, 400, 'Невірний товар', {
                title: 'Обране',
                messageTitle: 'Помилка',
                actions: defaultWishlistActions()
            });
        }

        const userId = getUserId(res);
        let ids = [];
        if (userId) {
            await WishlistModel.remove(userId, productId);
            ids = await WishlistModel.productIdsForUser(userId);
        } else {
            ids = readGuestWishlist(req).filter((id) => id !== productId);
            writeGuestWishlist(res, ids);
        }

        if (wantsJson(req)) {
            return res.status(200).json({
                ok: true,
                message: 'Прибрано з обраного',
                count: ids.length,
                ids
            });
        }

        return res.redirect(safeBackUrl(req, '/wishlist'));
    } catch (err) {
        console.error('removeProduct:', err.message);
        if (wantsJson(req)) {
            return res.status(500).json({ message: 'помилка' });
        }
        return respondServerError(req, res, { title: 'Обране', actions: defaultWishlistActions() });
    }
};

const listProductIdsJson = async (req, res) => {
    try {
        const ids = await navCountsService.getWishlistProductIds(req, res);
        return res.status(200).json({ ok: true, ids });
    } catch (err) {
        console.error('listProductIdsJson:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    wishlistPage,
    addProduct,
    removeProduct,
    listProductIdsJson
};
