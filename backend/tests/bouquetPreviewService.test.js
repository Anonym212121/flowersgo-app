const bouquetPreviewService = require('../src/services/bouquetPreviewService');
const lexicon = require('../src/utils/bouquetFlowerLexicon');

describe('bouquetPreviewService', () => {
    test('prompt бере кількість з lines після calc', () => {
        const result = bouquetPreviewService.buildPreviewForCalc({
            ok: true,
            stemTotal: 8,
            summary: 'Троянди (червоний) ×5, Тюльпани (білий) ×3',
            packaging: { label: 'Стандарт (папір)' },
            lines: [
                {
                    product_id: 1,
                    color_variant_id: 2,
                    quantity: 5,
                    category_name: 'Троянди',
                    name: 'Троянда — 1 шт',
                    flower_color: 'червоний'
                },
                {
                    product_id: 3,
                    quantity: 3,
                    category_name: 'Тюльпани',
                    name: 'Тюльпан — 1 шт',
                    flower_color: 'білий'
                }
            ]
        });

        expect(result.ok).toBe(true);
        expect(result.composition[0].quantity).toBe(5);
        expect(result.composition[1].quantity).toBe(3);
        expect(result.prompt).toContain('5× Троянди (червоний)');
        expect(result.prompt).toContain('5 red rose');
        expect(result.prompt).toContain('Total 8 stems');
        expect(result.preview_key).toMatch(/^[a-f0-9]{20}$/);
    });
});

describe('bouquetFlowerLexicon', () => {
    test('перекладає назви з каталогу', () => {
        expect(lexicon.flowerEnglishName('Хризантеми', '')).toBe('chrysanthemum');
        expect(lexicon.colorEnglishName('рожевий')).toBe('pink');
    });
});
