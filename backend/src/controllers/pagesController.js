const UserModel = require('../models/User');

const renderLayout = (res, title, bodyPartial, extraLocals = {}) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null,
        ...extraLocals
    });
};

const home = (req, res) => {
    return renderLayout(res, 'Доставка квітів', 'pages/home');
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

        return renderLayout(res, 'Мій кабінет', 'pages/cabinet', { profile });
    } catch (err) {
        return res.status(500).send('помилка');
    }
};
module.exports = {
    home,
    loginPage,
    registerPage,
    logout,
    cabinetPage,
};
