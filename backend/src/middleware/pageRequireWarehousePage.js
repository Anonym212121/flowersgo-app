const pageRequireWarehousePage = (req, res, next) => {
    const user = res.locals.currentUser;
    if (!user) {
        return res.redirect('/login');
    }
    if (user.role_name !== 'warehouse_worker') {
        return res.redirect('/');
    }
    return next();
};

module.exports = pageRequireWarehousePage;
