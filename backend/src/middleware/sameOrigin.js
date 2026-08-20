const hostFromUrl = (value) => {
    if (!value || typeof value !== 'string') {
        return '';
    }
    try {
        return new URL(value).hostname.toLowerCase();
    } catch {
        return '';
    }
};

const normalizeHost = (raw) => {
    let text = String(raw || '').trim().toLowerCase();
    if (!text || text === 'null') {
        return '';
    }
    text = text.replace(/^["']+|["']+$/g, '');

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
        if (colon !== -1 && /^\d+$/.test(text.slice(colon + 1))) {
            text = text.slice(0, colon);
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
    if (req && req.headers) {
        const direct = req.headers[name];
        if (direct) {
            return String(direct);
        }
    }
    return '';
};

const forwardedHost = (req) => {
    const raw = headerValue(req, 'forwarded');
    if (!raw) {
        return '';
    }
    const match = raw.match(/host=\"?([^;,\"]+)/i);
    if (!match) {
        return '';
    }
    return match[1];
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
    add(forwardedHost(req));
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

const isBrowserSameSite = (req) => {
    const site = headerValue(req, 'sec-fetch-site').toLowerCase();
    return site === 'same-origin' || site === 'same-site';
};

const originMatchesHost = (req) => {
    if (isBrowserSameSite(req)) {
        return true;
    }
    const origin = headerValue(req, 'origin');
    if (!origin || origin === 'null') {
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
    if (String(req.path || '') === '/logout') {
        return next();
    }

    if (isBrowserSameSite(req)) {
        return next();
    }

    const origin = headerValue(req, 'origin');
    const referer = headerValue(req, 'referer');
    const originOk = origin && origin !== 'null' && hostIsAllowed(req, origin);
    const refererOk = (!origin || origin === 'null') && referer && hostIsAllowed(req, referer);

    if (originOk || refererOk) {
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
