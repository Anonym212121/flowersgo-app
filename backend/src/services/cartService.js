const ProductModel = require('../models/Product');

const ProductColorVariant = require('../models/ProductColorVariant');



const CART_COOKIE_NAME = 'cart_items';

const CART_MAX_ITEMS = 100;



const parseCookies = (cookieHeader) => {

    const result = {};

    if (!cookieHeader || typeof cookieHeader !== 'string') {

        return result;

    }

    const parts = cookieHeader.split(';');

    for (const item of parts) {

        const trimmed = item.trim();

        const idx = trimmed.indexOf('=');

        if (idx === -1) {

            continue;

        }

        const key = trimmed.slice(0, idx).trim();

        const value = trimmed.slice(idx + 1).trim();

        if (key) {

            result[key] = decodeURIComponent(value);

        }

    }

    return result;

};



const decodeCookieValue = (raw) => {

    if (!raw || typeof raw !== 'string') {

        return '';

    }

    let value = raw;

    for (let i = 0; i < 3; i += 1) {

        try {

            const next = decodeURIComponent(value);

            if (next === value) {

                break;

            }

            value = next;

        } catch {

            break;

        }

    }

    return value;

};



const cartLineKey = (item) => {

    const product_id = Number(item && item.product_id);

    let color_variant_id = 0;

    if (item && item.color_variant_id != null && item.color_variant_id !== '') {

        const vid = Number(item.color_variant_id);

        if (Number.isFinite(vid) && vid > 0) {

            color_variant_id = vid;

        }

    }

    return `${product_id}:${color_variant_id}`;

};



const normalizeCartItem = (item) => {

    const product_id = Number(item && item.product_id);

    const quantity = Number(item && item.quantity);

    if (!Number.isFinite(product_id) || product_id <= 0) {

        return null;

    }

    if (!Number.isFinite(quantity) || quantity <= 0) {

        return null;

    }



    let color_variant_id = null;

    if (item && item.color_variant_id != null && item.color_variant_id !== '') {

        const vid = Number(item.color_variant_id);

        if (Number.isFinite(vid) && vid > 0) {

            color_variant_id = vid;

        }

    }



    return {

        product_id,

        color_variant_id,

        quantity: Math.min(Math.floor(quantity), 999)

    };

};



const normalizeCartItems = (raw) => {

    if (!Array.isArray(raw)) {

        return [];

    }



    const map = new Map();

    for (const item of raw) {

        const normalized = normalizeCartItem(item);

        if (!normalized) {

            continue;

        }

        const key = cartLineKey(normalized);

        const prev = map.get(key) || 0;

        map.set(key, Math.min(prev + normalized.quantity, 999));

    }



    const result = [];

    for (const [key, quantity] of map.entries()) {

        const parts = key.split(':');

        const product_id = Number(parts[0]);

        const variantPart = Number(parts[1]);

        result.push({

            product_id,

            color_variant_id: variantPart > 0 ? variantPart : null,

            quantity

        });

        if (result.length >= CART_MAX_ITEMS) {

            break;

        }

    }



    return result;

};



const getCartFromRequest = (req) => {

    const cookies = parseCookies(req.headers.cookie);

    const raw = cookies[CART_COOKIE_NAME];

    if (!raw) {

        return [];

    }

    try {

        const parsed = JSON.parse(decodeCookieValue(raw));

        return normalizeCartItems(parsed);

    } catch {

        return [];

    }

};



const setCartCookie = (res, items) => {

    const normalized = normalizeCartItems(items);

    res.cookie(CART_COOKIE_NAME, JSON.stringify(normalized), {

        httpOnly: false,

        sameSite: 'lax',

        maxAge: 30 * 24 * 60 * 60 * 1000

    });

};



const clearCartCookie = (res) => {

    res.clearCookie(CART_COOKIE_NAME);

};



