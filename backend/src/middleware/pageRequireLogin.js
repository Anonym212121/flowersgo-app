const pageRequireLogin = (req, res, next) => {
    if (!res.locals.currentUser) {
        return res.redirect('/login');
    }
return next();
};

module.exports = pageRequireLogin;