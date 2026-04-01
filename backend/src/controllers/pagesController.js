const renderLayout = (res, title, bodyPartial) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null
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

module.exports = {
    home,
    loginPage,
    registerPage,
    logout
};
