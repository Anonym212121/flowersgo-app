const jwt = require('jsonwebtoken');

const parseCookies = (cookieHeader) => {
    const result = {};

    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return result;
    }

    const parts = cookieHeader.split(';');
    for (const item of parts) {
        const trimmed = item.trim();
        if (!trimmed) {
            continue;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();

        if (key) {
            result[key] = decodeURIComponent(value);
        }
    }

    return result;
};

const pageAuthContext = (req, res, next) => {
    res.locals.headerType = 'guest';
    res.locals.currentUser = null;

    try {
        const cookies = parseCookies(req.headers.cookie);
        const token = cookies.token;

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        res.locals.currentUser = {
            user_id: decoded.user_id,
            role_id: decoded.role_id,
            role_name: decoded.role_name
        };

        if (decoded.role_name === 'admin') {
            res.locals.headerType = 'admin';
        } else if (decoded.role_name === 'warehouse_worker') {
            res.locals.headerType = 'warehouse_worker';
        } else {
            res.locals.headerType = 'user';
        }

        return next();
    } catch (err) {
        return next();
    }
};

module.exports = pageAuthContext;

