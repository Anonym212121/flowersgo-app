const WishlistModel = require('../models/Wishlist');

const renderLayout = (res, title, bodyPartial, extraLocals = {}) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null,
        ...extraLocals
    });
};

const wishlistPage = async (req, res) => {
    try {
        const userId = res.locals.currentUser.user_id;
        const products = await WishlistModel.listForUser(userId);
        return renderLayout(res, 'Обране', 'pages/wishlist', { products });
    } catch (err) {
        return res.status(500).send('помилка');
    }
};
const addProduct = async (req, res) => {
    try {
        const userId = res.locals.currentUser.user_id;
        const productId = Number(req.body.product_id);
        if (!Number.isFinite(productId) || productId <= 0) {
            return res.status(400).send('Невірний товар');
        }
        await WishlistModel.add(userId, productId);
        const back = req.get('Referer') || '/';
        return res.redirect(back);
    } catch (err) {
        return res.status(500).send('помилка');
    }
};
    const deletewishProduct = async (req, res) => {
        try {
            const userId = res.locals.currentUser.user_id;
            const productId = Number(req.body.product_id);
            if (!Number.isFinite(productId) || productId <= 0) {
                return res.status(400).send('Невірний товар');
            }
            await WishlistModel.remove(userId, productId);
            const back = req.get('Referer') || '/wishlist';
            return res.redirect(back);
        } catch (err) {
            return res.status(500).send('помилка');
        }
};
module.exports = {
    wishlistPage,
    addProduct,
    deletewishProduct   
};