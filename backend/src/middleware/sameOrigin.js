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

const headerValue = (req, name) => {
    if (req && typeof req.get === 'function') {
        return String(req.get(name) || '');
    }
    if (req && req.headers && req.headers[name]) {
        return String(req.headers[name]);
    }
    return '';
};

const originMatchesHost = (req) => {
    const host = headerValue(req, 'host');
    const origin = headerValue(req, 'origin');
    if (!host || !origin) {
        return false;
    }
    return hostFromUrl(origin) === host;
};

const sameOrigin = (req, res, next) => {
    const method = String(req.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return next();
    }

    const url = String(req.originalUrl || '');
    if (url.indexOf('/payment/liqpay/callback') !== -1) {
        return next();
    }

    const host = headerValue(req, 'host');
    const origin = headerValue(req, 'origin');
    const referer = headerValue(req, 'referer');

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

sameOrigin.originMatchesHost = originMatchesHost;

module.exports = sameOrigin;

