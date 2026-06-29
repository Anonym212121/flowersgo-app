const ProductModel = require('../models/Product');

const constructorConfig = require('../config/constructor');
const orderStockService = require('./orderStockService');
const { mergeCartItems } = require('../utils/cartItemMerge');



const CONSTRUCTOR_NOTE_COOKIE = 'constructor_bouquet_note';

const NOTE_PREFIX = 'Свій букет (конструктор):';



const parseItemsFromBody = (body) => {

    const list = [];

    if (!body || typeof body !== 'object') {

        return list;

    }



    if (typeof body.items === 'string' && body.items.trim()) {

        try {

            const parsed = JSON.parse(body.items);

            if (Array.isArray(parsed)) {

                for (let i = 0; i < parsed.length; i += 1) {

                    if (list.length >= 50) {

                        break;

                    }

                    const row = parsed[i];

                    const colorRaw = row.color_variant_id;

                    let color_variant_id = null;

                    if (colorRaw !== undefined && colorRaw !== null && colorRaw !== '') {

                        const vid = Number(colorRaw);

                        if (Number.isFinite(vid) && vid > 0) {

                            color_variant_id = vid;

                        }

                    }

                    list.push({

                        product_id: Number(row.product_id),

                        color_variant_id: color_variant_id,

                        quantity: Number(row.quantity)

                    });

                }

                return list;

            }

        } catch (err) {

            return list;

        }

    }



    const keys = Object.keys(body);

    for (let i = 0; i < keys.length; i += 1) {

        const key = keys[i];

        if (!key.startsWith('qty_')) {

            continue;

        }

        const product_id = Number(key.slice(4));

        const quantity = Number(body[key]);

        list.push({ product_id, color_variant_id: null, quantity });

    }



    return list;

};

const mergeRawItems = (rawItems) => {
    return mergeCartItems(rawItems);
};



const getSettings = () => constructorConfig.getSettings();



const lineLabel = (line) => {

    const base = line.category_name || line.name || 'Квітка';

    if (line.flower_color) {

        return base + ' (' + line.flower_color + ')';

    }

    return base;

};



const buildVariantList = (stem) => {

    const variants = Array.isArray(stem.variants) ? stem.variants : [];

    if (variants.length > 0) {

        return variants.map((variant) => ({

            id: Number(variant.id),

            product_id: Number(stem.id),

            flower_color: variant.flower_color || '',

            color_hex: variant.color_hex || '',

            sale_price: Number(stem.sale_price || 0),

            stock_quantity: Number(variant.stock_quantity || 0),

            image_url: variant.image_url || stem.image_url || ''

        }));

    }

    const stock = Number(stem.stock_quantity || 0);
    if (stock <= 0) {
        return [];
    }

    return [
        {
            id: null,
            product_id: Number(stem.id),
            flower_color: '',
            color_hex: '#94a3b8',
            sale_price: Number(stem.sale_price || 0),
            stock_quantity: stock,
            image_url: stem.image_url || ''
        }
    ];
};



const groupPartsForPage = (stems) => {

    const list = Array.isArray(stems) ? stems : [];

    const groups = [];



    for (let i = 0; i < list.length; i += 1) {

        const stem = list[i];

        const variants = buildVariantList(stem);

        if (variants.length === 0) {

            continue;

        }



        let hasStock = false;

        for (let j = 0; j < variants.length; j += 1) {

            if (variants[j].stock_quantity > 0) {

                hasStock = true;

                break;

            }

        }

        if (!hasStock) {

            continue;

        }



        variants.sort((a, b) => {

            if (a.stock_quantity > 0 && b.stock_quantity <= 0) {

                return -1;

            }

            if (b.stock_quantity > 0 && a.stock_quantity <= 0) {

                return 1;

            }

            return String(a.flower_color || '').localeCompare(String(b.flower_color || ''), 'uk');

        });



        let activeVariant = null;

        for (let j = 0; j < variants.length; j += 1) {

            if (variants[j].stock_quantity > 0) {

                activeVariant = variants[j];

                break;

            }

        }

        if (!activeVariant) {

            activeVariant = variants[0];

        }



        groups.push({

            product_id: Number(stem.id),

            title: stem.category_name || stem.name,

            variants: variants,

            activeVariant: activeVariant

        });

    }



    return groups;

};



