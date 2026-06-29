jest.mock('../src/config/db', () => ({
    execute: jest.fn(),
    getConnection: jest.fn()
}));

const orderStockService = require('../src/services/orderStockService');
const db = require('../src/config/db');

describe('orderStockService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('порожній кошик', async () => {
        const result = await orderStockService.validateItemsStock([]);
        expect(result.ok).toBe(false);
    });

    test('не вистачає товару', async () => {
        db.execute
            .mockResolvedValueOnce([[{ stock_quantity: 3, name: 'Троянда' }]])
            .mockResolvedValueOnce([[{ pending_qty: 2 }]]);

        const result = await orderStockService.validateItemsStock([
            { product_id: 1, quantity: 2, unit_price: 100 }
        ]);

        expect(result.ok).toBe(false);
        expect(result.message).toContain('Троянда');
    });

    test('товару достатньо', async () => {
        db.execute
            .mockResolvedValueOnce([[{ stock_quantity: 5, name: 'Троянда' }]])
            .mockResolvedValueOnce([[{ pending_qty: 1 }]]);

        const result = await orderStockService.validateItemsStock([
            { product_id: 1, quantity: 2, unit_price: 100 }
        ]);

        expect(result.ok).toBe(true);
    });
});
