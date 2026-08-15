const hostFromUrl = (value) => {
    if (!value || typeof value !== 'string') {
        return '';
    }
    try {
        const url = new URL(value);
        return url.host;
    } catch {
        return '';
    }
};

const sameOrigin = (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
        return next();
    }

    const method = String(req.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return next();
    }

    const url = String(req.originalUrl || '');
    if (url.indexOf('/payment/liqpay/callback') !== -1) {
        return next();
    }

    const host = String(req.get('host') || '');
    const origin = String(req.get('origin') || '');
    const referer = String(req.get('referer') || '');

    if (origin && hostFromUrl(origin) === host) {
        return next();
    }
    if (!origin && referer && hostFromUrl(referer) === host) {
        return next();
    }

    const accept = String(req.headers.accept || '');
    const wantsJson =
        (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
        accept.indexOf('application/json') !== -1;

    if (wantsJson) {
        return res.status(403).json({ ok: false, message: 'Запит відхилено' });
    }
    return res.status(403).send('Запит відхилено');
};

module.exports = sameOrigin;
