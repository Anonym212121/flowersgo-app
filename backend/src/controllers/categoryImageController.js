const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Category = require('../models/Category');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'categories');

const ensureUploadsDir = () => {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadsDir();
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const safeExt = allowedExt.includes(ext) ? ext : '.jpg';
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
        cb(null, name);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMime = /^(image\/jpeg|image\/jpg|image\/png|image\/gif|image\/webp)$/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (allowedMime.test(file.mimetype || '') || allowedExt.includes(ext)) {
        return cb(null, true);
    }
    cb(new Error('Дозволені лише зображення: jpeg, png, gif, webp'));
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});

const uploadMiddleware = upload.single('image');

const uploadCategoryImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Немає файлу' });
        }

        const categoryId = Number(req.body.category_id);
        if (!Number.isFinite(categoryId) || categoryId <= 0) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {
            }
            return res.status(400).json({ message: 'Невірний id категорії' });
        }

        const publicUrl = `/uploads/categories/${req.file.filename}`;
        const updated = await Category.updateImageUrl(categoryId, publicUrl);

        if (!updated) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {
            }
            return res.status(404).json({ message: 'Категорію не знайдено' });
        }

        return res.status(200).json({ ok: true, image_url: publicUrl });
    } catch (err) {
        console.error('uploadCategoryImage:', err.message);
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {
            }
        }
        return res.status(500).json({ message: 'Помилка збереження' });
    }
};

module.exports = {
    uploadMiddleware,
    uploadCategoryImage
};
