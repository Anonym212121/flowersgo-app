const db = require('../config/db');

const ALLOWED_SLUGS = ['privacy', 'delivery-terms'];

const isAllowedSlug = (slug) => {
    return ALLOWED_SLUGS.includes(slug);
};

const listAll = async () => {
    const [rows] = await db.execute(
        `SELECT slug, title, lead_text, updatedAt
         FROM legal_pages
         ORDER BY id ASC`
    );
    return rows || [];
};

const getBySlug = async (slug) => {
    if (!isAllowedSlug(slug)) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT slug, title, lead_text, body_text, body_html, updatedAt
         FROM legal_pages
         WHERE slug = ?
         LIMIT 1`,
        [slug]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    return rows[0];
};

const updateBySlug = async (slug, payload) => {
    if (!isAllowedSlug(slug)) {
        return false;
    }

    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 200) : '';
    const lead_text = typeof payload.lead_text === 'string' ? payload.lead_text.trim().slice(0, 1000) : '';
    const body_text = typeof payload.body_text === 'string' ? payload.body_text.trim().slice(0, 80000) : '';
    const body_html = typeof payload.body_html === 'string' ? payload.body_html : '';

    if (!title || !body_text || !body_html) {
        return false;
    }

    const [result] = await db.execute(
        `UPDATE legal_pages
         SET title = ?, lead_text = ?, body_text = ?, body_html = ?, updatedAt = NOW()
         WHERE slug = ?`,
        [title, lead_text, body_text, body_html, slug]
    );

    return result && result.affectedRows > 0;
};

module.exports = {
    ALLOWED_SLUGS,
    isAllowedSlug,
    listAll,
    getBySlug,
    updateBySlug
};
