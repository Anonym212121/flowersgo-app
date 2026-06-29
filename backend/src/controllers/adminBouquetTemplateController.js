const BouquetTemplateModel = require('../models/BouquetTemplate');
const bouquetTemplateService = require('../services/bouquetTemplateService');
const constructorService = require('../services/constructorService');
const ProductModel = require('../models/Product');

const listForAdmin = async (req, res) => {
    try {
        const rows = await BouquetTemplateModel.listForAdmin();
        const templates = [];
        for (let i = 0; i < rows.length; i += 1) {
            const items = await BouquetTemplateModel.listItemsByTemplateId(rows[i].id);
            const enriched = await bouquetTemplateService.enrichWithCalc(rows[i], items);
            templates.push({
                ...rows[i],
                items_count: items.length,
                stem_total: enriched.stem_total,
                total: enriched.total,
                available: enriched.available
            });
        }
        return res.status(200).json({ templates: templates });
    } catch (err) {
        console.error('adminBouquetTemplate list:', err.message);
        return res.status(500).json({ message: 'Помилка завантаження шаблонів' });
    }
};

const getOneForAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const full = await BouquetTemplateModel.findFullById(id);
        if (!full) {
            return res.status(404).json({ message: 'Шаблон не знайдено' });
        }
        const enriched = await bouquetTemplateService.enrichWithCalc(full.template, full.items);
        const packagingOptions = await constructorService.listPackagingOptions();
        const stems = await ProductModel.listConstructorStemsWithVariants();
        return res.status(200).json({
            template: full.template,
            items: full.items,
            preview: enriched,
            packaging_options: packagingOptions,
            constructor_stems: stems
        });
    } catch (err) {
        console.error('adminBouquetTemplate getOne:', err.message);
        return res.status(500).json({ message: 'Помилка завантаження шаблону' });
    }
};

const getFormData = async (req, res) => {
    try {
        const packagingOptions = await constructorService.listPackagingOptions();
        const stems = await ProductModel.listConstructorStemsWithVariants();
        return res.status(200).json({
            packaging_options: packagingOptions,
            constructor_stems: stems
        });
    } catch (err) {
        console.error('adminBouquetTemplate getFormData:', err.message);
        return res.status(500).json({ message: 'Помилка завантаження даних форми' });
    }
};

const createForAdmin = async (req, res) => {
    try {
        const body = req.body || {};
        const items = bouquetTemplateService.parseItemsFromBody(body);
        if (items.length === 0) {
            return res.status(400).json({ message: 'Додай хоча б одну квітку до шаблону' });
        }

        const packagingId = body.packaging_product_id != null ? body.packaging_product_id : body.packaging;
        const calc = await constructorService.calcBouquet(items, packagingId);
        if (!calc.ok) {
            return res.status(400).json({ message: calc.message || 'Шаблон некоректний' });
        }

        const result = await BouquetTemplateModel.create(body, items);
        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Не вдалося створити шаблон' });
        }

        const full = await BouquetTemplateModel.findFullById(result.id);
        return res.status(201).json({ message: 'Шаблон створено', template: full.template, items: full.items });
    } catch (err) {
        console.error('adminBouquetTemplate create:', err.message);
        return res.status(500).json({ message: 'Помилка створення шаблону' });
    }
};

const updateForAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const body = req.body || {};
        const items = body.items !== undefined ? bouquetTemplateService.parseItemsFromBody(body) : undefined;

        if (items !== undefined && items.length === 0) {
            return res.status(400).json({ message: 'Додай хоча б одну квітку до шаблону' });
        }

        if (items !== undefined) {
            const packagingId =
                body.packaging_product_id != null ? body.packaging_product_id : body.packaging;
            const calc = await constructorService.calcBouquet(items, packagingId);
            if (!calc.ok) {
                return res.status(400).json({ message: calc.message || 'Шаблон некоректний' });
            }
        }

        const result = await BouquetTemplateModel.update(id, body, items);
        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Не вдалося оновити шаблон' });
        }

        const full = await BouquetTemplateModel.findFullById(id);
        return res.status(200).json({ message: 'Шаблон збережено', template: full.template, items: full.items });
    } catch (err) {
        console.error('adminBouquetTemplate update:', err.message);
        return res.status(500).json({ message: 'Помилка оновлення шаблону' });
    }
};

const setActiveForAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const isActive = req.body && (req.body.is_active === 1 || req.body.is_active === '1' || req.body.is_active === true);
        const result = await BouquetTemplateModel.setActive(id, isActive ? 1 : 0);
        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Помилка' });
        }
        return res.status(200).json({ message: isActive ? 'Шаблон увімкнено' : 'Шаблон вимкнено' });
    } catch (err) {
        console.error('adminBouquetTemplate setActive:', err.message);
        return res.status(500).json({ message: 'Помилка' });
    }
};

const deleteForAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const result = await BouquetTemplateModel.remove(id);
        if (!result.ok) {
            return res.status(400).json({ message: result.message || 'Не вдалося видалити' });
        }
        return res.status(200).json({ message: 'Шаблон видалено' });
    } catch (err) {
        console.error('adminBouquetTemplate delete:', err.message);
        return res.status(500).json({ message: 'Помилка видалення' });
    }
};

module.exports = {
    listForAdmin,
    getOneForAdmin,
    getFormData,
    createForAdmin,
    updateForAdmin,
    setActiveForAdmin,
    deleteForAdmin
};
