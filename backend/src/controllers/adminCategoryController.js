const CategoryModel = require('../models/Category');

const listForAdmin = async (req, res) => {
    try {
        const categories = await CategoryModel.allCategories();
        return res.status(200).json({ categories });
    } catch (err) {
        console.error('listForAdmin categories:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const createForAdmin = async (req, res) => {
    try {
        const id = await CategoryModel.create(req.body || {});
        if (!id) {
            return res.status(400).json({ message: 'Невірні дані категорії' });
        }
        return res.status(201).json({ message: 'Категорію створено', id });
    } catch (err) {
        console.error('createCategoryForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const updateForAdmin = async (req, res) => {
    try {
        const ok = await CategoryModel.updateById(req.params.id, req.body || {});
        if (!ok) {
            return res.status(400).json({ message: 'Не вдалося оновити категорію' });
        }
        return res.status(200).json({ message: 'Категорію оновлено' });
    } catch (err) {
        console.error('updateCategoryForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const deleteForAdmin = async (req, res) => {
    try {
        const ok = await CategoryModel.deleteById(req.params.id);
        if (!ok) {
            return res.status(400).json({
                message: 'Не можна видалити: є підкатегорії або товари'
            });
        }
        return res.status(200).json({ message: 'Категорію видалено' });
    } catch (err) {
        console.error('deleteCategoryForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const moveForAdmin = async (req, res) => {
    try {
        const direction = req.body && req.body.direction ? String(req.body.direction) : '';
        const ok = await CategoryModel.moveSort(req.params.id, direction);
        if (!ok) {
            return res.status(400).json({ message: 'Не вдалося змінити порядок' });
        }
        return res.status(200).json({ message: 'Порядок оновлено' });
    } catch (err) {
        console.error('moveCategoryForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    listForAdmin,
    createForAdmin,
    updateForAdmin,
    deleteForAdmin,
    moveForAdmin
};
