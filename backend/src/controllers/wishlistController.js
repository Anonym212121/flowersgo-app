const WishlistModel = require('../models/Wishlist');
const ProductModel = require('../models/Product');
const navCountsService = require('../services/navCountsService');
const buildPageLayoutLocals = require('../utils/pageLayoutLocals');

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

    res.cookie('guest_wishlist', JSON.stringify(clean), {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
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
        return res.status(500).send('помилка');
    }
};

const addProduct = async (req, res) => {
    try {
        const productId = Number(req.body.product_id);
        if (!Number.isFinite(productId) || productId <= 0) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Невірний товар' });
            }
            return res.status(400).send('Невірний товар');
        }

        const userId = getUserId(res);
        if (userId) {
            await WishlistModel.add(userId, productId);
        } else {
            const ids = readGuestWishlist(req);
            if (!ids.includes(productId)) {
                ids.push(productId);
            }
            writeGuestWishlist(res, ids);
        }

        if (wantsJson(req)) {
            const count = userId
                ? await WishlistModel.countForUser(userId)
                : readGuestWishlist(req).length;
            return res.status(200).json({ ok: true, message: 'Додано в обране', count });
        }

        const back = req.get('Referer') || '/';
        return res.redirect(back);
    } catch (err) {
        console.error('addProduct:', err.message);
        if (wantsJson(req)) {
            return res.status(500).json({ message: 'помилка' });
        }
        return res.status(500).send('помилка');
    }
};

const removeProduct = async (req, res) => {
    try {
        const productId = Number(req.body.product_id);
        if (!Number.isFinite(productId) || productId <= 0) {
            if (wantsJson(req)) {
                return res.status(400).json({ message: 'Невірний товар' });
            }
            return res.status(400).send('Невірний товар');
        }

        const userId = getUserId(res);
        if (userId) {
            await WishlistModel.remove(userId, productId);
        } else {
            const ids = readGuestWishlist(req).filter((id) => id !== productId);
            writeGuestWishlist(res, ids);
        }

        if (wantsJson(req)) {
            const count = userId
                ? await WishlistModel.countForUser(userId)
                : readGuestWishlist(req).length;
            return res.status(200).json({ ok: true, message: 'Прибрано з обраного', count });
        }

        const back = req.get('Referer') || '/wishlist';
        return res.redirect(back);
    } catch (err) {
        console.error('removeProduct:', err.message);
        if (wantsJson(req)) {
            return res.status(500).json({ message: 'помилка' });
        }
        return res.status(500).send('помилка');
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
