const db = require('../config/db');
const BouquetTemplateModel = require('../models/BouquetTemplate');

const seedDefaultBouquetTemplates = async () => {
    const [countRows] = await db.execute('SELECT COUNT(*) AS n FROM bouquet_templates');
    if (Number(countRows[0].n) > 0) {
        return;
    }

    const [roseRows] = await db.execute(
        `SELECT p.id
         FROM products p
         WHERE p.is_constructor = 1 AND p.is_active = 1
           AND (p.slug = 'troianda-1-sht' OR p.slug = 'stem-trojandy')
         ORDER BY p.id ASC
         LIMIT 1`
    );
    const [tulipRows] = await db.execute(
        `SELECT p.id
         FROM products p
         WHERE p.is_constructor = 1 AND p.is_active = 1 AND p.slug = 'stem-tulpan'
         LIMIT 1`
    );
    const [redVariantRows] = await db.execute(
        `SELECT pcv.id
         FROM product_color_variants pcv
         INNER JOIN products p ON p.id = pcv.product_id
         WHERE pcv.flower_color = 'Червоний' AND pcv.is_active = 1
           AND (p.slug = 'troianda-1-sht' OR p.slug = 'stem-trojandy')
         LIMIT 1`
    );
    const [packCraftRows] = await db.execute(
        "SELECT id FROM products WHERE slug = 'pack-craft' LIMIT 1"
    );
    const [packStandardRows] = await db.execute(
        "SELECT id FROM products WHERE slug = 'pack-standard' LIMIT 1"
    );

    const roseId = roseRows[0] ? Number(roseRows[0].id) : null;
    const tulipId = tulipRows[0] ? Number(tulipRows[0].id) : null;
    const redVariantId = redVariantRows[0] ? Number(redVariantRows[0].id) : null;
    const packCraftId = packCraftRows[0] ? Number(packCraftRows[0].id) : null;
    const packStandardId = packStandardRows[0] ? Number(packStandardRows[0].id) : null;

    if (roseId && redVariantId) {
        await BouquetTemplateModel.create(
            {
                name: 'Класика — 11 червоних троянд',
                description: 'Готовий рецепт романтичного букета. Можна одразу купити або змінити кількість і колір у конструкторі.',
                packaging_product_id: packCraftId || packStandardId,
                sort_order: 1,
                is_active: 1
            },
            [{ product_id: roseId, color_variant_id: redVariantId, quantity: 11 }]
        );
    }

    if (tulipId) {
        await BouquetTemplateModel.create(
            {
                name: 'Весняний — 15 тюльпанів',
                description: 'Свіжий весняний букет з тюльпанів. Завантаж у конструктор і підлаштуй під себе.',
                packaging_product_id: packStandardId,
                sort_order: 2,
                is_active: 1
            },
            [{ product_id: tulipId, color_variant_id: null, quantity: 15 }]
        );
    }
};

module.exports = seedDefaultBouquetTemplates;