const addToCart = (currentItems, productId, quantity = 1, colorVariantId = null) => {

    const pid = Number(productId);

    const qty = Math.floor(Number(quantity));

    if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(qty) || qty <= 0) {

        return normalizeCartItems(currentItems);

    }



    let color_variant_id = null;

    if (colorVariantId != null && colorVariantId !== '') {

        const vid = Number(colorVariantId);

        if (Number.isFinite(vid) && vid > 0) {

            color_variant_id = vid;

        }

    }



    const map = new Map();

    for (const row of normalizeCartItems(currentItems)) {

        map.set(cartLineKey(row), row.quantity);

    }



    const key = cartLineKey({ product_id: pid, color_variant_id });

    const prev = map.get(key) || 0;

    map.set(key, Math.min(prev + qty, 999));



    return Array.from(map.entries()).map(([lineKey, quantityValue]) => {

        const parts = lineKey.split(':');

        const product_id = Number(parts[0]);

        const variantPart = Number(parts[1]);

        return {

            product_id,

            color_variant_id: variantPart > 0 ? variantPart : null,

            quantity: quantityValue

        };

    });

};



const updateCartItem = (currentItems, productId, quantity, colorVariantId = null) => {

    const pid = Number(productId);

    const qty = Math.floor(Number(quantity));



    let color_variant_id = null;

    if (colorVariantId != null && colorVariantId !== '') {

        const vid = Number(colorVariantId);

        if (Number.isFinite(vid) && vid > 0) {

            color_variant_id = vid;

        }

    }



    const map = new Map();

    for (const row of normalizeCartItems(currentItems)) {

        map.set(cartLineKey(row), row.quantity);

    }



    const key = cartLineKey({ product_id: pid, color_variant_id });

    if (!Number.isFinite(pid) || pid <= 0) {

        return normalizeCartItems(currentItems);

    }

    if (!Number.isFinite(qty) || qty <= 0) {

        map.delete(key);

    } else {

        map.set(key, Math.min(qty, 999));

    }



    return Array.from(map.entries()).map(([lineKey, quantityValue]) => {

        const parts = lineKey.split(':');

        const product_id = Number(parts[0]);

        const variantPart = Number(parts[1]);

        return {

            product_id,

            color_variant_id: variantPart > 0 ? variantPart : null,

            quantity: quantityValue

        };

    });

};



const removeFromCart = (currentItems, productId, colorVariantId = null) => {

    return updateCartItem(currentItems, productId, 0, colorVariantId);

};



const buildCartDetails = async (items) => {

    const normalized = normalizeCartItems(items);

    if (normalized.length === 0) {

        return { lines: [], total: 0, items: [] };

    }



    const ids = normalized.map((i) => i.product_id);

    const products = await ProductModel.productsByIds(ids);

    const byId = {};

    for (const p of products) {

        byId[Number(p.id)] = p;

    }



    const variantIds = normalized

        .map((i) => i.color_variant_id)

        .filter((id) => id != null && Number(id) > 0);

    const variantById = {};

    for (const vid of variantIds) {

        const variant = await ProductColorVariant.findById(vid);

        if (variant) {

            variantById[Number(variant.id)] = variant;

        }

    }



    const lines = [];

    let total = 0;

    for (const it of normalized) {

        const product = byId[it.product_id];

        if (!product) {

            continue;

        }



        let stock = Number(product.stock_quantity || 0);

        let flower_color = '';

        let image_url = product.image_url || '';



        if (it.color_variant_id) {

            const variant = variantById[Number(it.color_variant_id)];

            if (!variant || Number(variant.product_id) !== Number(product.id)) {

                continue;

            }

            stock = Number(variant.stock_quantity || 0);

            flower_color = variant.flower_color || '';

            if (variant.image_url) {

                image_url = variant.image_url;

            }

        }



        if (stock <= 0) {

            continue;

        }



        const qty = Math.min(it.quantity, stock);

        const unit_price = Number(product.sale_price || 0);

        const line_total = qty * unit_price;

        total += line_total;



        const productView = {

            ...product,

            stock_quantity: stock,

            image_url: image_url

        };



        lines.push({

            product_id: Number(product.id),

            color_variant_id: it.color_variant_id,

            flower_color: flower_color,

            quantity: qty,

            unit_price,

            line_total,

            max_quantity: stock,

            product: productView

        });

    }



    const orderItems = lines.map((l) => ({

        product_id: l.product_id,

        color_variant_id: l.color_variant_id,

        quantity: l.quantity,

        unit_price: l.unit_price

    }));



    return { lines, total, items: orderItems };

};



module.exports = {

    CART_COOKIE_NAME,

    getCartFromRequest,

    setCartCookie,

    clearCartCookie,

    addToCart,

    updateCartItem,

    removeFromCart,

    buildCartDetails,

    normalizeCartItems

};

