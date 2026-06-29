const db = require('../config/db');

const cyrillicToLatin = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ё: 'e', ж: 'zh', з: 'z',
    и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '',
    ъ: '', ы: 'y', э: 'e', ю: 'iu', я: 'ia'
};

const slugFromName = (raw) => {
    const s = String(raw || '').trim().toLowerCase();
    let out = '';
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        if (cyrillicToLatin[ch]) {
            out += cyrillicToLatin[ch];
        } else if (/[a-z0-9]/.test(ch)) {
            out += ch;
        } else if (ch === ' ' || ch === '-' || ch === '_') {
            out += '-';
        }
    }
    out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return out || 'shablon';
};

const ensureUniqueSlug = async (base, excludeId) => {
    let candidate = base;
    let n = 0;
    while (n < 50) {
        let sql = 'SELECT id FROM bouquet_templates WHERE slug = ? LIMIT 1';
        const params = [candidate];
        if (excludeId != null) {
            sql = 'SELECT id FROM bouquet_templates WHERE slug = ? AND id != ? LIMIT 1';
            params.push(excludeId);
        }
        const [rows] = await db.execute(sql, params);
        if (rows.length === 0) {
            return candidate;
        }
        n += 1;
        candidate = `${base}-${n}`;
    }
    return `${base}-${Date.now().toString(36)}`;
};

const normalizeItemRow = (row) => {
    if (!row) {
        return null;
    }
    let color_variant_id = null;
    if (row.color_variant_id != null && row.color_variant_id !== '') {
        const vid = Number(row.color_variant_id);
        if (Number.isFinite(vid) && vid > 0) {
            color_variant_id = vid;
        }
    }
    const quantity = Math.floor(Number(row.quantity));
    const product_id = Number(row.product_id);
    if (!Number.isFinite(product_id) || product_id <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        return null;
    }
    return {
        product_id: product_id,
        color_variant_id: color_variant_id,
        quantity: quantity
    };
};

const listItemsByTemplateId = async (templateId) => {
    const [rows] = await db.execute(
        `SELECT bti.id, bti.template_id, bti.product_id, bti.color_variant_id, bti.quantity, bti.sort_order,
                p.name AS product_name, c.name AS category_name,
                pcv.flower_color, pcv.color_hex
         FROM bouquet_template_items bti
         INNER JOIN products p ON p.id = bti.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN product_color_variants pcv ON pcv.id = bti.color_variant_id
         WHERE bti.template_id = ?
         ORDER BY bti.sort_order ASC, bti.id ASC`,
        [templateId]
    );
    return rows;
};

const listActive = async () => {
    const [rows] = await db.execute(
        `SELECT id, name, slug, description, image_url, packaging_product_id, sort_order
         FROM bouquet_templates
         WHERE is_active = 1
         ORDER BY sort_order ASC, name ASC`
    );
    return rows;
};

const listForAdmin = async () => {
    const [rows] = await db.execute(
        `SELECT id, name, slug, description, image_url, packaging_product_id, is_active, sort_order, created_at
         FROM bouquet_templates
         ORDER BY sort_order ASC, name ASC`
    );
    return rows;
};

const findBySlug = async (slug) => {
    const value = String(slug || '').trim();
    if (!value) {
        return null;
    }
    const [rows] = await db.execute(
        'SELECT * FROM bouquet_templates WHERE slug = ? LIMIT 1',
        [value]
    );
    return rows[0] || null;
};

const findById = async (id) => {
    const tid = Number(id);
    if (!Number.isFinite(tid) || tid <= 0) {
        return null;
    }
    const [rows] = await db.execute(
        'SELECT * FROM bouquet_templates WHERE id = ? LIMIT 1',
        [tid]
    );
    return rows[0] || null;
};

const findFullBySlug = async (slug) => {
    const template = await findBySlug(slug);
    if (!template || Number(template.is_active) !== 1) {
        return null;
    }
    const items = await listItemsByTemplateId(template.id);
    return { template: template, items: items };
};

const findFullById = async (id) => {
    const template = await findById(id);
    if (!template) {
        return null;
    }
    const items = await listItemsByTemplateId(template.id);
    return { template: template, items: items };
};

