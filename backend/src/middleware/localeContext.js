const i18n = require('../utils/i18n');
const fxService = require('../services/fxService');

const parseCookies = (cookieHeader) => {
    const result = {};
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return result;
    }
    const parts = cookieHeader.split(';');
    let i = 0;
    while (i < parts.length) {
        const trimmed = parts[i].trim();
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            let value = trimmed.slice(idx + 1).trim();
            try {
                value = decodeURIComponent(value);
            } catch (err) {
            }
            if (key) {
                result[key] = value;
            }
        }
        i += 1;
    }
    return result;
};

const readLang = (req) => {
    const q = req.query && typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : '';
    if (q === 'en' || q === 'uk') {
        return q;
    }
    const cookies = parseCookies(req.headers.cookie);
    const fromCookie = cookies.site_lang ? String(cookies.site_lang).trim().toLowerCase() : '';
    if (fromCookie === 'en' || fromCookie === 'uk') {
        return fromCookie;
    }
    return 'uk';
};

const localeContext = async (req, res, next) => {
    try {
        await i18n.initI18n();
    } catch (err) {
        return next(err);
    }

    const lang = readLang(req);
    let usdRate = 41.5;
    try {
        usdRate = await fxService.getUsdUahRate();
    } catch (err) {
        usdRate = 41.5;
    }

    res.locals.lang = lang;
    res.locals.usdRate = usdRate;
    res.locals.t = (key, vars) => i18n.t(lang, key, vars);
    res.locals.locName = (item) => i18n.locName(lang, item);
    res.locals.locText = (uk, en) => i18n.locText(lang, uk, en);
    res.locals.formatMoney = (uah) => i18n.formatMoney(lang, uah, usdRate);
    res.locals.translateUnit = (unit) => i18n.translateUnit(unit, lang);
    res.locals.localeDict = i18n.clientDict(lang);
    next();
};

module.exports = localeContext;
