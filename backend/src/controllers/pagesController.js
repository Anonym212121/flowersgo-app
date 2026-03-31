const home = (req, res) => {
    return res.status(200).render('home', {
        title: 'Квіткова доставка',
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null
    });
};

const loginPage = (req, res) => {
    return res.status(200).render('login', {
        title: 'Вхід',
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null
    });
};

const registerPage = (req, res) => {
    return res.status(200).render('register', {
        title: 'Реєстрація',
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null
    });
};

module.exports = {
    home,
    loginPage,
    registerPage
};

