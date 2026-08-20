const buckets = new Map();

const getClientIp = (req) => {
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
    return String(ip || 'unknown');
};

const cleanup = (now) => {
    if (buckets.size < 500) {
        return;
    }
    for (const [key, item] of buckets) {
        if (item.resetAt <= now) {
            buckets.delete(key);
        }
    }
};

const createRateLimit = ({ windowMs, max, message, skip, scope }) => {
    const waitMs = Number(windowMs) > 0 ? Number(windowMs) : 60000;
    const limit = Number(max) > 0 ? Number(max) : 60;
    const text = message || 'Забагато запитів. Спробуйте трохи пізніше.';
    const bucketScope = typeof scope === 'string' && scope.trim() ? scope.trim() : '';

    return (req, res, next) => {
        if (process.env.NODE_ENV === 'test') {
            return next();
        }
        if (typeof skip === 'function' && skip(req)) {
            return next();
        }

        const now = Date.now();
        cleanup(now);

        const key = bucketScope
            ? getClientIp(req) + '|' + bucketScope
            : getClientIp(req) + '|' + String(req.method) + '|' + String(req.baseUrl || '') + String(req.path || '');
        let item = buckets.get(key);
        if (!item || item.resetAt <= now) {
            item = { count: 0, resetAt: now + waitMs };
            buckets.set(key, item);
        }

        item.count += 1;
        if (item.count <= limit) {
            return next();
        }

        const retrySec = Math.max(1, Math.ceil((item.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retrySec));

        const accept = String(req.headers.accept || '');
        const wantsJson =
            (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
            accept.indexOf('application/json') !== -1;

        if (wantsJson) {
            return res.status(429).json({ ok: false, message: text });
        }
        return res.status(429).send(text);
    };
};

module.exports = createRateLimit;
