const ProductModel = require('../models/Product');

const SECTION_LIMIT = 8;

const sortCategories = (a, b) => {
    const oa = Number(a.sort_order || 0);
    const ob = Number(b.sort_order || 0);
    if (oa !== ob) {
        return oa - ob;
    }
    return Number(a.id) - Number(b.id);
};

const findCategoryByNames = (categories, names) => {
    if (!Array.isArray(categories) || !Array.isArray(names)) {
        return null;
    }
    for (let i = 0; i < names.length; i += 1) {
        const wanted = String(names[i] || '').trim().toLowerCase();
        if (!wanted) {
            continue;
        }
        const found = categories.find((item) => String(item.name || '').trim().toLowerCase() === wanted);
        if (found) {
            return found;
        }
    }
    return null;
};

const pickExtraHomeCategory = (categories, skipCategoryId) => {
    if (!Array.isArray(categories)) {
        return null;
    }

    const parents = categories
        .filter((item) => !item.parent_id && !Number(item.is_packaging))
        .sort(sortCategories);

    for (let i = 0; i < parents.length; i += 1) {
        const item = parents[i];
        if (skipCategoryId && Number(item.id) === Number(skipCategoryId)) {
            continue;
        }
        const name = String(item.name || '').trim().toLowerCase();
        if (name === 'упаковка') {
            continue;
        }
        return item;
    }

    if (!skipCategoryId) {
        return null;
    }

    const subs = categories
        .filter((item) => Number(item.parent_id) === Number(skipCategoryId))
        .sort(sortCategories);

    return subs[0] || null;
};

const collectProductIds = (list) => {
    if (!Array.isArray(list)) {
        return [];
    }
    return list.map((item) => item.id).filter((id) => id != null);
};

const loadHomeCatalogData = async (categories) => {
    const excludeIds = [];
    const homeSections = [];

    const hitProducts = await ProductModel.listHitProducts(SECTION_LIMIT);
    excludeIds.push(...collectProductIds(hitProducts));

    const discountProducts = await ProductModel.listDiscountProducts(SECTION_LIMIT, excludeIds);
    if (discountProducts.length > 0) {
        homeSections.push({
            key: 'discount',
            title: 'Товари на знижці',
            categoryId: null,
            products: discountProducts
        });
        excludeIds.push(...collectProductIds(discountProducts));
    }

    const flowersCategory = findCategoryByNames(categories, ['Квіти', 'Букети квітів']);
    if (flowersCategory) {
        const bouquetProducts = await ProductModel.listProductsForCategory(
            flowersCategory.id,
            SECTION_LIMIT,
            excludeIds
        );
        if (bouquetProducts.length > 0) {
            homeSections.push({
                key: 'bouquets',
                title: 'Букети квітів',
                categoryId: flowersCategory.id,
                products: bouquetProducts
            });
            excludeIds.push(...collectProductIds(bouquetProducts));
        }
    }

    const extraCategory = pickExtraHomeCategory(categories, flowersCategory ? flowersCategory.id : null);
    if (extraCategory) {
        const extraProducts = await ProductModel.listProductsForCategory(
            extraCategory.id,
            SECTION_LIMIT,
            excludeIds
        );
        if (extraProducts.length > 0) {
            homeSections.push({
                key: 'extra',
                title: extraCategory.name,
                categoryId: extraCategory.id,
                products: extraProducts
            });
            excludeIds.push(...collectProductIds(extraProducts));
        }
    }

    const products = await ProductModel.allProducts(null, '', excludeIds);

    return {
        hitProducts,
        homeSections,
        products
    };
};

module.exports = {
    loadHomeCatalogData
};
