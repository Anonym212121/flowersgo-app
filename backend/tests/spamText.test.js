const { looksLikeSpam, looksLikeAttack, hasProfanity } = require('../src/utils/spamText');

describe('looksLikeSpam', () => {
    test('пропускає звичайний відгук', () => {
        expect(looksLikeSpam('Дуже гарний букет, квіти свіжі, дякую!')).toBe(false);
    });

    test('пропускає порожній рядок', () => {
        expect(looksLikeSpam('')).toBe(false);
        expect(looksLikeSpam(null)).toBe(false);
    });

    test('відхиляє кілька посилань', () => {
        expect(looksLikeSpam('Дивіться https://spam.com і www.casino.test')).toBe(true);
    });

    test('пропускає одне посилання', () => {
        expect(looksLikeSpam('Фото тут https://example.com/photo.jpg')).toBe(false);
    });

    test('відхиляє довге повторення символів', () => {
        expect(looksLikeSpam('привіт aaaaaaaaaaaaaaa')).toBe(true);
    });

    test('відхиляє очевидні спам-слова і скорочувачі', () => {
        expect(looksLikeSpam('Buy viagra now')).toBe(true);
        expect(looksLikeSpam('click bit.ly/abc123')).toBe(true);
    });
});

describe('looksLikeAttack', () => {
    test('відхиляє javascript-посилання', () => {
        expect(looksLikeAttack('javascript:alert(1)')).toBe(true);
    });

    test('відхиляє sql-фрагмент', () => {
        expect(looksLikeAttack("union select password from users")).toBe(true);
    });

    test('пропускає звичайний текст', () => {
        expect(looksLikeAttack('Букет сподобався, дякую')).toBe(false);
    });
});

describe('hasProfanity', () => {
    test('ловить нецензурне слово', () => {
        expect(hasProfanity('це сука')).toBe(true);
        expect(hasProfanity('підар')).toBe(true);
        expect(hasProfanity('підарас')).toBe(true);
    });

    test('пропускає нормальний відгук', () => {
        expect(hasProfanity('Дуже гарний букет, квіти свіжі, дякую!')).toBe(false);
    });

    test('не чіпає Херсон і піон', () => {
        expect(hasProfanity('Доставка в Херсон, піон гарний')).toBe(false);
    });
});
