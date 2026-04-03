const WishlistModel = require('../models/Wishlist');
const ProductModel = require('../models/Product');

const renderLayout = (res, title, bodyPartial, extraLocals = {}) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null,
        ...extraLocals
    });
};

const parseCookies = (cookieHeader) => {
    const result = {};
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return result;
    }
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const trimmed = part.trim();
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (key) {
            result[key] = decodeURIComponent(val);
        }
    }
    return result;
};

const readGuestWishlist = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    if (!cookies.guest_wishlist) {
        return [];
    }
    try {
        const arr = JSON.parse(cookies.guest_wishlist);
        if (!Array.isArray(arr)) return [];
        return arr
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
            .slice(0, 100);
    } catch {
        return [];
    }
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

        const back = req.get('Referer') || '/';
        return res.redirect(back);
    } catch (err) {
        console.error('addProduct:', err.message);
        return res.status(500).send('помилка');
    }
};

const removeProduct = async (req, res) => {
    try {
        const productId = Number(req.body.product_id);
        if (!Number.isFinite(productId) || productId <= 0) {
            return res.status(400).send('Невірний товар');
        }

        const userId = getUserId(res);
        if (userId) {
            await WishlistModel.remove(userId, productId);
        } else {
            const ids = readGuestWishlist(req).filter((id) => id !== productId);
            writeGuestWishlist(res, ids);
        }

        const back = req.get('Referer') || '/wishlist';
        return res.redirect(back);
    } catch (err) {
        console.error('removeProduct:', err.message);
        return res.status(500).send('помилка');
    }
};

module.exports = {
    wishlistPage,
    addProduct,
    removeProduct
};
