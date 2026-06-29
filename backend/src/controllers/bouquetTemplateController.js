const bouquetTemplateService = require('../services/bouquetTemplateService');
const BouquetTemplateModel = require('../models/BouquetTemplate');
const cartService = require('../services/cartService');
const constructorService = require('../services/constructorService');
const bouquetPreviewService = require('../services/bouquetPreviewService');
const constructorConfig = require('../config/constructor');

const listJson = async (req, res) => {
    try {
        if (!constructorConfig.isEnabled()) {
            return res.status(403).json({ message: 'Конструктор тимчасово недоступний' });
        }
        const templates = await bouquetTemplateService.listForClient();
        return res.json({ templates: templates });
    } catch (err) {
        console.error('bouquetTemplate listJson:', err.message);
        return res.status(500).json({ message: 'Помилка завантаження шаблонів' });
    }
};

const getJson = async (req, res) => {
    try {
        const slug = req.params.slug;
        const result = await bouquetTemplateService.getForClientBySlug(slug);
        if (!result.ok) {
            return res.status(404).json({ message: result.message || 'Шаблон не знайдено' });
        }
        return res.json(result);
    } catch (err) {
        console.error('bouquetTemplate getJson:', err.message);
        return res.status(500).json({ message: 'Помилка завантаження шаблону' });
    }
};

const addTemplateToCart = async (req, res) => {
    try {
        const slug = req.params.slug;
        const draftResult = await bouquetTemplateService.getDraftBySlug(slug);
        if (!draftResult.ok) {
            return res.status(404).json({ ok: false, message: draftResult.message || 'Шаблон не знайдено' });
        }

        const calc = draftResult.calc;
        if (!calc.ok) {
            return res.status(400).json({ ok: false, message: calc.message || 'Шаблон зараз недоступний' });
        }

        let cart = cartService.getCartFromRequest(req);
        for (let i = 0; i < calc.lines.length; i += 1) {
            const line = calc.lines[i];
            cart = cartService.addToCart(cart, line.product_id, line.quantity, line.color_variant_id);
        }

        if (calc.packagingProduct) {
            cart = cartService.addToCart(cart, calc.packagingProduct.id, 1);
        }

        cartService.setCartCookie(res, cart);

        const templateName = draftResult.template && draftResult.template.name ? draftResult.template.name : 'Шаблон';
        let note = 'Готовий букет «' + templateName + '»: ' + calc.summary;
        if (calc.packaging && calc.packaging.label) {
            note += '. Упаковка: ' + calc.packaging.label;
        }
        res.cookie(constructorService.CONSTRUCTOR_NOTE_COOKIE, note, {
            httpOnly: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        bouquetPreviewService.clearPreviewCookie(res);

        const totalCount = cart.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

        return res.json({
            ok: true,
            count: totalCount,
            total: calc.total,
            message: 'Букет «' + templateName + '» додано в кошик',
            redirect: '/cart'
        });
    } catch (err) {
        console.error('bouquetTemplate addTemplateToCart:', err.message);
        return res.status(500).json({ ok: false, message: 'Не вдалося додати в кошик' });
    }
};

module.exports = {
    listJson,
    getJson,
    addTemplateToCart
};
