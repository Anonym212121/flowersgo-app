const ProductModel = require('../models/Product');
const cartService = require('../services/cartService');
const constructorService = require('../services/constructorService');
const bouquetPreviewService = require('../services/bouquetPreviewService');
const constructorConfig = require('../config/constructor');
const buildPageLayoutLocals = require('../utils/pageLayoutLocals');

const renderLayout = (res, title, bodyPartial, extraLocals = {}) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        ...buildPageLayoutLocals(res, extraLocals)
    });
};

const guardConstructorEnabled = (req, res) => {
    if (constructorConfig.isEnabled()) {
        return true;
    }
    res.status(403).json({ ok: false, message: 'Конструктор тимчасово недоступний' });
    return false;
};

const constructorPage = async (req, res) => {
    try {
        const settings = constructorService.getSettings();
        if (Number(settings.is_enabled) === 0) {
            return res.redirect('/');
        }

        const rawParts = await ProductModel.listConstructorStemsWithVariants();
        const flowerGroups = constructorService.groupPartsForPage(rawParts);
        const packagingOptions = await constructorService.listPackagingOptions();

        let templateSlug = '';
        if (req.query && typeof req.query.template === 'string') {
            templateSlug = req.query.template.trim();
        }

        return renderLayout(res, 'Конструктор букета', 'pages/constructor', {
            flowerGroups,
            packagingOptions,
            minStems: settings.min_stems,
            templateSlug: templateSlug,
            navPath: '/constructor'
        });
    } catch (err) {
        console.error('constructorPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const calcPayloadJson = (result) => {
    return {
        ok: result.ok,
        reason: result.reason || '',
        message: result.message || '',
        total: result.total,
        flowersSum: result.flowersSum,
        stemTotal: result.stemTotal,
        minStems: result.minStems,
        summary: result.summary,
        packagingLabel: result.packaging ? result.packaging.label : '',
        packagingPrice: result.packaging ? result.packaging.price : 0,
        lines: result.lines || []
    };
};

const calcJson = async (req, res) => {
    try {
        if (!guardConstructorEnabled(req, res)) {
            return;
        }

        const items = constructorService.parseItemsFromBody(req.body);
        const packagingId = req.body.packaging;
        const result = await constructorService.calcBouquet(items, packagingId);
        if (!result.ok) {
            if (result.lines && result.lines.length > 0) {
                return res.json(calcPayloadJson(result));
            }
            return res.status(400).json({ ok: false, message: result.message, reason: result.reason || '' });
        }
        return res.json(calcPayloadJson(result));
    } catch (err) {
        console.error('constructor calcJson:', err.message);
        return res.status(500).json({ ok: false, message: 'Помилка розрахунку' });
    }
};

const previewJson = async (req, res) => {
    try {
        if (!guardConstructorEnabled(req, res)) {
            return;
        }

        const items = constructorService.parseItemsFromBody(req.body);
        const packagingId = req.body.packaging;
        const result = await constructorService.calcBouquet(items, packagingId);
        if (!result.ok) {
            return res.status(400).json({ ok: false, message: result.message, reason: result.reason || '' });
        }

        const preview = bouquetPreviewService.buildPreviewForCalc(result);
        if (!preview.ok) {
            return res.status(400).json(preview);
        }

        bouquetPreviewService.setPreviewKeyCookie(res, preview.preview_key);

        if (preview.cached && preview.image_url) {
            bouquetPreviewService.applyPreviewUrl(res, preview.image_url);
        }

        return res.json(preview);
    } catch (err) {
        console.error('constructor previewJson:', err.message);
        return res.status(500).json({ ok: false, message: 'Помилка підготовки превʼю' });
    }
};

const savePreviewJson = async (req, res) => {
    try {
        if (!guardConstructorEnabled(req, res)) {
            return;
        }

        const previewKey = req.body.preview_key;
        if (!bouquetPreviewService.isAllowedPreviewKey(req, previewKey)) {
            return res.status(403).json({ ok: false, message: 'Немає дозволу на збереження превʼю' });
        }

        const image = req.body.image;
        const saved = bouquetPreviewService.savePreviewImage(previewKey, image);
        if (!saved.ok) {
            return res.status(400).json(saved);
        }

        bouquetPreviewService.applyPreviewUrl(res, saved.image_url);

        return res.json(saved);
    } catch (err) {
        console.error('constructor savePreviewJson:', err.message);
        return res.status(500).json({ ok: false, message: 'Не вдалося зберегти превʼю' });
    }
};

const previewClearJson = async (req, res) => {
    try {
        bouquetPreviewService.clearPreviewCookie(res);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Помилка' });
    }
};

const addToCart = async (req, res) => {
    try {
        if (!guardConstructorEnabled(req, res)) {
            return;
        }

        const items = constructorService.parseItemsFromBody(req.body);
        const packagingId = req.body.packaging;
        const result = await constructorService.calcBouquet(items, packagingId);
        if (!result.ok) {
            return res.status(400).json({ ok: false, message: result.message, reason: result.reason || '' });
        }

        let cart = cartService.getCartFromRequest(req);
        for (let i = 0; i < result.lines.length; i += 1) {
            const line = result.lines[i];
            cart = cartService.addToCart(cart, line.product_id, line.quantity, line.color_variant_id);
        }

        if (result.packagingProduct) {
            cart = cartService.addToCart(cart, result.packagingProduct.id, 1);
        }

        cartService.setCartCookie(res, cart);

        res.cookie(constructorService.CONSTRUCTOR_NOTE_COOKIE, result.note, {
            httpOnly: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        bouquetPreviewService.applyPreviewUrl(res, req.body.preview_url);

        const totalCount = cart.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

        return res.json({
            ok: true,
            count: totalCount,
            total: result.total,
            message: 'Букет додано в кошик',
            redirect: '/cart'
        });
    } catch (err) {
        console.error('constructor addToCart:', err.message);
        return res.status(500).json({ ok: false, message: 'Не вдалося додати в кошик' });
    }
};

module.exports = {
    constructorPage,
    calcJson,
    previewJson,
    savePreviewJson,
    previewClearJson,
    addToCart
};
