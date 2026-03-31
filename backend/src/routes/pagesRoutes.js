const express = require('express');

const pagesController = require('../controllers/pagesController');
const pageAuthContext = require('../middleware/pageAuthContext');

const router = express.Router();

router.use(pageAuthContext);

router.get('/', pagesController.home);
router.get('/login', pagesController.loginPage);
router.get('/register', pagesController.registerPage);

module.exports = router;

