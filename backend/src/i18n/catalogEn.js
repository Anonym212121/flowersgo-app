const EXACT = {
    'Квіти': 'Flowers',
    'Букети': 'Bouquets',
    'Букети квітів': 'Flower bouquets',
    'Троянди': 'Roses',
    'Тюльпани': 'Tulips',
    'Хризантеми': 'Chrysanthemums',
    'Ромашки': 'Daisies',
    'Лілії': 'Lilies',
    'Півонії': 'Peonies',
    'Гортензії': 'Hydrangeas',
    'Еустома': 'Eustoma',
    'Гвоздики': 'Carnations',
    'Альстромерія': 'Alstroemeria',
    'Іриси': 'Irises',
    'Упаковка': 'Packaging',
    'Подарунки': 'Gifts',
    'Іграшки': 'Toys',
    'Листівки': 'Greeting cards',
    'Солодощі': 'Sweets',
    'Повітряні кульки': 'Balloons',
    'Плюшевий ведмедик 40 см': 'Plush bear 40 cm',
    'Плюшевий ведмедик': 'Plush bear'
};

const PARTS = [
    ['плюшевий ведмедик', 'plush bear'],
    ['букет квітів', 'flower bouquet'],
    ['букети квітів', 'flower bouquets'],
    ['монобукет', 'monobouquet'],
    ['композиція', 'arrangement'],
    ['коробка', 'box'],
    ['кошик', 'basket'],
    ['трояндами', 'roses'],
    ['трояндах', 'roses'],
    ['троянди', 'roses'],
    ['троянд', 'roses'],
    ['троянда', 'rose'],
    ['тюльпанами', 'tulips'],
    ['тюльпани', 'tulips'],
    ['тюльпанів', 'tulips'],
    ['тюльпан', 'tulip'],
    ['хризантемами', 'chrysanthemums'],
    ['хризантеми', 'chrysanthemums'],
    ['хризантем', 'chrysanthemums'],
    ['ромашками', 'daisies'],
    ['ромашки', 'daisies'],
    ['ліліями', 'lilies'],
    ['лілії', 'lilies'],
    ['півоніями', 'peonies'],
    ['півонії', 'peonies'],
    ['гортензіями', 'hydrangeas'],
    ['гортензії', 'hydrangeas'],
    ['еустомою', 'eustoma'],
    ['еустома', 'eustoma'],
    ['гвоздиками', 'carnations'],
    ['гвоздики', 'carnations'],
    ['альстромерією', 'alstroemeria'],
    ['альстромерія', 'alstroemeria'],
    ['ірисами', 'irises'],
    ['іриси', 'irises'],
    ['евкаліптом', 'eucalyptus'],
    ['евкаліпт', 'eucalyptus'],
    ['гіпсофілою', 'gypsophila'],
    ['гіпсофіла', 'gypsophila'],
    ['зеленню', 'greenery'],
    ['букет', 'bouquet'],
    ['квіти', 'flowers'],
    ['квітка', 'flower'],
    ['подарунок', 'gift'],
    ['іграшка', 'toy'],
    ['листівка', 'greeting card'],
    ['упаковка', 'packaging'],
    ['крафт', 'kraft'],
    ['стрічка', 'ribbon'],
    ['червоні', 'red'],
    ['червона', 'red'],
    ['білі', 'white'],
    ['біла', 'white'],
    ['рожеві', 'pink'],
    ['рожева', 'pink'],
    ['жовті', 'yellow'],
    ['жовта', 'yellow'],
    ['кремові', 'cream'],
    ['мікс', 'mix'],
    ['шт', 'pcs'],
    ['см', 'cm']
];

const translateName = (raw) => {
    const text = String(raw || '').trim();
    if (!text) {
        return '';
    }
    if (EXACT[text]) {
        return EXACT[text];
    }
    const lower = text.toLowerCase();
    const exactKeys = Object.keys(EXACT);
    let i = 0;
    while (i < exactKeys.length) {
        if (exactKeys[i].toLowerCase() === lower) {
            return EXACT[exactKeys[i]];
        }
        i += 1;
    }

    let out = text;
    let p = 0;
    while (p < PARTS.length) {
        const from = PARTS[p][0];
        const to = PARTS[p][1];
        const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        out = out.replace(re, to);
        p += 1;
    }
    return out;
};

const translateUnit = (unit, lang) => {
    const raw = String(unit || 'шт').trim();
    if (lang !== 'en') {
        return raw || 'шт';
    }
    const lower = raw.toLowerCase();
    if (lower === 'шт' || lower === 'штук' || lower === 'штука') {
        return 'pcs';
    }
    if (lower === 'гілка' || lower === 'гілки') {
        return 'stem';
    }
    return translateName(raw);
};

module.exports = {
    translateName,
    translateUnit
};
