const ReviewModel = require('../models/Review');

const listPendingForAdmin = async (req, res) => {
    try {
        const reviews = await ReviewModel.listPendingForAdmin();
        const requests = await ReviewModel.listChangeRequestsForAdmin();
        return res.status(200).json({ reviews, requests });
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

        const meta = await ReviewModel.findMetaById(id);
        if (!meta) {
            return res.status(404).json({ message: 'Відгук не знайдено' });
        }

        const ok = await ReviewModel.approveById(id);
        if (!ok) {
            return res.status(404).json({ message: 'Відгук не знайдено' });
        }

        await ReviewModel.syncAverageForProduct(meta.product_id);

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

        const meta = await ReviewModel.findMetaById(id);
        if (!meta) {
            return res.status(404).json({ message: 'Відгук не знайдено' });
        }

        const ok = await ReviewModel.deleteById(id);
        if (!ok) {
            return res.status(404).json({ message: 'Відгук не знайдено' });
        }

        if (Number(meta.is_visible) === 1) {
            await ReviewModel.syncAverageForProduct(meta.product_id);
        }

        return res.status(200).json({ message: 'Відгук видалено' });
    } catch (err) {
        console.error('deleteForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const approveEditRequest = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id || id <= 0) {
            return res.status(400).json({ message: 'Невірний запит' });
        }

        const ok = await ReviewModel.applyEditRequestById(id);
        if (!ok) {
            return res.status(404).json({ message: 'Запит не знайдено або вже оброблений' });
        }

        return res.status(200).json({ message: 'Відгук оновлено' });
    } catch (err) {
        console.error('approveEditRequest:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const approveDeleteRequest = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id || id <= 0) {
            return res.status(400).json({ message: 'Невірний запит' });
        }

        const ok = await ReviewModel.applyDeleteRequestById(id);
        if (!ok) {
            return res.status(404).json({ message: 'Запит не знайдено або вже оброблений' });
        }

        return res.status(200).json({ message: 'Відгук видалено' });
    } catch (err) {
        console.error('approveDeleteRequest:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const rejectChangeRequest = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id || id <= 0) {
            return res.status(400).json({ message: 'Невірний запит' });
        }

        const ok = await ReviewModel.rejectRequestById(id);
        if (!ok) {
            return res.status(404).json({ message: 'Запит не знайдено' });
        }

        return res.status(200).json({ message: 'Запит відхилено' });
    } catch (err) {
        console.error('rejectChangeRequest:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    listPendingForAdmin,
    approveForAdmin,
    deleteForAdmin,
    approveEditRequest,
    approveDeleteRequest,
    rejectChangeRequest
};
