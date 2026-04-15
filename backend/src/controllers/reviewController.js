const ProductModel = require('../models/Product');
const ReviewModel = require('../models/Review');

const createPageReview = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!Number.isFinite(productId) || productId <= 0) {
            return res.status(400).send('Невірний товар');
        }

        const product = await ProductModel.findById(productId);
        if (!product || Number(product.is_active) === 0) {
            return res.status(404).send('Товар не знайдено');
        }

        const user = res.locals.currentUser;

        const bodyRaw = req.body.comment;
        const comment = typeof bodyRaw === 'string' ? bodyRaw.trim() : '';

        const ratingRaw = req.body.rating;

        const ok = await ReviewModel.create({
            user_id: user.user_id,
            product_id: productId,
            order_id: null,
            rating: ratingRaw,
            comment
        });

        if (!ok) {
            return res.redirect(`/product/${productId}`);
        }

        return res.redirect(`/product/${productId}`);
    } catch (err) {
        return res.status(500).send('помилка');
    }
};

module.exports = {
    createPageReview
};
