const requireAdminJson = (req, res, next) => {
    const user = res.locals.currentUser;

    if (!user) {
        return res.status(401).json({ message: 'Потрібно увійти в систему' });
    }

    if (user.role_name !== 'admin') {
        return res.status(403).json({ message: 'Доступ лише для адміністратора' });
    }

    return next();
};

module.exports = requireAdminJson;
