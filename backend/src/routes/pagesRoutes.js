const express = require('express');
const multer = require('multer');

const pagesController = require('../controllers/pagesController');
const pageAuthContext = require('../middleware/pageAuthContext');
const pageRequireLogin = require('../middleware/pageRequireLogin');
const pageRequireLoginOrPayToken = require('../middleware/pageRequireLoginOrPayToken');
const pageRequireAdminPage = require('../middleware/pageRequireAdminPage');
const pageRequireWarehousePage = require('../middleware/pageRequireWarehousePage');
const pageRequireCourierPage = require('../middleware/pageRequireCourierPage');
const courierController = require('../controllers/courierController');
const notificationController = require('../controllers/notificationController');
const requireAdminJson = require('../middleware/requireAdminJson');
const wishlistController = require('../controllers/wishlistController');
const orderController = require('../controllers/orderController');
const reviewController = require('../controllers/reviewController');
const productImageController = require('../controllers/productImageController');
const categoryImageController = require('../controllers/categoryImageController');
const cabinetController = require('../controllers/cabinetController');
const cartController = require('../controllers/cartController');
const constructorController = require('../controllers/constructorController');
const bouquetTemplateController = require('../controllers/bouquetTemplateController');
const paymentController = require('../controllers/paymentController');
const warehouseController = require('../controllers/warehouseController');
const supportChatController = require('../controllers/supportChatController');

const wrapProductImageUpload = (req, res, next) => {
    productImageController.uploadMiddleware(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Файл завеликий' });
            }
            const msg =
                err.message && typeof err.message === 'string'
                    ? err.message
                    : 'Не вдалося завантажити файл';
            return res.status(400).json({ message: msg });
        }
        next();
    });
};

const wrapCategoryImageUpload = (req, res, next) => {
    categoryImageController.uploadMiddleware(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Файл завеликий' });
            }
            const msg =
                err.message && typeof err.message === 'string'
                    ? err.message
                    : 'Не вдалося завантажити файл';
            return res.status(400).json({ message: msg });
        }
        next();
    });
};

const router = express.Router();
const pageNavCounts = require('../middleware/pageNavCounts');
const pageRequireConstructorEnabled = require('../middleware/pageRequireConstructorEnabled');
router.use(pageAuthContext);
router.use(pageNavCounts);

