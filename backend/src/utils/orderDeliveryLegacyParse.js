const extractRecipientNote = (deliveryAddress) => {
    if (!deliveryAddress || typeof deliveryAddress !== 'string') {
        return '';
    }

    const marker = 'Одержувач:';
    const idx = deliveryAddress.indexOf(marker);
    if (idx === -1) {
        return '';
    }

    let block = deliveryAddress.slice(idx + marker.length);
    const addrIdx = block.indexOf('Адреса доставки:');
    if (addrIdx !== -1) {
        block = block.slice(0, addrIdx);
    }

    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const noteLines = [];

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (i === 0) {
            continue;
        }
        if (line.startsWith('Тел:')) {
            continue;
        }
        noteLines.push(line);
    }

    return noteLines.join(' ').trim();
};

const extractCustomerEmail = (deliveryAddress) => {
    if (!deliveryAddress || typeof deliveryAddress !== 'string') {
        return '';
    }

    const lines = deliveryAddress.split('\n');
    for (const line of lines) {
        const text = line.trim();
        if (text.toLowerCase().startsWith('email:')) {
            return text.slice(6).trim();
        }
    }

    return '';
};

const extractBouquetNote = (deliveryAddress) => {
    if (!deliveryAddress || typeof deliveryAddress !== 'string') {
        return '';
    }

    const lines = deliveryAddress.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const text = lines[i].trim();
        if (text.indexOf('(конструктор):') !== -1) {
            return text;
        }
    }

    return '';
};

module.exports = {
    extractRecipientNote,
    extractCustomerEmail,
    extractBouquetNote
};