const replaceItems = async (templateId, rawItems) => {
    await db.execute('DELETE FROM bouquet_template_items WHERE template_id = ?', [templateId]);
    const list = Array.isArray(rawItems) ? rawItems : [];
    for (let i = 0; i < list.length; i += 1) {
        const item = normalizeItemRow(list[i]);
        if (!item) {
            continue;
        }
        await db.execute(
            `INSERT INTO bouquet_template_items (template_id, product_id, color_variant_id, quantity, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [templateId, item.product_id, item.color_variant_id, item.quantity, i]
        );
    }
};

const create = async (payload, rawItems) => {
    const name = String(payload.name || '').trim();
    if (!name) {
        return { ok: false, message: 'Вкажіть назву шаблону' };
    }

    const baseSlug = slugFromName(payload.slug || name);
    const slug = await ensureUniqueSlug(baseSlug, null);
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    const image_url = typeof payload.image_url === 'string' ? payload.image_url.trim() : null;

    let packaging_product_id = null;
    if (payload.packaging_product_id != null && payload.packaging_product_id !== '') {
        const pid = Number(payload.packaging_product_id);
        if (Number.isFinite(pid) && pid > 0) {
            packaging_product_id = pid;
        }
    }

    const sort_order = Math.floor(Number(payload.sort_order)) || 0;
    let is_active = 1;
    if (payload.is_active === 0 || payload.is_active === '0' || payload.is_active === false) {
        is_active = 0;
    }

    const [result] = await db.execute(
        `INSERT INTO bouquet_templates (name, slug, description, image_url, packaging_product_id, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, slug, description || null, image_url || null, packaging_product_id, is_active, sort_order]
    );

    const templateId = result.insertId;
    await replaceItems(templateId, rawItems);

    return { ok: true, id: templateId };
};

const update = async (id, payload, rawItems) => {
    const template = await findById(id);
    if (!template) {
        return { ok: false, message: 'Шаблон не знайдено' };
    }

    const name = String(payload.name || template.name || '').trim();
    if (!name) {
        return { ok: false, message: 'Вкажіть назву шаблону' };
    }

    let slug = template.slug;
    if (payload.slug && String(payload.slug).trim()) {
        slug = await ensureUniqueSlug(slugFromName(payload.slug), template.id);
    } else if (name !== template.name) {
        slug = await ensureUniqueSlug(slugFromName(name), template.id);
    }

    const description =
        payload.description !== undefined
            ? (typeof payload.description === 'string' ? payload.description.trim() : '')
            : template.description;

    const image_url =
        payload.image_url !== undefined
            ? (typeof payload.image_url === 'string' ? payload.image_url.trim() : null)
            : template.image_url;

    let packaging_product_id = template.packaging_product_id;
    if (payload.packaging_product_id !== undefined) {
        packaging_product_id = null;
        if (payload.packaging_product_id != null && payload.packaging_product_id !== '') {
            const pid = Number(payload.packaging_product_id);
            if (Number.isFinite(pid) && pid > 0) {
                packaging_product_id = pid;
            }
        }
    }

    const sort_order =
        payload.sort_order !== undefined ? Math.floor(Number(payload.sort_order)) || 0 : template.sort_order;

    let is_active = Number(template.is_active) === 0 ? 0 : 1;
    if (payload.is_active === 0 || payload.is_active === '0' || payload.is_active === false) {
        is_active = 0;
    } else if (payload.is_active === 1 || payload.is_active === '1' || payload.is_active === true) {
        is_active = 1;
    }

    await db.execute(
        `UPDATE bouquet_templates
         SET name = ?, slug = ?, description = ?, image_url = ?, packaging_product_id = ?, is_active = ?, sort_order = ?
         WHERE id = ?`,
        [name, slug, description || null, image_url || null, packaging_product_id, is_active, sort_order, template.id]
    );

    if (rawItems !== undefined) {
        await replaceItems(template.id, rawItems);
    }

    return { ok: true, id: template.id };
};

const setActive = async (id, isActive) => {
    const template = await findById(id);
    if (!template) {
        return { ok: false, message: 'Шаблон не знайдено' };
    }
    const value = Number(isActive) === 1 ? 1 : 0;
    await db.execute('UPDATE bouquet_templates SET is_active = ? WHERE id = ?', [value, template.id]);
    return { ok: true };
};

const remove = async (id) => {
    const template = await findById(id);
    if (!template) {
        return { ok: false, message: 'Шаблон не знайдено' };
    }
    await db.execute('DELETE FROM bouquet_template_items WHERE template_id = ?', [template.id]);
    await db.execute('DELETE FROM bouquet_templates WHERE id = ?', [template.id]);
    return { ok: true };
};

module.exports = {
    listActive,
    listForAdmin,
    findBySlug,
    findById,
    findFullBySlug,
    findFullById,
    listItemsByTemplateId,
    create,
    update,
    setActive,
    remove,
    itemsToDraftPayload: (items, packagingProductId) => {
        const draftItems = [];
        const list = Array.isArray(items) ? items : [];
        for (let i = 0; i < list.length; i += 1) {
            const row = list[i];
            draftItems.push({
                product_id: Number(row.product_id),
                color_variant_id: row.color_variant_id != null ? Number(row.color_variant_id) : null,
                quantity: Number(row.quantity)
            });
        }
        return {
            items: draftItems,
            packaging: packagingProductId != null ? String(packagingProductId) : ''
        };
    }
};
