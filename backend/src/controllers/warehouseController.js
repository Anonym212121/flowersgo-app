const ProductModel = require('../models/Product');
const StockAdjustmentModel = require('../models/StockAdjustment');
const { LOW_STOCK_LIMIT } = require('../utils/warehouseOrderView');

const getUserId = (res) => {
    const raw = res.locals.currentUser && res.locals.currentUser.user_id;
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
        return null;
    }
    return userId;
};

const renderLayout = (res, title, bodyPartial, extraLocals) => {
    const locals = extraLocals || {};
    return res.status(200).render('layout', {
        title: title,
        bodyPartial: bodyPartial,
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null,
        navPath: res.locals.navPath || '/',
        ...locals
    });
};

const warehouseStockPage = async (req, res) => {
    try {
        const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const filter = typeof req.query.filter === 'string' ? req.query.filter.trim() : 'all';
        const typeFilter = typeof req.query.type === 'string' ? req.query.type.trim() : 'all';
        const okFlag = typeof req.query.ok === 'string' ? req.query.ok : '';
        const errFlag = typeof req.query.err === 'string' ? req.query.err : '';

        const products = await ProductModel.listStockForWarehouse({
            search,
            filter,
            typeFilter,
            lowLimit: LOW_STOCK_LIMIT
        });

        const summary = await ProductModel.summarizeStockForWarehouse(LOW_STOCK_LIMIT);
        const recentAdjustments = await StockAdjustmentModel.listRecent(12);

        let flashOk = '';
        let flashErr = '';
        if (okFlag === '1') {
            flashOk = 'Залишок оновлено';
        }
        if (errFlag === 'bad_data') {
            flashErr = 'Невірні дані для коригування';
        } else if (errFlag === 'not_found') {
            flashErr = 'Позицію не знайдено';
        } else if (errFlag === 'server') {
            flashErr = 'Помилка сервера';
        }

        return renderLayout(res, 'Залишки на складі', 'pages/warehouse/stock', {
            products,
            summary,
            recentAdjustments,
            lowStockLimit: LOW_STOCK_LIMIT,
            filterStock: filter,
            typeFilter: typeFilter,
            searchStock: search,
            flashOk: flashOk,
            flashErr: flashErr
        });
    } catch (err) {
        console.error('warehouseStockPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const warehouseStockAdjust = async (req, res) => {
    try {
        const userId = getUserId(res);
        if (!userId) {
            return res.redirect('/login');
        }

        const productId = Number(req.body.product_id);
        const variantRaw = req.body.variant_id;
        const variantId =
            variantRaw != null && String(variantRaw).trim() !== '' ? Number(variantRaw) : null;
        const delta = Number(req.body.delta);
        const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

        const result = await ProductModel.adjustStockForWarehouse({
            productId,
            variantId,
            delta,
            userId,
            note
        });

        const back =
            typeof req.body.return_to === 'string' && req.body.return_to.trim() !== ''
                ? req.body.return_to.trim()
                : '/warehouse/stock';

        if (!result.ok) {
            const code = result.message === 'Позицію не знайдено' || result.message === 'Товар не знайдено'
                ? 'not_found'
                : 'bad_data';
            const sep = back.indexOf('?') === -1 ? '?' : '&';
            return res.redirect(back + sep + 'err=' + code);
        }

        const sep = back.indexOf('?') === -1 ? '?' : '&';
        return res.redirect(back + sep + 'ok=1');
    } catch (err) {
        console.error('warehouseStockAdjust:', err.message);
        return res.redirect('/warehouse/stock?err=server');
    }
};

const warehouseStockPoll = async (req, res) => {
    try {
        const summary = await ProductModel.summarizeStockForWarehouse(LOW_STOCK_LIMIT);
        return res.status(200).json({ ok: true, summary: summary });
    } catch (err) {
        console.error('warehouseStockPoll:', err.message);
        return res.status(500).json({ ok: false, message: 'Помилка' });
    }
};

module.exports = {
    warehouseStockPage,
    warehouseStockAdjust,
    warehouseStockPoll
};
