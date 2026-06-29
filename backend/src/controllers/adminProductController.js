const ProductModel = require('../models/Product');



const listForAdmin = async (req, res) => {

    try {

        const products = await ProductModel.allForAdmin({

            status: req.query.status,

            category_id: req.query.category_id,

            type: req.query.type,

            stock: req.query.stock,

            q: req.query.q,

            sort: req.query.sort

        });

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



const updateForAdmin = async (req, res) => {

    try {

        const exists = await ProductModel.findById(req.params.id);

        if (!exists) {

            return res.status(404).json({ message: 'Товар не знайдено' });

        }



        const updated = await ProductModel.updateById(req.params.id, req.body || {});

        if (!updated) {

            return res.status(400).json({ message: 'Невірні дані товару' });

        }



        const product = await ProductModel.findById(req.params.id);

        return res.status(200).json({ message: 'Товар оновлено', product });

    } catch (err) {

        if (err && err.message) {

            return res.status(400).json({ message: err.message });

        }

        console.error('updateForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const deleteForAdmin = async (req, res) => {

    try {

        const exists = await ProductModel.findById(req.params.id);

        if (!exists) {

            return res.status(404).json({ message: 'Товар не знайдено' });

        }



        const ok = await ProductModel.deleteById(req.params.id);

        if (!ok) {

            return res.status(400).json({ message: 'Не вдалося видалити товар' });

        }



        return res.status(200).json({ message: 'Товар видалено або приховано' });

    } catch (err) {

        console.error('deleteForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const setActiveForAdmin = async (req, res) => {

    try {

        const exists = await ProductModel.findById(req.params.id);

        if (!exists) {

            return res.status(404).json({ message: 'Товар не знайдено' });

        }



        let is_active = 1;

        if (req.body && req.body.is_active !== undefined && req.body.is_active !== '') {

            is_active = Number(req.body.is_active) === 1 ? 1 : 0;

        } else {

            is_active = Number(exists.is_active) === 1 ? 0 : 1;

        }



        const ok = await ProductModel.setActiveById(req.params.id, is_active);

        if (!ok) {

            return res.status(400).json({ message: 'Не вдалося змінити статус' });

        }



        return res.status(200).json({

            message: is_active === 1 ? 'Товар активовано' : 'Товар приховано',

            is_active

        });

    } catch (err) {

        console.error('setActiveForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const updateStockForAdmin = async (req, res) => {

    try {

        const exists = await ProductModel.findById(req.params.id);

        if (!exists) {

            return res.status(404).json({ message: 'Товар не знайдено' });

        }



        if (Number(exists.is_constructor) === 1) {

            return res.status(400).json({

                message: 'Склад квітки конструктора змінюється у вкладці «Конструктор» → «Кольори»'

            });

        }



        const stock = Number(req.body && req.body.stock_quantity);

        const ok = await ProductModel.updateStockById(req.params.id, stock);

        if (!ok) {

            return res.status(400).json({ message: 'Невірна кількість на складі' });

        }



        return res.status(200).json({ message: 'Склад оновлено', stock_quantity: Math.floor(stock) });

    } catch (err) {

        console.error('updateStockForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const duplicateForAdmin = async (req, res) => {

    try {

        const exists = await ProductModel.findById(req.params.id);

        if (!exists) {

            return res.status(404).json({ message: 'Товар не знайдено' });

        }



        const newId = await ProductModel.duplicateById(req.params.id);

        if (!newId) {

            return res.status(400).json({ message: 'Не вдалося скопіювати товар' });

        }



        const product = await ProductModel.findById(newId);

        return res.status(201).json({ message: 'Копію товару створено (неактивна)', product });

    } catch (err) {

        console.error('duplicateForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const bulkForAdmin = async (req, res) => {

    try {

        const action = typeof req.body.action === 'string' ? req.body.action.trim() : '';

        const ids = Array.isArray(req.body.ids) ? req.body.ids : [];

        if (ids.length === 0) {

            return res.status(400).json({ message: 'Обери хоча б один товар' });

        }



        if (action === 'activate') {

            const count = await ProductModel.bulkSetActive(ids, 1);

            return res.status(200).json({ message: `Активовано: ${count}`, count });

        }



        if (action === 'deactivate' || action === 'archive') {

            const count = await ProductModel.bulkSetActive(ids, 0);

            return res.status(200).json({ message: `Приховано: ${count}`, count });

        }



        return res.status(400).json({ message: 'Невідома дія' });

    } catch (err) {

        console.error('bulkForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



module.exports = {

    listForAdmin,

    getOneForAdmin,

    createForAdmin,

    updateForAdmin,

    deleteForAdmin,

    setActiveForAdmin,

    updateStockForAdmin,

    duplicateForAdmin,

    bulkForAdmin

};

