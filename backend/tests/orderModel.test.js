jest.mock('../src/config/db', () => ({
    execute: jest.fn(),
    getConnection: jest.fn()
}));

const OrderModel = require('../src/models/Order');

describe('OrderModel.normalizeItems', () => {
    test('лишає тільки коректні позиції', () => {
        const raw = [
            { product_id: 1, quantity: 2, unit_price: 100 },
            { product_id: 2, quantity: 1, unit_price: 50 }
        ];
        const result = OrderModel.normalizeItems(raw);
        expect(result).toEqual([
            { product_id: 1, quantity: 2, unit_price: 100, color_variant_id: null },
            { product_id: 2, quantity: 1, unit_price: 50, color_variant_id: null }
        ]);
    });

    test('відкидає позиції з невірним product_id', () => {
        const raw = [
            { product_id: 0, quantity: 2, unit_price: 100 },
            { product_id: -5, quantity: 1, unit_price: 50 },
            { product_id: 3, quantity: 1, unit_price: 70 }
        ];
        const result = OrderModel.normalizeItems(raw);
        expect(result).toEqual([{ product_id: 3, quantity: 1, unit_price: 70, color_variant_id: null }]);
    });

    test('відкидає позиції з кількістю менше або рівною нулю', () => {
        const raw = [
            { product_id: 4, quantity: 0, unit_price: 100 },
            { product_id: 5, quantity: -2, unit_price: 50 }
        ];
        const result = OrderModel.normalizeItems(raw);
        expect(result).toEqual([]);
    });

    test('повертає порожній масив якщо передали не масив', () => {
        const result = OrderModel.normalizeItems(null);
        expect(result).toEqual([]);
    });
});
