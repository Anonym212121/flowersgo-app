const jwt = require('jsonwebtoken');

const UserModel = require('../models/User');



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
            try {
                result[key] = decodeURIComponent(value);
            } catch {
                result[key] = value;
            }
        }

    }



    return result;

};



const pageAuthContext = async (req, res, next) => {

    res.locals.headerType = 'guest';

    res.locals.currentUser = null;

    res.locals.navPath = typeof req.path === 'string' ? req.path : '/';



    try {

        const cookies = parseCookies(req.headers.cookie);

        const token = cookies.token;



        if (!token) {

            return next();

        }



        const decoded = jwt.verify(token, process.env.JWT_SECRET);



        const rawId = decoded.user_id != null ? decoded.user_id : decoded.id;

        const userId = Number(rawId);

        if (!Number.isFinite(userId) || userId <= 0) {

            return next();

        }



        const user = await UserModel.findAuthById(userId);

        if (!user || Number(user.is_blocked) === 1) {

            return next();

        }



        const roleName = user.role_name || '';

        res.locals.currentUser = {

            user_id: Number(user.id),

            role_id: user.role_id,

            role_name: roleName

        };



        if (roleName === 'admin') {

            res.locals.headerType = 'admin';

        } else if (roleName === 'warehouse_worker') {

            res.locals.headerType = 'warehouse_worker';

        } else if (roleName === 'courier') {

            res.locals.headerType = 'courier';

        } else {

            res.locals.headerType = 'user';

        }



        return next();

    } catch (err) {

        return next();

    }

};



module.exports = pageAuthContext;


