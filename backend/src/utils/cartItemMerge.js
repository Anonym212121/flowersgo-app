const mergeCartItems = (rawItems) => {
    const map = {};
    const list = Array.isArray(rawItems) ? rawItems : [];

    for (let i = 0; i < list.length; i += 1) {
        const row = list[i];
        const product_id = Number(row && row.product_id);
        const quantity = Math.floor(Number(row && row.quantity));

        if (!Number.isFinite(product_id) || product_id <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
            continue;
        }

        let color_variant_id = null;
        if (row.color_variant_id != null && row.color_variant_id !== '') {
            const vid = Number(row.color_variant_id);
            if (Number.isFinite(vid) && vid > 0) {
                color_variant_id = vid;
            }
        }

        const key = product_id + ':' + (color_variant_id || '');
        if (!map[key]) {
            map[key] = {
                product_id,
                color_variant_id,
                quantity: 0
            };
        }
        map[key].quantity += quantity;
    }

    return Object.values(map);
};

module.exports = {
    mergeCartItems
};
