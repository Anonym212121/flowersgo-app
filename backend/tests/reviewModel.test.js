jest.mock('../src/config/db', () => ({
    execute: jest.fn()
}));

const db = require('../src/config/db');
const ReviewModel = require('../src/models/Review');

describe('ReviewModel — мої відгуки в кабінеті', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('belongsToUser true якщо відгук цього користувача', async () => {
        db.execute.mockResolvedValue([[{ id: 7 }]]);

        const ok = await ReviewModel.belongsToUser(7, 2);
        expect(ok).toBe(true);
    });

    test('belongsToUser false для чужого відгуку', async () => {
        db.execute.mockResolvedValue([[]]);

        const ok = await ReviewModel.belongsToUser(7, 99);
        expect(ok).toBe(false);
    });

    test('createChangeRequest edit не пускає короткий текст', async () => {
        db.execute
            .mockResolvedValueOnce([[{ id: 1 }]])
            .mockResolvedValueOnce([[]]);

        const result = await ReviewModel.createChangeRequest({
            review_id: 1,
            user_id: 2,
            request_type: 'edit',
            new_rating: 5,
            new_comment: 'о'
        });

        expect(result).toBe(false);
    });

    test('createChangeRequest повертає pending якщо запит вже є', async () => {
        db.execute
            .mockResolvedValueOnce([[{ id: 1 }]])
            .mockResolvedValueOnce([[{ id: 55 }]]);

        const result = await ReviewModel.createChangeRequest({
            review_id: 1,
            user_id: 2,
            request_type: 'delete'
        });

        expect(result).toBe('pending');
    });

    test('createChangeRequest delete створює рядок в review_requests', async () => {
        db.execute
            .mockResolvedValueOnce([[{ id: 1 }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 12 }]);

        const result = await ReviewModel.createChangeRequest({
            review_id: 1,
            user_id: 2,
            request_type: 'delete'
        });

        expect(result).toBe(true);
        expect(db.execute).toHaveBeenCalledTimes(3);
    });

    test('countRecentByUser рахує відгуки користувача', async () => {
        db.execute.mockResolvedValue([[{ c: 2 }]]);

        const count = await ReviewModel.countRecentByUser(4, 10);
        expect(count).toBe(2);
        expect(db.execute).toHaveBeenCalledTimes(1);
    });

    test('create не пускає спам у коментарі', async () => {
        const ok = await ReviewModel.create({
            user_id: 2,
            product_id: 5,
            rating: 5,
            comment: 'Buy viagra https://a.com www.b.com'
        });

        expect(ok).toBe(false);
        expect(db.execute).not.toHaveBeenCalled();
    });
});
