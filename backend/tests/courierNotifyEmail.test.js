jest.mock('../src/config/db', () => ({
    execute: jest.fn(),
    getConnection: jest.fn()
}));

const UserModel = require('../src/models/User');

describe('resolveCourierNotifyEmail', () => {
    test('повертає email з реєстрації', () => {
        const email = UserModel.resolveCourierNotifyEmail({
            email: 'courier@shop.ua',
            courier_work_email: 'work@shop.ua'
        });
        expect(email).toBe('courier@shop.ua');
    });

    test('порожньо без email', () => {
        const email = UserModel.resolveCourierNotifyEmail({});
        expect(email).toBe('');
    });
});
