const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const trimEnv = (name) => {
    const raw = process.env[name];
    return typeof raw === 'string' ? raw.trim() : '';
};

const getConfig = () => {
    const url = trimEnv('CLOUDINARY_URL');
    if (url.startsWith('cloudinary://')) {
        try {
            const parsed = new URL(url);
            const cloudName = parsed.hostname;
            const apiKey = decodeURIComponent(parsed.username || '');
            const apiSecret = decodeURIComponent(parsed.password || '');
            if (cloudName && apiKey && apiSecret) {
                return { cloudName, apiKey, apiSecret };
            }
        } catch {
            return null;
        }
    }

    const cloudName = trimEnv('CLOUDINARY_CLOUD_NAME');
    const apiKey = trimEnv('CLOUDINARY_API_KEY');
    const apiSecret = trimEnv('CLOUDINARY_API_SECRET');
    if (cloudName && apiKey && apiSecret) {
        return { cloudName, apiKey, apiSecret };
    }
    return null;
};

const isConfigured = () => {
    return !!getConfig();
};

const removeLocalFile = (filePath) => {
    if (!filePath) {
        return;
    }
    try {
        fs.unlinkSync(filePath);
    } catch {
    }
};

const mimeFromName = (filename) => {
    const ext = path.extname(filename || '').toLowerCase();
    if (ext === '.png') {
        return 'image/png';
    }
    if (ext === '.webp') {
        return 'image/webp';
    }
    if (ext === '.gif') {
        return 'image/gif';
    }
    return 'image/jpeg';
};

const signParams = (params, apiSecret) => {
    const keys = Object.keys(params).sort();
    const parts = [];
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        parts.push(key + '=' + params[key]);
    }
    return crypto.createHash('sha1').update(parts.join('&') + apiSecret).digest('hex');
};

const uploadBuffer = async (buffer, folder, filename) => {
    const config = getConfig();
    if (!config) {
        return { ok: false, message: 'Cloudinary не налаштований' };
    }
    if (!buffer || !buffer.length) {
        return { ok: false, message: 'Порожній файл' };
    }

    const safeFolder = folder || 'flowersgo';
    const safeName = path.basename(filename || 'image.jpg');
    const publicId = path.basename(safeName, path.extname(safeName));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const toSign = {
        folder: safeFolder,
        public_id: publicId,
        timestamp
    };
    const signature = signParams(toSign, config.apiSecret);
    const mime = mimeFromName(safeName);
    const dataUri = 'data:' + mime + ';base64,' + buffer.toString('base64');

    const form = new FormData();
    form.append('file', dataUri);
    form.append('api_key', config.apiKey);
    form.append('timestamp', timestamp);
    form.append('signature', signature);
    form.append('folder', safeFolder);
    form.append('public_id', publicId);

    const endpoint =
        'https://api.cloudinary.com/v1_1/' + encodeURIComponent(config.cloudName) + '/image/upload';

    let res;
    try {
        res = await fetch(endpoint, {
            method: 'POST',
            body: form
        });
    } catch (err) {
        return { ok: false, message: 'Не вдалося зʼєднатися з Cloudinary' };
    }

    let data = null;
    try {
        data = await res.json();
    } catch {
        return { ok: false, message: 'Невірна відповідь Cloudinary' };
    }

    const url = data && (data.secure_url || data.url);
    if (!res.ok || !url) {
        const errText = data && data.error && data.error.message
            ? String(data.error.message)
            : 'Помилка завантаження в Cloudinary';
        return { ok: false, message: errText };
    }

    return { ok: true, url: String(url) };
};

const storeMulterFile = async (file, folder, localUrl) => {
    if (!file || !file.path) {
        return { ok: false, message: 'Немає файлу' };
    }

    if (!isConfigured()) {
        return { ok: true, url: localUrl };
    }

    let buffer;
    try {
        buffer = fs.readFileSync(file.path);
    } catch {
        return { ok: false, message: 'Не вдалося прочитати файл' };
    }

    const uploaded = await uploadBuffer(buffer, folder, file.filename || localUrl);
    removeLocalFile(file.path);
    if (!uploaded.ok) {
        return uploaded;
    }
    return { ok: true, url: uploaded.url };
};

const storeBuffer = async (buffer, folder, filename, localUrl) => {
    if (!isConfigured()) {
        return { ok: true, url: localUrl };
    }
    return uploadBuffer(buffer, folder, filename);
};

module.exports = {
    isConfigured,
    removeLocalFile,
    storeMulterFile,
    storeBuffer
};
