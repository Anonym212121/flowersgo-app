jest.mock('../src/config/db', () => ({
    execute: jest.fn()
}));

jest.mock('../src/services/emailService', () => ({
    sendEmail: jest.fn(async () => ({ ok: true }))
}));

jest.mock('../src/models/User', () => ({
    getUserid: jest.fn(async () => ({
        user_id: 5,
        email: 'user@test.com'
    })),
    updatePasswordHashById: jest.fn(async () => true)
}));

jest.mock('../src/models/PasswordEmailCode', () => ({
    createCode: jest.fn(async () => 11),
    consumeCode: jest.fn(async () => true),
    getActiveCode: jest.fn(async () => null),
    hashCode: jest.fn((code) => 'hash-' + code),
    decreaseAttempts: jest.fn(async () => true)
}));

const bcrypt = require('bcryptjs');
const emailService = require('../src/services/emailService');
const PasswordEmailCodeModel = require('../src/models/PasswordEmailCode');

const requestPasswordEmailCode = async (body, userId = 5) => {
    const cabinetController = require('../src/controllers/cabinetController');
    const req = {
        body,
        headers: {
            accept: 'application/json',
            'x-requested-with': 'XMLHttpRequest'
        }
    };
    const res = {
        locals: { currentUser: { user_id: userId } },
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
            return this;
        },
        redirect() {
            this.redirected = true;
        }
    };

    await cabinetController.requestPasswordEmailCode(req, res);
    return res;
};

describe('password email code flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('надсилає код на email після валідного пароля', async () => {
        const res = await requestPasswordEmailCode({
            new_password: 'secret1',
            new_password_confirm: 'secret1'
        });

        expect(res.statusCode).toBe(200);
        expect(res.payload.ok).toBe(true);
        expect(res.payload.ok_code).toBe('email_code_sent');
        expect(PasswordEmailCodeModel.createCode).toHaveBeenCalled();
        expect(emailService.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'user@test.com',
                subject: expect.stringContaining('пароля')
            })
        );
    });

    test('повертає помилку якщо паролі не збігаються', async () => {
        const res = await requestPasswordEmailCode({
            new_password: 'secret1',
            new_password_confirm: 'other1'
        });

        expect(res.statusCode).toBe(400);
        expect(res.payload.err_code).toBe('password_confirm_mismatch');
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    test('повертає помилку якщо SMTP не відправив лист', async () => {
        emailService.sendEmail.mockResolvedValueOnce({ ok: false, message: 'SMTP fail' });

        const res = await requestPasswordEmailCode({
            new_password: 'secret1',
            new_password_confirm: 'secret1'
        });

        expect(res.statusCode).toBe(400);
        expect(res.payload.err_code).toBe('email_not_sent');
        expect(PasswordEmailCodeModel.consumeCode).toHaveBeenCalledWith(11);
    });
});
