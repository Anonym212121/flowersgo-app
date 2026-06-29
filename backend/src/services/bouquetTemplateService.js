const BouquetTemplateModel = require('../models/BouquetTemplate');
const constructorService = require('./constructorService');

const mapItemForClient = (row) => {
    let label = row.category_name || row.product_name || 'Квітка';
    if (row.flower_color) {
        label += ' (' + row.flower_color + ')';
    }
    return {
        product_id: Number(row.product_id),
        color_variant_id: row.color_variant_id != null ? Number(row.color_variant_id) : null,
        quantity: Number(row.quantity),
        label: label
    };
};

const enrichWithCalc = async (template, items) => {
    const draft = BouquetTemplateModel.itemsToDraftPayload(items, template.packaging_product_id);
    const calc = await constructorService.calcBouquet(draft.items, draft.packaging);
    const stemTotal = calc.stemTotal != null ? calc.stemTotal : 0;
    const total = calc.total != null ? calc.total : null;
    const available = calc.ok === true;

    return {
        id: template.id,
        name: template.name,
        slug: template.slug,
        description: template.description || '',
        image_url: template.image_url || '',
        packaging_product_id: template.packaging_product_id,
        sort_order: template.sort_order,
        stem_total: stemTotal,
        total: total,
        available: available,
        unavailable_message: available ? '' : calc.message || 'Зараз недоступно',
        items_preview: (Array.isArray(items) ? items : []).map(mapItemForClient)
    };
};

const listForClient = async () => {
    const rows = await BouquetTemplateModel.listActive();
    const result = [];
    for (let i = 0; i < rows.length; i += 1) {
        const items = await BouquetTemplateModel.listItemsByTemplateId(rows[i].id);
        if (items.length === 0) {
            continue;
        }
        result.push(await enrichWithCalc(rows[i], items));
    }
    return result;
};

const getDraftBySlug = async (slug) => {
    const full = await BouquetTemplateModel.findFullBySlug(slug);
    if (!full) {
        return { ok: false, message: 'Шаблон не знайдено' };
    }
    const draft = BouquetTemplateModel.itemsToDraftPayload(full.items, full.template.packaging_product_id);
    if (draft.items.length === 0) {
        return { ok: false, message: 'У шаблоні немає квітів' };
    }
    const calc = await constructorService.calcBouquet(draft.items, draft.packaging);
    return {
        ok: true,
        template: {
            id: full.template.id,
            name: full.template.name,
            slug: full.template.slug,
            description: full.template.description || ''
        },
        draft: draft,
        calc: calc
    };
};

const getForClientBySlug = async (slug) => {
    const full = await BouquetTemplateModel.findFullBySlug(slug);
    if (!full) {
        return { ok: false, message: 'Шаблон не знайдено' };
    }
    const enriched = await enrichWithCalc(full.template, full.items);
    return { ok: true, template: enriched, draft: BouquetTemplateModel.itemsToDraftPayload(full.items, full.template.packaging_product_id) };
};

const parseItemsFromBody = (body) => {
    if (!body || !Array.isArray(body.items)) {
        return [];
    }
    const result = [];
    for (let i = 0; i < body.items.length; i += 1) {
        const row = body.items[i];
        const product_id = Number(row.product_id);
        const quantity = Math.floor(Number(row.quantity));
        let color_variant_id = null;
        if (row.color_variant_id != null && row.color_variant_id !== '') {
            const vid = Number(row.color_variant_id);
            if (Number.isFinite(vid) && vid > 0) {
                color_variant_id = vid;
            }
        }
        if (!Number.isFinite(product_id) || product_id <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
            continue;
        }
        result.push({ product_id, color_variant_id, quantity });
    }
    return result;
};

module.exports = {
    listForClient,
    getDraftBySlug,
    getForClientBySlug,
    enrichWithCalc,
    parseItemsFromBody
};
