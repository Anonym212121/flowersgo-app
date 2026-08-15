const ProductModel = require('../models/Product');
const ReviewModel = require('../models/Review');
const { looksLikeSpam } = require('../utils/spamText');
const sanitizeUserText = require('../utils/sanitizeUserText');
const {
    respondWithMessage,
    respondServerError,
    defaultCatalogActions
} = require('../utils/pageMessage');

const createPageReview = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!Number.isFinite(productId) || productId <= 0) {
            return respondWithMessage(req, res, 400, 'Невірний товар', {
                title: 'Відгук',
                messageTitle: 'Помилка',
                actions: defaultCatalogActions()
            });
        }

        const product = await ProductModel.findById(productId);
        if (!product || Number(product.is_active) === 0) {
            return respondWithMessage(req, res, 404, 'Товар не знайдено', {
                title: 'Відгук',
                messageTitle: 'Товар не знайдено',
                actions: defaultCatalogActions()
            });
        }

        const user = res.locals.currentUser;

        const comment = sanitizeUserText(req.body.comment, 2000);

        if (looksLikeSpam(comment)) {
            return respondWithMessage(req, res, 400, 'Відгук схожий на спам. Приберіть зайві посилання і спробуйте ще раз.', {
                title: 'Відгук',
                messageTitle: 'Відгук не прийнято',
                actions: [{ label: 'Назад до товару', href: '/product/' + productId, primary: true }]
            });
        }

        const recent = await ReviewModel.countRecentByUser(user.user_id, 10);
        if (recent >= 3) {
            return respondWithMessage(req, res, 429, 'Забагато відгуків за короткий час. Спробуйте пізніше.', {
                title: 'Відгук',
                messageTitle: 'Зачекайте трохи',
                actions: [{ label: 'Назад до товару', href: '/product/' + productId, primary: true }]
            });
        }

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
        console.error('createPageReview:', err.message);
        return respondServerError(req, res, { title: 'Відгук' });
    }
};

module.exports = {
    createPageReview
};
