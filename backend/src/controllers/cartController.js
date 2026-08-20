const ProductModel = require('../models/Product');
const cartService = require('../services/cartService');
const constructorService = require('../services/constructorService');
const bouquetPreviewService = require('../services/bouquetPreviewService');

const wantsJson = (req) => {
    const accept = String(req.headers.accept || '');
    return accept.includes('application/json');
};

const add = async (req, res) => {
    try {
        const product_id = Number(req.body.product_id);
        const product = await ProductModel.findById(product_id);
        if (!product || Number(product.is_active) === 0 || Number(product.stock_quantity) <= 0) {
            return res.status(400).json({ ok: false, message: 'Товар недоступний' });
        }
        if (Number(product.is_constructor) === 1) {
            return res.status(400).json({
                ok: false,
                message: 'Цю квітку можна додати лише через конструктор букета'
            });
        }

        const current = cartService.getCartFromRequest(req);
        if (cartService.hasProduct(current, product_id)) {
            return res.json({
                ok: true,
                already: true,
                count: cartService.countItems(current),
                product_ids: cartService.listProductIds(current),
                message: 'Товар уже в кошику. Кількість можна змінити в кошику'
            });
        }

        const next = cartService.addToCart(current, product_id, 1);
        cartService.setCartCookie(res, next);

        return res.json({
            ok: true,
            already: false,
            count: cartService.countItems(next),
            product_ids: cartService.listProductIds(next),
            message: 'Товар додано в кошик'
        });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Помилка кошика' });
    }
};

const update = async (req, res) => {
    try {
        const product_id = Number(req.body.product_id);
        const quantity = Number(req.body.quantity);
        const color_variant_id = req.body.color_variant_id;
        const current = cartService.getCartFromRequest(req);
        const next = cartService.updateCartItem(current, product_id, quantity, color_variant_id);
        cartService.setCartCookie(res, next);
        return res.json({
            ok: true,
            count: cartService.countItems(next)
        });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Не вдалося оновити кошик' });
    }
};

const remove = async (req, res) => {
    try {
        const product_id = Number(req.body.product_id);
        const color_variant_id = req.body.color_variant_id;
        const current = cartService.getCartFromRequest(req);
        const next = cartService.removeFromCart(current, product_id, color_variant_id);
        cartService.setCartCookie(res, next);
        return res.json({
            ok: true,
            count: cartService.countItems(next)
        });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Не вдалося видалити товар' });
    }
};

const clear = (req, res) => {
    cartService.clearCartCookie(res);
    constructorService.clearNoteCookie(res);
    bouquetPreviewService.clearPreviewCookie(res);
    if (wantsJson(req)) {
        return res.json({ ok: true });
    }
    return res.redirect('/cart');
};

module.exports = {
    add,
    update,
    remove,
    clear
};
