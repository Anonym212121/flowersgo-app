const extractDeliveryPlace = require('./extractDeliveryPlace');
const {
    extractCustomerEmail,
    extractRecipientNote,
    extractBouquetNote
} = require('./orderDeliveryLegacyParse');

const trimText = (raw, maxLen) => {
    if (typeof raw !== 'string') {
        return '';
    }
    const value = raw.trim();
    if (!value) {
        return '';
    }
    if (value.length <= maxLen) {
        return value;
    }
    return value.slice(0, maxLen);
};

const formatDeliveryPlaceFromRow = (row) => {
    if (!row) {
        return '—';
    }
    if (row.delivery_method === 'pickup') {
        return 'Самовивіз';
    }

    const street = trimText(row.delivery_street, 255);
    const house = trimText(row.delivery_house, 50);
    if (street && house) {
        let place = street + ', буд. ' + house;
        const apartment = trimText(row.delivery_apartment, 50);
        if (apartment) {
            place += ', кв./офіс ' + apartment;
        }
        return place;
    }

    return extractDeliveryPlace(row.delivery_address, row.delivery_method);
};

const customerNameFromRow = (row) => {
    const first = trimText(row.customer_first_name, 100);
    const last = trimText(row.customer_last_name, 100);
    const full = (first + ' ' + last).trim();
    if (full) {
        return full;
    }
    return '';
};

const customerEmailFromRow = (row) => {
    const direct = trimText(row.customer_email, 255);
    if (direct) {
        return direct;
    }
    return extractCustomerEmail(row.delivery_address);
};

const recipientNoteFromRow = (row) => {
    const direct = trimText(row.recipient_note, 500);
    if (direct) {
        return direct;
    }
    return extractRecipientNote(row.delivery_address);
};

const bouquetNoteFromRow = (row) => {
    const direct = trimText(row.bouquet_note, 2000);
    if (direct) {
        return direct;
    }
    return extractBouquetNote(row.delivery_address);
};

const buildDeliverySummary = (payload) => {
    const parts = [];
    const customerName = customerNameFromRow(payload);
    const customerPhone = trimText(payload.customer_phone, 20);
    const customerEmail = trimText(payload.customer_email, 255);

    if (customerName) {
        parts.push(customerName);
    }
    if (customerPhone) {
        parts.push('Тел: ' + customerPhone);
    }
    if (customerEmail) {
        parts.push('Email: ' + customerEmail);
    }

    const receiverName = trimText(payload.receiver_name, 200);
    const receiverPhone = trimText(payload.receiver_phone, 20);
    const customerLine = customerName;
    const receiverDiff =
        receiverName &&
        receiverPhone &&
        (receiverName !== customerLine || receiverPhone !== customerPhone);

    if (receiverDiff) {
        parts.push('');
        parts.push('Одержувач:');
        parts.push(receiverName);
        parts.push('Тел: ' + receiverPhone);
        const note = trimText(payload.recipient_note, 500);
        if (note) {
            parts.push(note);
        }
    }

    const place = formatDeliveryPlaceFromRow(payload);
    if (place && place !== '—') {
        parts.push('');
        parts.push('Адреса доставки:');
        parts.push(place);
    }

    const bouquetNote = trimText(payload.bouquet_note, 2000);
    if (bouquetNote) {
        parts.push('');
        parts.push(bouquetNote);
    }

    return parts.join('\n').trim();
};

const formatOrderDeliveryDisplay = (row) => {
    if (!row) {
        return '—';
    }

    const summary = typeof row.delivery_address === 'string' ? row.delivery_address.trim() : '';
    if (summary && !row.delivery_street && !row.customer_first_name) {
        return summary;
    }

    return buildDeliverySummary(row) || summary || '—';
};

const normalizeOrderDeliveryPayload = (payload) => {
    const body = payload || {};
    const delivery_method =
        typeof body.delivery_method === 'string' && body.delivery_method.trim() !== ''
            ? body.delivery_method.trim()
            : 'standard';

    return {
        customer_first_name: trimText(body.customer_first_name, 100) || null,
        customer_last_name: trimText(body.customer_last_name, 100) || null,
        customer_phone: trimText(body.customer_phone, 20) || null,
        customer_email: trimText(body.customer_email, 255) || null,
        delivery_street:
            delivery_method === 'pickup' ? null : trimText(body.delivery_street, 255) || null,
        delivery_house:
            delivery_method === 'pickup' ? null : trimText(body.delivery_house, 50) || null,
        delivery_apartment:
            delivery_method === 'pickup' ? null : trimText(body.delivery_apartment, 50) || null,
        recipient_note: trimText(body.recipient_note, 500) || null,
        bouquet_note: trimText(body.bouquet_note, 2000) || null,
        delivery_method,
        receiver_name: trimText(body.receiver_name, 200) || null,
        receiver_phone: trimText(body.receiver_phone, 20) || null
    };
};

module.exports = {
    formatDeliveryPlaceFromRow,
    customerNameFromRow,
    customerEmailFromRow,
    recipientNoteFromRow,
    bouquetNoteFromRow,
    buildDeliverySummary,
    formatOrderDeliveryDisplay,
    normalizeOrderDeliveryPayload
};
