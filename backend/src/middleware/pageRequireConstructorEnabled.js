const constructorConfig = require('../config/constructor');

const pageRequireConstructorEnabled = (req, res, next) => {
    if (constructorConfig.isEnabled()) {
        return next();
    }

    const accept = String(req.headers.accept || '');
    if (accept.includes('application/json') || String(req.path || '').startsWith('/api/')) {
        return res.status(403).json({ ok: false, message: 'Конструктор тимчасово недоступний' });
    }

    return res.redirect('/');
};

module.exports = pageRequireConstructorEnabled;
