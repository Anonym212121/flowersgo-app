const extractDeliveryPlace = (deliveryAddress, deliveryMethod) => {
    if (deliveryMethod === 'pickup') {
        return 'Самовивіз';
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'string') {
        return '—';
    }

    const text = deliveryAddress.trim();
    const marker = 'Адреса доставки:';
    const idx = text.indexOf(marker);

    if (idx !== -1) {
        const place = text.slice(idx + marker.length).trim();
        return place || '—';
    }

    return text;
};

const extractDeliveryCityShort = (deliveryAddress, deliveryMethod) => {
    if (deliveryMethod === 'pickup') {
        return 'Самовивіз';
    }

    const place = extractDeliveryPlace(deliveryAddress, deliveryMethod);
    if (!place || place === '—') {
        return '—';
    }

    const firstLine = place.split('\n')[0].trim();
    const cityPart = firstLine.split(',')[0].trim();
    if (cityPart) {
        return cityPart;
    }

    return firstLine.slice(0, 48);
};

module.exports = extractDeliveryPlace;
module.exports.extractDeliveryCityShort = extractDeliveryCityShort;
