const safeEqual = require('../src/utils/safeEqual');

describe('safeEqual', () => {
    test('однакові рядки збігаються', () => {
        expect(safeEqual('abc', 'abc')).toBe(true);
    });

    test('різні рядки не збігаються', () => {
        expect(safeEqual('abc', 'abd')).toBe(false);
    });

    test('різна довжина не збігається', () => {
        expect(safeEqual('abc', 'ab')).toBe(false);
    });

    test('порожні значення не збігаються', () => {
        expect(safeEqual('', '')).toBe(false);
        expect(safeEqual(null, 'a')).toBe(false);
    });
});
