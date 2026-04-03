const express = require('express');
const multer = require('multer');

const pagesController = require('../controllers/pagesController');
const pageAuthContext = require('../middleware/pageAuthContext');
const pageRequireLogin = require('../middleware/pageRequireLogin');
const wishlistController = require('../controllers/wishlistController');
const productImageController = require('../controllers/productImageController');

const wrapProductImageUpload = (req, res, next) => {
    productImageController.uploadMiddleware(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Файл завеликий (максимум 5 МБ)' });
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
router.get('/login', pagesController.loginPage);
router.get('/register', pagesController.registerPage);
router.get('/logout', pagesController.logout);
router.get('/cabinet', pageRequireLogin, pagesController.cabinetPage);
router.get('/wishlist', wishlistController.wishlistPage);
router.post('/wishlist/add', wishlistController.addProduct);
router.post('/wishlist/remove', wishlistController.removeProduct);
router.post('/wishlist/delete', wishlistController.removeProduct);
router.post(
    '/products/upload-image',
    wrapProductImageUpload,
    productImageController.uploadProductImage
);
module.exports = router;

