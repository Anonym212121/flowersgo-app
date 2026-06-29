const orderPriceService = require('../src/services/orderPriceService');

describe('orderPriceService', () => {
    test('roundMoney rounds to 2 decimals', () => {
        expect(orderPriceService.roundMoney(10.556)).toBe(10.56);
        expect(orderPriceService.roundMoney('12.1')).toBe(12.1);
    });

    test('resolveItemsPrices rejects empty list', async () => {
        const result = await orderPriceService.resolveItemsPrices([]);
        expect(result.ok).toBe(false);
    });
});
