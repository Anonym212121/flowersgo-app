const LegalPageModel = require('../models/LegalPage');
const sanitizeLegalHtml = require('../utils/sanitizeLegalHtml');
const { textToHtml, htmlToText } = require('../utils/legalTextFormat');

const listForAdmin = async (req, res) => {
    try {
        const pages = await LegalPageModel.listAll();
        return res.status(200).json({ pages });
    } catch (err) {
        console.error('adminLegal list:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const getOneForAdmin = async (req, res) => {
    try {
        const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
        if (!LegalPageModel.isAllowedSlug(slug)) {
            return res.status(400).json({ message: 'Невірна сторінка' });
        }

        const page = await LegalPageModel.getBySlug(slug);
        if (!page) {
            return res.status(404).json({ message: 'Сторінку не знайдено' });
        }

        let body_text = page.body_text;
        if (!body_text || String(body_text).trim() === '') {
            body_text = htmlToText(page.body_html);
        }

        return res.status(200).json({
            page: {
                slug: page.slug,
                title: page.title,
                lead_text: page.lead_text,
                body_text,
                updatedAt: page.updatedAt
            }
        });
    } catch (err) {
        console.error('adminLegal getOne:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const saveForAdmin = async (req, res) => {
    try {
        const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
        if (!LegalPageModel.isAllowedSlug(slug)) {
            return res.status(400).json({ message: 'Невірна сторінка' });
        }

        const body = req.body || {};
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const lead_text = typeof body.lead_text === 'string' ? body.lead_text.trim() : '';
        const body_text = typeof body.body_text === 'string' ? body.body_text.trim() : '';

        if (!title || title.length < 3) {
            return res.status(400).json({ message: 'Вкажіть заголовок' });
        }

        if (!body_text || body_text.length < 20) {
            return res.status(400).json({ message: 'Текст сторінки занадто короткий' });
        }

        if (slug === 'delivery-terms' && body_text.indexOf('[тарифи доставки]') === -1) {
            return res.status(400).json({
                message: 'У умовах доставки залиште рядок [тарифи доставки] — там показуються тарифи'
            });
        }

        const body_html = sanitizeLegalHtml(textToHtml(body_text));
        if (!body_html || body_html.length < 20) {
            return res.status(400).json({ message: 'Не вдалося сформувати текст сторінки' });
        }

        const ok = await LegalPageModel.updateBySlug(slug, {
            title,
            lead_text,
            body_text,
            body_html
        });

        if (!ok) {
            return res.status(404).json({ message: 'Сторінку не знайдено' });
        }

        const page = await LegalPageModel.getBySlug(slug);
        return res.status(200).json({
            message: 'Сторінку збережено',
            page: {
                slug: page.slug,
                title: page.title,
                lead_text: page.lead_text,
                body_text: page.body_text,
                updatedAt: page.updatedAt
            }
        });
    } catch (err) {
        console.error('adminLegal save:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    listForAdmin,
    getOneForAdmin,
    saveForAdmin
};
