const express = require('express');
const multer = require('multer');

const pagesController = require('../controllers/pagesController');
const pageAuthContext = require('../middleware/pageAuthContext');
const pageRequireLogin = require('../middleware/pageRequireLogin');
const pageRequireAdminPage = require('../middleware/pageRequireAdminPage');
const pageRequireWarehousePage = require('../middleware/pageRequireWarehousePage');
const requireAdminJson = require('../middleware/requireAdminJson');
const wishlistController = require('../controllers/wishlistController');
const orderController = require('../controllers/orderController');
const reviewController = require('../controllers/reviewController');
const productImageController = require('../controllers/productImageController');

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

const router = express.Router();
router.use(pageAuthContext);

router.get('/', pagesController.home);
router.get('/api/catalog/products', pagesController.catalogProductsJson);
router.get('/product/:id', pagesController.productPage);
router.post('/product/:id/reviews', pageRequireLogin, reviewController.createPageReview);
router.get('/login', pagesController.loginPage);
router.get('/register', pagesController.registerPage);
router.get('/logout', pagesController.logout);
router.get('/cabinet', pageRequireLogin, pagesController.cabinetPage);
router.get('/checkout', pageRequireLogin, pagesController.checkoutPage);
router.post('/orders', pageRequireLogin, orderController.createOrder);
router.get('/admin', pageRequireAdminPage, pagesController.adminDashboard);
router.get('/warehouse/orders', pageRequireWarehousePage, pagesController.warehouseOrdersPage);
router.get('/wishlist', wishlistController.wishlistPage);
router.post('/wishlist/add', wishlistController.addProduct);
router.post('/wishlist/remove', wishlistController.removeProduct);
router.post('/wishlist/delete', wishlistController.removeProduct);
router.post(
    '/products/upload-image',
    requireAdminJson,
    wrapProductImageUpload,
    productImageController.uploadProductImage
);
module.exports = router;

