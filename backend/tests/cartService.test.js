jest.mock('../src/models/Product', () => ({
    productsByIds: jest.fn()
}));

jest.mock('../src/models/ProductColorVariant', () => ({
    findById: jest.fn()
}));

const ProductModel = require('../src/models/Product');
const cartService = require('../src/services/cartService');

describe('cartService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('addToCart збільшує кількість існуючого товару', () => {
        const current = [{ product_id: 10, quantity: 2 }];
        const result = cartService.addToCart(current, 10, 3);
        expect(result).toEqual([{ product_id: 10, quantity: 5, color_variant_id: null }]);
    });

    test('updateCartItem видаляє товар якщо quantity <= 0', () => {
        const current = [
            { product_id: 10, quantity: 2 },
            { product_id: 11, quantity: 1 }
        ];
        const result = cartService.updateCartItem(current, 10, 0);
        expect(result).toEqual([{ product_id: 11, quantity: 1, color_variant_id: null }]);
    });

    test('normalizeCartItems обєднує дублікати та відкидає невалідні значення', () => {
        const raw = [
            { product_id: 5, quantity: 1 },
            { product_id: 5, quantity: 2 },
            { product_id: -1, quantity: 3 },
            { product_id: 7, quantity: 0 }
        ];
        const result = cartService.normalizeCartItems(raw);
        expect(result).toEqual([{ product_id: 5, quantity: 3, color_variant_id: null }]);
    });

    test('buildCartDetails рахує total і відкидає товари без залишку', async () => {
        ProductModel.productsByIds.mockResolvedValue([
            { id: 1, sale_price: 100, stock_quantity: 10, name: 'Rose' },
            { id: 2, sale_price: 80, stock_quantity: 0, name: 'Tulip' }
        ]);

        const result = await cartService.buildCartDetails([
            { product_id: 1, quantity: 2 },
            { product_id: 2, quantity: 3 }
        ]);

        expect(result.total).toBe(200);
        expect(result.lines).toHaveLength(1);
        expect(result.items).toEqual([{ product_id: 1, quantity: 2, unit_price: 100, color_variant_id: null }]);
    });
});
