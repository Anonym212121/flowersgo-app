const sanitizeUserText = require('../src/utils/sanitizeUserText');

describe('sanitizeUserText', () => {
    test('прибирає script разом із вмістом', () => {
        expect(sanitizeUserText('<script>alert(1)</script>гарний букет')).toBe('гарний букет');
    });

    test('прибирає html-теги', () => {
        expect(sanitizeUserText('<b>гарний букет</b>')).toBe('гарний букет');
    });

    test('не зʼїдає звичайний знак менше', () => {
        expect(sanitizeUserText('оцінка < 5')).toBe('оцінка < 5');
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
