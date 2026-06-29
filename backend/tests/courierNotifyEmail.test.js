jest.mock('../src/config/db', () => ({
    execute: jest.fn(),
    getConnection: jest.fn()
}));

const UserModel = require('../src/models/User');

describe('resolveCourierNotifyEmail', () => {
    test('пріоритет робочого email', () => {
        const email = UserModel.resolveCourierNotifyEmail({
            email: 'personal@test.com',
            courier_work_email: 'work@shop.ua'
        });
        expect(email).toBe('work@shop.ua');
    });

    test('fallback на особистий', () => {
        const email = UserModel.resolveCourierNotifyEmail({
            email: 'personal@test.com',
            courier_work_email: ''
        });
        expect(email).toBe('personal@test.com');
    });

    test('порожньо без email', () => {
        const email = UserModel.resolveCourierNotifyEmail({});
        expect(email).toBe('');
    });
});