router.get('/', pagesController.home);
router.get('/api/catalog/products', pagesController.catalogProductsJson);
router.get('/api/support/config', supportChatController.getConfig);
router.get('/api/support/active', supportChatController.getActive);
router.get('/api/support/archive', supportChatController.listArchive);
router.get('/api/support/archive/:id', supportChatController.getArchiveChat);
router.get('/api/support/poll', supportChatController.pollMessages);
router.post('/api/support/start', supportChatController.startChat);
router.post('/api/support/message', supportChatController.sendMessage);
router.get('/api/support/unread-count', supportChatController.getUnreadCount);
router.post('/api/support/read', supportChatController.markRead);
router.get('/product/:id', pagesController.productPage);
router.post('/product/:id/reviews', pageRequireLogin, reviewController.createPageReview);
router.get('/login', pagesController.loginPage);
router.get('/account-blocked', pagesController.accountBlockedPage);
router.get('/register', pagesController.registerPage);
router.get('/privacy', pagesController.privacyPage);
router.get('/delivery-terms', pagesController.deliveryTermsPage);
router.get('/logout', pagesController.logout);
router.get('/cart', pagesController.cartPage);
router.get('/constructor', constructorController.constructorPage);
router.get('/api/constructor/templates', pageRequireConstructorEnabled, bouquetTemplateController.listJson);
router.get('/api/constructor/templates/:slug', pageRequireConstructorEnabled, bouquetTemplateController.getJson);
router.post('/constructor/templates/:slug/add', pageRequireConstructorEnabled, bouquetTemplateController.addTemplateToCart);
router.post('/constructor/calc', pageRequireConstructorEnabled, constructorController.calcJson);
router.post('/constructor/preview', pageRequireConstructorEnabled, constructorController.previewJson);
router.post('/constructor/preview-save', pageRequireConstructorEnabled, constructorController.savePreviewJson);
router.post('/constructor/preview-clear', constructorController.previewClearJson);
router.post('/constructor/add', pageRequireConstructorEnabled, constructorController.addToCart);
router.post('/cart/add', cartController.add);
router.post('/cart/update', cartController.update);
router.post('/cart/remove', cartController.remove);
router.post('/cart/clear', cartController.clear);
router.get('/cabinet', pageRequireLogin, pagesController.cabinetPage);
router.post('/cabinet/profile', pageRequireLogin, cabinetController.updateProfile);
router.post('/cabinet/avatar', pageRequireLogin, cabinetController.uploadAvatarMiddleware, cabinetController.updateAvatar);
router.post('/cabinet/password/simple', pageRequireLogin, cabinetController.changePasswordSimple);
router.post('/cabinet/password/request-email', pageRequireLogin, cabinetController.requestPasswordEmailCode);
router.post('/cabinet/password/confirm-email', pageRequireLogin, cabinetController.confirmPasswordByEmailCode);
router.post('/cabinet/orders/:id/archive', pageRequireLogin, cabinetController.archiveOrder);
router.post('/cabinet/orders/:id/cancel-request', pageRequireLogin, cabinetController.requestOrderCancel);
router.post('/cabinet/reviews/:id/edit-request', pageRequireLogin, cabinetController.requestReviewEdit);
router.post('/cabinet/reviews/:id/delete-request', pageRequireLogin, cabinetController.requestReviewDelete);
router.get('/checkout', pagesController.checkoutPage);
router.post('/orders', orderController.createOrder);
router.get('/order/success/:orderId', pageRequireLoginOrPayToken, pagesController.orderSuccessPage);
router.post('/order/success/:orderId/cancel-request', cabinetController.requestGuestOrderCancel);
router.post('/payment/liqpay/callback', paymentController.callback);
router.get('/payment/result/:orderId', pageRequireLoginOrPayToken, paymentController.result);
router.post('/payment/result/:orderId', pageRequireLoginOrPayToken, paymentController.result);
router.get('/payment/sync/:orderId', pageRequireLogin, paymentController.syncStatus);
router.get('/payment/:orderId', pageRequireLoginOrPayToken, paymentController.payPage);
router.get('/admin', pageRequireAdminPage, pagesController.adminDashboard);
router.get('/warehouse/orders', pageRequireWarehousePage, pagesController.warehouseOrdersPage);
router.get('/warehouse/orders/poll', pageRequireWarehousePage, pagesController.warehouseOrdersPoll);
router.get('/warehouse/orders/:id', pageRequireWarehousePage, pagesController.warehouseOrderDetailPage);
router.post('/warehouse/orders/:id/status', pageRequireWarehousePage, orderController.updateOrderStatusForWarehouse);
router.post('/warehouse/orders/:id/pickup-complete', pageRequireWarehousePage, orderController.completePickupByWarehouse);
router.get('/warehouse/stock', pageRequireWarehousePage, warehouseController.warehouseStockPage);
router.post('/warehouse/stock/adjust', pageRequireWarehousePage, warehouseController.warehouseStockAdjust);
router.get('/warehouse/stock/poll', pageRequireWarehousePage, warehouseController.warehouseStockPoll);
router.get('/courier/orders', pageRequireCourierPage, courierController.courierOrdersPage);
router.get('/courier/orders/poll', pageRequireCourierPage, courierController.courierOrdersPoll);
router.get('/courier/orders/:id', pageRequireCourierPage, courierController.courierOrderDetailPage);
router.post('/courier/orders/:id/status', pageRequireCourierPage, courierController.updateOrderStatusForCourier);
router.post('/courier/orders/:id/cod-paid', pageRequireCourierPage, courierController.confirmCodPayment);
router.post('/courier/orders/:id/close', pageRequireCourierPage, courierController.closeOrder);
router.get('/courier/shift', pageRequireCourierPage, courierController.courierShiftPage);
router.post('/courier/shift', pageRequireCourierPage, courierController.toggleShift);
router.get('/api/notifications', pageRequireLogin, notificationController.list);
router.get('/api/notifications/unread-count', pageRequireLogin, notificationController.unreadCount);
router.post('/api/notifications/:id/read', pageRequireLogin, notificationController.markRead);
router.post('/api/notifications/read-all', pageRequireLogin, notificationController.markAllRead);
router.get('/wishlist', wishlistController.wishlistPage);
router.get('/api/wishlist/ids', wishlistController.listProductIdsJson);
router.post('/wishlist/add', wishlistController.addProduct);
router.post('/wishlist/remove', wishlistController.removeProduct);
router.post('/wishlist/delete', wishlistController.removeProduct);
router.post(
    '/products/upload-image',
    requireAdminJson,
    wrapProductImageUpload,
    productImageController.uploadProductImage
);
router.post(
    '/categories/upload-image',
    requireAdminJson,
    wrapCategoryImageUpload,
    categoryImageController.uploadCategoryImage
);
module.exports = router;

