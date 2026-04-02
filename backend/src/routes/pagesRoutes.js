const express = require('express');

const pagesController = require('../controllers/pagesController');
const pageAuthContext = require('../middleware/pageAuthContext');
const pageRequireLogin = require('../middleware/pageRequireLogin');

const router = express.Router();
router.use(pageAuthContext);

router.get('/', pagesController.home);
router.get('/login', pagesController.loginPage);
router.get('/register', pagesController.registerPage);
router.get('/logout', pagesController.logout);
router.get('/cabinet', pageRequireLogin, pagesController.cabinetPage);
module.exports = router;