const listPackagingOptions = async () => {

    const rows = await ProductModel.listConstructorPackaging();

    const options = [];

    for (let i = 0; i < rows.length; i += 1) {

        const row = rows[i];

        options.push({

            id: Number(row.id),

            label: row.name,

            price: Number(row.sale_price || 0)

        });

    }

    return options;

};



const resolvePackaging = async (packagingProductId) => {

    const rows = await ProductModel.listConstructorPackaging();

    if (rows.length === 0) {

        return {

            ok: true,

            packaging: { id: null, label: '', price: 0 },

            packagingProduct: null

        };

    }



    let targetId = Number(packagingProductId);

    if (!Number.isFinite(targetId) || targetId <= 0) {

        targetId = Number(rows[0].id);

    }



    let product = null;

    for (let i = 0; i < rows.length; i += 1) {

        if (Number(rows[i].id) === targetId) {

            product = rows[i];

            break;

        }

    }

    if (!product) {

        product = rows[0];

    }



    const price = Number(product.sale_price || 0);

    const stock = Number(product.stock_quantity || 0);

    if (price > 0) {
        const pending = await orderStockService.getPendingQtyForProduct(Number(product.id), null);
        const available = stock - pending;
        if (available <= 0) {
            return { ok: false, message: 'Обрана упаковка зараз недоступна' };
        }
    }



    return {

        ok: true,

        packaging: {

            id: Number(product.id),

            label: product.name,

            price: price

        },

        packagingProduct: price > 0 ? product : null

    };

};



const buildBouquetNote = (summary, packagingLabel) => {

    let text = NOTE_PREFIX + ' ' + summary;

    if (packagingLabel) {

        text += '. Упаковка: ' + packagingLabel;

    }

    return text;

};



const buildLookupMaps = (stems) => {

    const stemById = {};

    const variantById = {};



    for (let i = 0; i < stems.length; i += 1) {

        const stem = stems[i];

        stemById[Number(stem.id)] = stem;



        const variants = Array.isArray(stem.variants) ? stem.variants : [];

        for (let j = 0; j < variants.length; j += 1) {

            variantById[Number(variants[j].id)] = {

                variant: variants[j],

                stem: stem

            };

        }

    }



    return { stemById, variantById };

};



