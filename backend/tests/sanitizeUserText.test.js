const sanitizeUserText = require('../src/utils/sanitizeUserText');

describe('sanitizeUserText', () => {
    test('прибирає html-теги', () => {
        expect(sanitizeUserText('<script>alert(1)</script>гарний букет')).toBe('alert(1)гарний букет');
    });

    test('обрізає довгий текст', () => {
        const text = sanitizeUserText('abcde', 3);
        expect(text).toBe('abc');
    });

    test('порожнє значення дає порожній рядок', () => {
        expect(sanitizeUserText(null)).toBe('');
        expect(sanitizeUserText('   ')).toBe('');
    });
});
