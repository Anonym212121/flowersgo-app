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

const normalizeHost = (raw) => {
    let text = String(raw || '').trim().toLowerCase();
    if (!text) {
        return '';
    }

    if (text.indexOf(',') !== -1) {
        text = text.split(',')[0].trim();
    }

    if (text.indexOf('://') !== -1) {
        text = hostFromUrl(text);
    }

    if (!text) {
        return '';
    }

    if (text.charAt(0) === '[') {
        const end = text.indexOf(']');
        if (end !== -1) {
            text = text.slice(0, end + 1);
        }
    } else {
        const colon = text.lastIndexOf(':');
        if (colon !== -1) {
            const port = text.slice(colon + 1);
            if (port === '80' || port === '443') {
                text = text.slice(0, colon);
            }
        }
    }

    if (text.indexOf('www.') === 0) {
        text = text.slice(4);
    }

    return text;
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

const allowedHosts = (req) => {
    const list = [];
    const add = (value) => {
        const host = normalizeHost(value);
        if (host && list.indexOf(host) === -1) {
            list.push(host);
        }
    };

    add(headerValue(req, 'host'));
    add(headerValue(req, 'x-forwarded-host'));
    if (req && typeof req.hostname === 'string') {
        add(req.hostname);
    }
    add(process.env.APP_BASE_URL);

    return list;
};

const hostIsAllowed = (req, originOrUrl) => {
    const originHost = normalizeHost(originOrUrl);
    if (!originHost) {
        return false;
    }
    const allowed = allowedHosts(req);
    for (let i = 0; i < allowed.length; i++) {
        if (allowed[i] === originHost) {
            return true;
        }
    }
    return false;
};

const originMatchesHost = (req) => {
    const origin = headerValue(req, 'origin');
    if (!origin) {
        return false;
    }
    return hostIsAllowed(req, origin);
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

    const origin = headerValue(req, 'origin');
    const referer = headerValue(req, 'referer');

    if (origin && hostIsAllowed(req, origin)) {
        return next();
    }
    if (!origin && referer && hostIsAllowed(req, referer)) {
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
