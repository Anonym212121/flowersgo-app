const OrderModel = require('../models/Order');
const ProductModel = require('../models/Product');
const extractDeliveryPlace = require('../utils/extractDeliveryPlace');

const loadRecentDeliveryHighlight = async () => {
    const delivered = await OrderModel.findLastDeliveredHighlight();
    if (delivered && delivered.product_id) {
        const place = extractDeliveryPlace.extractDeliveryCityShort(
            delivered.delivery_address,
            delivered.delivery_method
        );
        return {
            title: 'Щойно доставили',
            product_id: delivered.product_id,
            product_name: delivered.product_name,
            product_slug: delivered.product_slug,
            image_url: delivered.image_url,
            place: place || '—',
            source: 'delivered'
        };
    }

    const latest = await ProductModel.findLatestCatalogProduct();
    if (!latest || !latest.product_id) {
        return null;
    }

    return {
        title: 'Новинка',
        product_id: latest.product_id,
        product_name: latest.product_name,
        product_slug: latest.product_slug,
        image_url: latest.image_url,
        place: 'У каталозі',
        source: 'new'
    };
};

module.exports = {
    loadRecentDeliveryHighlight
};
