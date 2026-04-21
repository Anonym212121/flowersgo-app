const UserModel = require('../models/User'); 
const CategoryModel = require('../models/Category');
const ProductModel = require('../models/Product');
const ReviewModel = require('../models/Review');
const OrderModel = require('../models/Order');
const renderLayout = (res, title, bodyPartial, extraLocals = {}) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null,
        ...extraLocals
    });
};

const home = async (req, res) => {
    try {
        const selectedCategoryId = req.query.category_id ? Number(req.query.category_id) : null;

        let searchQuery = '';
        const rawQ = req.query.q;
        if (rawQ !== undefined && rawQ !== null && rawQ !== '') {
            if (Array.isArray(rawQ)) {
                searchQuery = String(rawQ[0] ?? '').trim();
            } else {
                searchQuery = String(rawQ).trim();
            }
        }

        const categories = await CategoryModel.allCategories();

        const products = await ProductModel.allProducts(selectedCategoryId, searchQuery);
        return renderLayout(res, 'Каталог товарів', 'pages/home', {
            categories,
            products,
            selectedCategoryId,
            searchQuery
        });
    }  catch (err) {
        return res.status(500).send('помилка');
    }
};

const loginPage = (req, res) => {
    return renderLayout(res, 'Вхід', 'pages/login');
};

const registerPage = (req, res) => {
    return renderLayout(res, 'Реєстрація', 'pages/register');
};

const logout = (req, res) => {
    res.clearCookie('token');
    return res.redirect('/');
};



const cabinetPage = async (req, res) => {
    try {
        const current = res.locals.currentUser;
        const profile = await UserModel.getUserid(current.user_id);

        if (!profile) {
            return res.redirect('/login');
        }

        const orders = await OrderModel.listByUserId(current.user_id);

        return renderLayout(res, 'Мій кабінет', 'pages/cabinet', { profile, orders });
    } catch (err) {
        return res.status(500).send('помилка');
    }
};

const checkoutPage = (req, res) => {
    return renderLayout(res, 'Оформлення замовлення', 'pages/checkout', {});
};

const productPage = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(404).send('Товар не знайдено');
        }

        const product = await ProductModel.findById(id);
        if (!product || Number(product.is_active) === 0) {
            return res.status(404).send('Товар не знайдено');
        }

        const reviews = await ReviewModel.listVisibleByProductId(id);

        return renderLayout(res, product.name, 'pages/product', { product, reviews });
    } catch (err) {
        return res.status(500).send('помилка');
    }
};

const adminDashboard = (req, res) => {
    return renderLayout(res, 'Адмін-панель', 'pages/admin/dashboard');
};
const adminProductsList = async (req, res) => {
    try {
        const products = await ProductModel.allForAdmin();
        return renderLayout(res, 'Товари', 'pages/admin/products-list', {
            products
        });
    } catch (err) {
        console.error('adminProductsList:', err.message);
        return res.status(500).send('помилка');
    }
};

const catalogProductsJson = async (req, res) => {
    try {
        const rawCat = req.query.category_id;
        let selectedCategoryId = null;
        if (rawCat !== undefined && rawCat !== null && rawCat !== '') {
            const n = Number(rawCat);
            if (Number.isFinite(n) && n > 0) {
                selectedCategoryId = n;
            }
        }

        let searchQuery = '';
        const rawQ = req.query.q;
        if (rawQ !== undefined && rawQ !== null && rawQ !== '') {
            if (Array.isArray(rawQ)) {
                searchQuery = String(rawQ[0] ?? '').trim();
            } else {
                searchQuery = String(rawQ).trim();
            }
        }

        const products = await ProductModel.allProducts(selectedCategoryId, searchQuery);
        return res.json({ products });
    } catch (err) {
        return res.status(500).json({ message: 'Не вдалося завантажити товари' });
    }
};

module.exports = {
    home,
    catalogProductsJson,
    productPage,
    loginPage,
    registerPage,
    logout,
    cabinetPage,
    checkoutPage,
    adminDashboard,
    adminProductsList
};
