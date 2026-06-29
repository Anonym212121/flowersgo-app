const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const lexicon = require('../utils/bouquetFlowerLexicon');
const constructorService = require('./constructorService');

const PREVIEW_DIR = path.join(__dirname, '../../public/uploads/bouquet-previews');
const PREVIEW_COOKIE = 'constructor_bouquet_preview';
const PREVIEW_KEY_COOKIE = 'constructor_preview_key';

const readCookie = (cookieHeader, name) => {
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return '';
    }
    const parts = cookieHeader.split(';');
    for (let i = 0; i < parts.length; i++) {
        const chunk = parts[i].trim();
        const idx = chunk.indexOf('=');
        if (idx === -1) {
            continue;
        }
        const key = chunk.slice(0, idx).trim();
        if (key === name) {
            return decodeURIComponent(chunk.slice(idx + 1).trim());
        }
    }
    return '';
};

const getPreviewFromRequest = (req) => {
    const raw = readCookie(req.headers.cookie, PREVIEW_COOKIE);
    if (!raw || typeof raw !== 'string') {
        return '';
    }
    const url = raw.trim();
    if (!url.startsWith('/uploads/bouquet-previews/')) {
        return '';
    }
    return url;
};

const linesFromCalc = (calcResult) => {
    const result = [];
    const lines = Array.isArray(calcResult.lines) ? calcResult.lines : [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const qty = Math.floor(Number(line.quantity));
        if (!Number.isFinite(qty) || qty <= 0) {
            continue;
        }
        result.push({
            label: constructorService.lineLabel(line),
            quantity: qty,
            product_id: Number(line.product_id),
            color_variant_id: line.color_variant_id != null ? Number(line.color_variant_id) : null,
            category_name: line.category_name || '',
            name: line.name || '',
            flower_color: line.flower_color || ''
        });
    }

    return result;
};

const buildImagePrompt = (rows, packagingLabel) => {
    const enParts = [];
    const ukParts = [];
    let stemTotal = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const flower = lexicon.flowerEnglishName(row.category_name, row.name);
        const color = lexicon.colorEnglishName(row.flower_color);
        ukParts.push(row.quantity + '× ' + row.label);
        let enLine = row.quantity + ' ';
        if (color) {
            enLine += color + ' ';
        }
        enLine += flower;
        enParts.push(enLine);
        stemTotal += row.quantity;
    }

    const wrap = lexicon.packagingEnglish(packagingLabel);
    let prompt = 'Photo of one flower bouquet, light background. ';
    prompt += 'Ukrainian order: ' + ukParts.join(', ') + '. ';
    prompt += 'Flowers: ' + enParts.join(', ') + '. ';
    prompt += 'Total ' + stemTotal + ' stems, wrap: ' + wrap + '. ';
    prompt += 'Only listed flowers, no text or logo.';

    return prompt;
};

const makePreviewKey = (rows, packagingLabel) => {
    const raw = JSON.stringify({ rows: rows, packaging: packagingLabel });
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20);
};

const isValidPreviewKey = (key) => {
    return typeof key === 'string' && /^[a-f0-9]{20}$/.test(key);
};

const ensurePreviewDir = () => {
    if (!fs.existsSync(PREVIEW_DIR)) {
        fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    }
};

const readCachedImage = (hash) => {
    if (!isValidPreviewKey(hash)) {
        return null;
    }
    const filePath = path.join(PREVIEW_DIR, hash + '.png');
    if (fs.existsSync(filePath)) {
        return '/uploads/bouquet-previews/' + hash + '.png';
    }
    return null;
};

const saveImageBase64 = (hash, b64) => {
    if (!isValidPreviewKey(hash)) {
        return null;
    }
    ensurePreviewDir();
    const buf = Buffer.from(b64, 'base64');
    if (
        buf.length < 8 ||
        buf[0] !== 0x89 ||
        buf[1] !== 0x50 ||
        buf[2] !== 0x4e ||
        buf[3] !== 0x47
    ) {
        return null;
    }
    const filePath = path.join(PREVIEW_DIR, hash + '.png');
    fs.writeFileSync(filePath, buf);
    return '/uploads/bouquet-previews/' + hash + '.png';
};

const parseImagePayload = (raw) => {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) {
        return null;
    }
    if (text.indexOf('base64,') !== -1) {
        const chunk = text.split('base64,')[1];
        return chunk ? chunk.trim() : null;
    }
    return text;
};

const buildPreviewForCalc = (calcResult) => {
    if (!calcResult || !calcResult.ok) {
        return { ok: false, message: 'Спочатку збери коректний букет' };
    }

    const rows = linesFromCalc(calcResult);
    if (!rows.length) {
        return { ok: false, message: 'Немає квітів для превʼю' };
    }

    const packagingLabel = calcResult.packaging ? calcResult.packaging.label || '' : '';
    const previewKey = makePreviewKey(rows, packagingLabel);
    const cachedUrl = readCachedImage(previewKey);
    let stemTotal = 0;
    for (let i = 0; i < rows.length; i++) {
        stemTotal += rows[i].quantity;
    }

    return {
        ok: true,
        prompt: buildImagePrompt(rows, packagingLabel),
        preview_key: previewKey,
        image_url: cachedUrl,
        cached: !!cachedUrl,
        stem_total: stemTotal,
        summary: calcResult.summary || '',
        composition: rows
    };
};

const savePreviewImage = (previewKey, imagePayload) => {
    if (!isValidPreviewKey(previewKey)) {
        return { ok: false, message: 'Невірний ключ превʼю' };
    }

    const b64 = parseImagePayload(imagePayload);
    if (!b64 || b64.length < 100) {
        return { ok: false, message: 'Немає даних зображення' };
    }

    if (b64.length > 6 * 1024 * 1024) {
        return { ok: false, message: 'Зображення занадто велике' };
    }

    const imageUrl = saveImageBase64(previewKey, b64);
    if (!imageUrl) {
        return { ok: false, message: 'Не вдалося зберегти превʼю' };
    }

    return { ok: true, image_url: imageUrl };
};

const clearPreviewCookie = (res) => {
    res.clearCookie(PREVIEW_COOKIE);
    res.clearCookie(PREVIEW_KEY_COOKIE);
};

const setPreviewKeyCookie = (res, previewKey) => {
    if (!isValidPreviewKey(previewKey)) {
        return;
    }
    res.cookie(PREVIEW_KEY_COOKIE, previewKey, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000
    });
};

const applyPreviewUrl = (res, rawUrl) => {
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (url && url.startsWith('/uploads/bouquet-previews/')) {
        res.cookie(PREVIEW_COOKIE, url, {
            httpOnly: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        return;
    }
    clearPreviewCookie(res);
};

const isAllowedPreviewKey = (req, previewKey) => {
    if (!isValidPreviewKey(previewKey)) {
        return false;
    }
    const allowed = readCookie(req.headers.cookie, PREVIEW_KEY_COOKIE);
    return allowed === previewKey;
};

module.exports = {
    PREVIEW_COOKIE,
    PREVIEW_KEY_COOKIE,
    buildPreviewForCalc,
    savePreviewImage,
    getPreviewFromRequest,
    clearPreviewCookie,
    setPreviewKeyCookie,
    applyPreviewUrl,
    isAllowedPreviewKey
};
