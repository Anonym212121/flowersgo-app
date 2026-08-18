const path = require('path');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const catalogEn = require('../i18n/catalogEn');

let initPromise = null;

const initI18n = () => {
    if (initPromise) {
        return initPromise;
    }
    initPromise = i18next.use(Backend).init({
        lng: 'uk',
        fallbackLng: 'uk',
        supportedLngs: ['uk', 'en'],
        preload: ['uk', 'en'],
        ns: ['translation'],
        defaultNS: 'translation',
        interpolation: {
            escapeValue: false
        },
        backend: {
            loadPath: path.join(__dirname, '../../locales/{{lng}}.json')
        }
    });
    return initPromise;
};

const t = (lang, key, vars) => {
    const code = lang === 'en' ? 'en' : 'uk';
    const opts = { lng: code };
    if (vars && typeof vars === 'object') {
        const names = Object.keys(vars);
        let i = 0;
        while (i < names.length) {
            opts[names[i]] = vars[names[i]];
            i += 1;
        }
    }
    return i18next.t(key, opts);
};

const locName = (lang, item) => {
    if (!item) {
        return '';
    }
    if (typeof item === 'string') {
        if (lang === 'en') {
            return catalogEn.translateName(item);
        }
        return item;
    }
    const uk = String(item.name || '').trim();
    const en = item.name_en ? String(item.name_en).trim() : '';
    if (lang === 'en') {
        if (en) {
            return en;
        }
        return catalogEn.translateName(uk);
    }
    return uk;
};

const locText = (lang, uk, en) => {
    if (lang === 'en' && en) {
        return String(en);
    }
    return String(uk || '');
};

const formatMoney = (lang, uah, usdRate) => {
    const n = Number(uah);
    const amount = Number.isFinite(n) ? n : 0;
    if (lang === 'en') {
        let rate = Number(usdRate);
        if (!Number.isFinite(rate) || rate <= 0) {
            rate = 41.5;
        }
        return '$' + (amount / rate).toFixed(2);
    }
    return amount.toLocaleString('uk-UA') + ' грн';
};

const flattenDict = (obj, prefix) => {
    const out = {};
    if (!obj || typeof obj !== 'object') {
        return out;
    }
    const keys = Object.keys(obj);
    let i = 0;
    while (i < keys.length) {
        const key = keys[i];
        const val = obj[key];
        const nextKey = prefix ? prefix + '.' + key : key;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            const nested = flattenDict(val, nextKey);
            const nestedKeys = Object.keys(nested);
            let j = 0;
            while (j < nestedKeys.length) {
                out[nestedKeys[j]] = nested[nestedKeys[j]];
                j += 1;
            }
        } else {
            out[nextKey] = val;
        }
        i += 1;
    }
    return out;
};

const clientDict = (lang) => {
    const code = lang === 'en' ? 'en' : 'uk';
    const bundle = i18next.getResourceBundle(code, 'translation') || {};
    return flattenDict(bundle, '');
};

const localizeProductRow = (lang, product) => {
    if (!product) {
        return product;
    }
    const row = Object.assign({}, product);
    row.name = locName(lang, product);
    row.unit_type = catalogEn.translateUnit(product.unit_type, lang);
    if (product.category_name) {
        row.category_name = locName(lang, product.category_name);
    }
    return row;
};

const localizeProductList = (lang, list) => {
    if (!Array.isArray(list)) {
        return [];
    }
    const out = [];
    let i = 0;
    while (i < list.length) {
        out.push(localizeProductRow(lang, list[i]));
        i += 1;
    }
    return out;
};

const localizeHomeSections = (lang, sections) => {
    if (!Array.isArray(sections)) {
        return [];
    }
    const out = [];
    let i = 0;
    while (i < sections.length) {
        const section = sections[i];
        let title = section.title;
        if (section.key === 'discount') {
            title = t(lang, 'catalog.discount');
        } else if (section.key === 'bouquets') {
            title = t(lang, 'catalog.bouquets');
        } else {
            title = locName(lang, section.title);
        }
        out.push(Object.assign({}, section, {
            title,
            products: localizeProductList(lang, section.products)
        }));
        i += 1;
    }
    return out;
};

const localizeCatalogPayload = (lang, data) => {
    const payload = data && typeof data === 'object' ? data : {};
    return {
        products: localizeProductList(lang, payload.products),
        hitProducts: localizeProductList(lang, payload.hitProducts),
        homeSections: localizeHomeSections(lang, payload.homeSections)
    };
};

module.exports = {
    initI18n,
    t,
    locName,
    locText,
    formatMoney,
    clientDict,
    localizeCatalogPayload,
    translateUnit: catalogEn.translateUnit
};
