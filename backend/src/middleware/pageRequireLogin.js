const { getPageUserId } = require('../utils/pageUser');

const pageRequireLogin = (req, res, next) => {
    if (!getPageUserId(res)) {
        const accept = String(req.headers.accept || '').toLowerCase();
        const xr = String(req.headers['x-requested-with'] || '').toLowerCase();
        if (accept.includes('application/json') || xr === 'xmlhttprequest') {
            return res.status(401).json({ ok: false, message: 'Потрібна авторизація' });
        }
        return res.redirect('/login');
    }
    return next();
};

module.exports = pageRequireLogin;