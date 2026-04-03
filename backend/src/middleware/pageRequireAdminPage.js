const pageRequireAdminPage = (req, res, next) => {
    const user = res.locals.currentUser;

    if (!user) {
        return res.redirect('/login');
    }

    if (user.role_name !== 'admin') {
        return res.redirect('/');
    }

    return next();
};

module.exports = pageRequireAdminPage;
