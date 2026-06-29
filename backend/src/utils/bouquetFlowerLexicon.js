const flowerMap = {
    троянди: 'rose',
    'троянди кущові': 'spray rose',
    півонії: 'peony',
    тюльпани: 'tulip',
    хризантеми: 'chrysanthemum',
    гортензії: 'hydrangea',
    еустоми: 'lisianthus (eustoma)',
    гвоздики: 'carnation',
    альстромерії: 'alstroemeria',
    орхідеї: 'orchid',
    гіпсофіла: "baby's breath (gypsophila)",
    соняшник: 'sunflower',
    лілії: 'lily',
    gerbera: 'gerbera',
    гербери: 'gerbera'
};

const colorMap = {
    червоний: 'red',
    білий: 'white',
    рожевий: 'pink',
    жовтий: 'yellow',
    помаранчевий: 'orange',
    фіолетовий: 'purple',
    синій: 'blue',
    кремовий: 'cream',
    бордовий: 'burgundy',
    кораловий: 'coral',
    лиловий: 'lilac',
    лавандовий: 'lavender',
    малиновий: 'raspberry',
    персиковий: 'peach',
    золотий: 'golden yellow',
    'салатовий': 'light green',
    зелений: 'green',
    'мікс': 'mixed colors',
    мікс: 'mixed colors'
};

const packagingMap = {
    'стандарт (папір)': 'simple floral wrapping paper',
    'оформлення — крафт + стрічка': 'kraft paper wrap with satin ribbon',
    'оформлення — преміум коробка': 'premium rigid gift flower box'
};

const normalizeKey = (text) => {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
};

const flowerEnglishName = (categoryName, productName) => {
    const key = normalizeKey(categoryName);
    if (flowerMap[key]) {
        return flowerMap[key];
    }

    const name = String(productName || '').toLowerCase();
    if (name.indexOf('троян') !== -1) {
        return 'rose';
    }
    if (name.indexOf('тюльп') !== -1) {
        return 'tulip';
    }
    if (name.indexOf('хризант') !== -1) {
        return 'chrysanthemum';
    }
    if (name.indexOf('півон') !== -1) {
        return 'peony';
    }
    if (name.indexOf('лілі') !== -1) {
        return 'lily';
    }
    if (name.indexOf('гіпсоф') !== -1) {
        return "baby's breath (gypsophila)";
    }

    return String(categoryName || productName || 'flower').trim() || 'flower';
};

const colorEnglishName = (colorUk) => {
    const key = normalizeKey(colorUk);
    if (!key) {
        return '';
    }
    if (colorMap[key]) {
        return colorMap[key];
    }
    return key;
};

const packagingEnglish = (label) => {
    const key = normalizeKey(label);
    if (packagingMap[key]) {
        return packagingMap[key];
    }
    return String(label || 'floral wrapping').trim() || 'floral wrapping';
};

module.exports = {
    flowerEnglishName,
    colorEnglishName,
    packagingEnglish
};
