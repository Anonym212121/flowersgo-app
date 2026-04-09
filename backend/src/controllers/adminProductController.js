const ProductModel = require('../models/Product');

const listForAdmin = async (req, res) => {
    try {
        const products = await ProductModel.allForAdmin();
        return res.status(200).json({ products });
    } catch (err) {
        console.error('listForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const getOneForAdmin = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Товар не знайдено' });
        }
        return res.status(200).json({ product });
    } catch (err) {
        console.error('getOneForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const createForAdmin = async (req, res) => {
    try {
        const insertedId = await ProductModel.create(req.body || {});
        if (!insertedId) {
            return res.status(400).json({ message: 'Невірні дані товару' });
        }

        const product = await ProductModel.findById(insertedId);
        return res.status(201).json({ message: 'Товар створено', product });
    } catch (err) {
        if (err && err.message) {
            return res.status(400).json({ message: err.message });
        }
        console.error('createForAdmin:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    listForAdmin,
    getOneForAdmin,
    createForAdmin
};
