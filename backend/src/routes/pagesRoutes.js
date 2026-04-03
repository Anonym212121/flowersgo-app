const express = require('express');

const pagesController = require('../controllers/pagesController');
const pageAuthContext = require('../middleware/pageAuthContext');
const pageRequireLogin = require('../middleware/pageRequireLogin');
const wishlistController = require('../controllers/wishlistController');

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
module.exports = router;

