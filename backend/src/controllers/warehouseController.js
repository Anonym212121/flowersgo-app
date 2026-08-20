const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ProductModel = require('../models/Product');
const OrderModel = require('../models/Order');
const StockAdjustmentModel = require('../models/StockAdjustment');
const cloudinaryService = require('../services/cloudinaryService');
const orderWarehouseNotifyService = require('../services/orderWarehouseNotifyService');
const { LOW_STOCK_LIMIT } = require('../utils/warehouseOrderView');
const { respondServerError, defaultWarehouseActions } = require('../utils/pageMessage');

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
        return respondServerError(req, res, { title: 'Склад', actions: defaultWarehouseActions() });
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

const assembledDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'assembled');

const ensureAssembledDir = () => {
    if (!fs.existsSync(assembledDir)) {
        fs.mkdirSync(assembledDir, { recursive: true });
    }
};

const assembledStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureAssembledDir();
        cb(null, assembledDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const safeExt = allowedExt.includes(ext) ? ext : '.jpg';
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
        cb(null, name);
    }
});

const assembledFileFilter = (req, file, cb) => {
    const allowedMime = /^(image\/jpeg|image\/jpg|image\/png|image\/gif|image\/webp)$/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (allowedMime.test(file.mimetype || '') || allowedExt.includes(ext)) {
        return cb(null, true);
    }
    cb(new Error('Дозволені лише зображення: jpeg, png, gif, webp'));
};

const assembledUpload = multer({
    storage: assembledStorage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: assembledFileFilter
});

const uploadAssembledPhotoMiddleware = assembledUpload.single('photo');

const removeLocalAssembled = (publicUrl) => {
    if (!publicUrl || typeof publicUrl !== 'string') {
        return;
    }
    if (!publicUrl.startsWith('/uploads/assembled/')) {
        return;
    }
    const oldPath = path.join(__dirname, '..', '..', 'public', publicUrl.replace('/uploads/', 'uploads/'));
    if (fs.existsSync(oldPath)) {
        try {
            fs.unlinkSync(oldPath);
        } catch {
        }
    }
};

const redirectAssembledPhoto = (res, orderId, query) => {
    return res.redirect('/warehouse/orders/' + orderId + '?' + query);
};

const uploadAssembledPhoto = async (req, res) => {
    const orderId = Number(req.params.id);
    const unlinkCurrent = () => {
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {
            }
        }
    };

    try {
        if (!Number.isFinite(orderId) || orderId <= 0) {
            unlinkCurrent();
            return res.redirect('/warehouse/orders?err=server');
        }

        const order = await OrderModel.getByIdForWarehouse(orderId);
        if (!order) {
            unlinkCurrent();
            return redirectAssembledPhoto(res, orderId, 'err=photo_order');
        }

        const statusName = String(order.status_name || '');
        if (statusName === 'cancelled' || statusName === 'rejected') {
            unlinkCurrent();
            return redirectAssembledPhoto(res, orderId, 'err=photo_closed');
        }

        if (!req.file) {
            return redirectAssembledPhoto(res, orderId, 'err=photo_empty');
        }

        const stored = await cloudinaryService.storeMulterFile(
            req.file,
            'flowersgo/assembled',
            '/uploads/assembled/' + req.file.filename
        );
        if (!stored.ok) {
            unlinkCurrent();
            return redirectAssembledPhoto(res, orderId, 'err=photo_save');
        }

        const saved = await OrderModel.updateAssembledPhotoUrl(orderId, stored.url);
        if (!saved.ok) {
            unlinkCurrent();
            return redirectAssembledPhoto(res, orderId, 'err=photo_save');
        }

        if (saved.previousUrl && saved.previousUrl !== stored.url) {
            removeLocalAssembled(saved.previousUrl);
        }

        if (saved.wasEmpty) {
            try {
                await orderWarehouseNotifyService.notifyCustomerAssembledPhoto(orderId);
            } catch (notifyErr) {
                console.error('notifyCustomerAssembledPhoto:', notifyErr.message);
            }
        }

        return redirectAssembledPhoto(res, orderId, 'ok=photo');
    } catch (err) {
        console.error('uploadAssembledPhoto:', err.message);
        unlinkCurrent();
        if (Number.isFinite(orderId) && orderId > 0) {
            return redirectAssembledPhoto(res, orderId, 'err=server');
        }
        return res.redirect('/warehouse/orders?err=server');
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
    warehouseStockPoll,
    uploadAssembledPhotoMiddleware,
    uploadAssembledPhoto
};
