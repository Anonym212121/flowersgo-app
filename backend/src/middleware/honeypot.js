const isHoneypotFilled = (req) => {
    const body = req.body || {};
    const fields = ['website', 'company_url', 'fax'];
    for (let i = 0; i < fields.length; i++) {
        const raw = body[fields[i]];
        if (typeof raw === 'string' && raw.trim() !== '') {
            return true;
        }
    }
    return false;
};

const honeypot = (req, res, next) => {
    if (!isHoneypotFilled(req)) {
        return next();
    }

    const accept = String(req.headers.accept || '');
    const wantsJson =
        (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
        accept.indexOf('application/json') !== -1;

    if (wantsJson) {
        return res.status(400).json({ ok: false, message: 'Запит відхилено' });
    }
    return res.status(400).send('Запит відхилено');
};

module.exports = honeypot;
module.exports.isHoneypotFilled = isHoneypotFilled;
