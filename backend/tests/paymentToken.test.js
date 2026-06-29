const paymentToken = require('../src/utils/paymentToken');

describe('paymentToken — доступ до оплати', () => {
    test('токен створюється і проходить перевірку для замовлення', () => {
        const token = paymentToken.makeForOrder(15, 4);
        const info = paymentToken.verify(token, 15);

        expect(info).not.toBeNull();
        expect(info.orderId).toBe(15);
        expect(info.userId).toBe(4);
    });

    test('для гостя в токені userId = 0', () => {
        const token = paymentToken.makeForOrder(9, 0);
        const info = paymentToken.verify(token, 9);

        expect(info.userId).toBe(0);
    });

    test('не підходить токен від іншого замовлення', () => {
        const token = paymentToken.makeForOrder(3, 1);
        expect(paymentToken.verify(token, 4)).toBeNull();
    });

    test('токен з простроченим терміном не проходить', () => {
        const token = paymentToken.makeForOrder(5, 1);
        const parts = token.split('.');
        parts[2] = String(Date.now() - 1000);
        const broken = parts.join('.');
        expect(paymentToken.verify(broken, 5)).toBeNull();
    });
});