const calcBouquet = async (rawItems, packagingProductId) => {

    const settings = getSettings();
    const minStems = settings.min_stems;



    const stems = await ProductModel.listConstructorStemsWithVariants();

    const { stemById, variantById } = buildLookupMaps(stems);



    const items = mergeRawItems(rawItems);

    const lines = [];

    let stemTotal = 0;

    let flowersSum = 0;



    for (let i = 0; i < items.length; i += 1) {

        const product_id = Number(items[i].product_id);

        const color_variant_id =

            items[i].color_variant_id != null && items[i].color_variant_id !== ''

                ? Number(items[i].color_variant_id)

                : null;

        const quantity = Math.floor(Number(items[i].quantity));

        if (!Number.isFinite(product_id) || product_id <= 0 || !Number.isFinite(quantity) || quantity <= 0) {

            continue;

        }



        const stem = stemById[product_id];

        if (!stem) {

            return { ok: false, message: 'Обрано квітку, якої немає в конструкторі' };

        }

        const stemVariants = Array.isArray(stem.variants) ? stem.variants : [];

        if (stemVariants.length > 0 && !color_variant_id) {

            return {

                ok: false,

                message: 'Обери колір для «' + (stem.category_name || stem.name) + '»'

            };

        }



        let stock = 0;

        let flower_color = '';

        if (color_variant_id) {

            const hit = variantById[color_variant_id];

            if (!hit || Number(hit.stem.id) !== product_id) {

                return { ok: false, message: 'Обрано некоректний колір квітки' };

            }

            stock = Number(hit.variant.stock_quantity || 0);

            flower_color = hit.variant.flower_color || '';

        } else {

            stock = Number(stem.stock_quantity || 0);

        }

        let available = stock;
        if (color_variant_id) {
            const pending = await orderStockService.getPendingQtyForVariant(color_variant_id, null);
            available = stock - pending;
        } else {
            const pending = await orderStockService.getPendingQtyForProduct(product_id, null);
            available = stock - pending;
        }

        if (available < 0) {
            available = 0;
        }

        if (quantity > available) {

            const colorHint = flower_color ? ' (' + flower_color + ')' : '';

            return {

                ok: false,

                message:

                    'Недостатньо «' +

                    (stem.category_name || stem.name) +

                    colorHint +

                    '» на складі (є ' +

                    available +

                    ' шт)'

            };

        }



        const unit_price = Number(stem.sale_price || 0);

        const line_total = unit_price * quantity;

        stemTotal += quantity;

        flowersSum += line_total;

        lines.push({

            product_id: product_id,

            color_variant_id: color_variant_id,

            quantity: quantity,

            unit_price: unit_price,

            line_total: line_total,

            name: stem.name,

            category_name: stem.category_name || '',

            flower_color: flower_color

        });

    }



    if (lines.length === 0) {

        return { ok: false, message: 'Обери хоча б одну квітку' };

    }



    const packagingResult = await resolvePackaging(packagingProductId);

    if (!packagingResult.ok) {

        return packagingResult;

    }



    const packaging = packagingResult.packaging;

    const packagingProduct = packagingResult.packagingProduct;



    const summaryParts = [];

    for (let i = 0; i < lines.length; i += 1) {

        const line = lines[i];

        summaryParts.push(lineLabel(line) + ' ×' + line.quantity);

    }



    const summary = summaryParts.join(', ');

    const total = flowersSum + Number(packaging.price || 0);



    const calcPayload = {

        lines,

        packaging,

        packagingProduct,

        summary,

        stemTotal,

        flowersSum,

        total,

        minStems

    };



    if (stemTotal < minStems) {

        return {

            ok: false,

            reason: 'min_stems',

            message: 'У букеті має бути мінімум ' + minStems + ' квіток (зараз ' + stemTotal + ')',

            ...calcPayload

        };

    }



    return {

        ok: true,

        ...calcPayload,

        note: buildBouquetNote(summary, packaging.label)

    };

};



const readCookie = (cookieHeader, name) => {

    if (!cookieHeader || typeof cookieHeader !== 'string' || !name) {

        return '';

    }

    const parts = cookieHeader.split(';');

    for (let i = 0; i < parts.length; i += 1) {

        const trimmed = parts[i].trim();

        const idx = trimmed.indexOf('=');

        if (idx === -1) {

            continue;

        }

        const key = trimmed.slice(0, idx).trim();

        if (key !== name) {

            continue;

        }

        let value = trimmed.slice(idx + 1).trim();

        try {

            value = decodeURIComponent(value);

        } catch (err) {

        }

        return value;

    }

    return '';

};



const getNoteFromRequest = (req) => {

    const raw = readCookie(req.headers.cookie, CONSTRUCTOR_NOTE_COOKIE);

    if (!raw || typeof raw !== 'string') {

        return '';

    }

    return raw.trim();

};



const clearNoteCookie = (res) => {

    res.clearCookie(CONSTRUCTOR_NOTE_COOKIE);

};



module.exports = {

    CONSTRUCTOR_NOTE_COOKIE,

    getSettings,

    groupPartsForPage,

    lineLabel,

    listPackagingOptions,

    parseItemsFromBody,

    mergeRawItems,

    buildBouquetNote,

    calcBouquet,

    getNoteFromRequest,

    clearNoteCookie

};

