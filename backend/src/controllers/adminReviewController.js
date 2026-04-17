const ReviewModel = require('../models/Review');

const listPendingForAdmin = async (req, res) => {
    try {
        const reviews = await ReviewModel.listPendingForAdmin();
        return res.status(200).json({ reviews });
    } catch (err) {
        console.error('listPendingForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const approveForAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: 'Невірний ідентифікатор відгуку' });
        }

        const ok = await ReviewModel.approveById(id);
        if (!ok) {
            return res.status(404).json({ message: 'Відгук не знайдено' });
        }

        return res.status(200).json({ message: 'Відгук схвалено' });
    } catch (err) {
        console.error('approveForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const deleteForAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: 'Невірний ідентифікатор відгуку' });
        }

        const ok = await ReviewModel.deleteById(id);
        if (!ok) {
            return res.status(404).json({ message: 'Відгук не знайдено' });
        }

        return res.status(200).json({ message: 'Відгук видалено' });
    } catch (err) {
        console.error('deleteForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    listPendingForAdmin,
    approveForAdmin,
    deleteForAdmin
};
