const ProductModel = require('../models/Product');

const ProductColorVariant = require('../models/ProductColorVariant');



const listProducts = async (req, res) => {

    try {

        const products = await ProductModel.listConstructorPartsForAdmin();

        return res.status(200).json({ products });

    } catch (err) {

        console.error('adminConstructor listProducts:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const listColors = async (req, res) => {

    try {

        const productId = Number(req.params.id);

        if (!Number.isFinite(productId) || productId <= 0) {

            return res.status(400).json({ message: 'Невірний id товару' });

        }



        const product = await ProductModel.findById(productId);

        if (!product || Number(product.is_constructor) !== 1) {

            return res.status(404).json({ message: 'Квітку для конструктора не знайдено' });

        }



        const colors = await ProductColorVariant.listByProductId(productId);

        return res.status(200).json({ product, colors });

    } catch (err) {

        console.error('adminConstructor listColors:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const createColor = async (req, res) => {

    try {

        const productId = Number(req.params.id);

        if (!Number.isFinite(productId) || productId <= 0) {

            return res.status(400).json({ message: 'Невірний id товару' });

        }



        const product = await ProductModel.findById(productId);

        if (!product || Number(product.is_constructor) !== 1) {

            return res.status(404).json({ message: 'Квітку для конструктора не знайдено' });

        }



        const variantId = await ProductColorVariant.create(productId, req.body || {});

        if (!variantId) {

            return res.status(400).json({ message: 'Вкажи назву кольору' });

        }



        const colors = await ProductColorVariant.listByProductId(productId);

        return res.status(201).json({ message: 'Колір додано', variant_id: variantId, colors });

    } catch (err) {

        console.error('adminConstructor createColor:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const updateColor = async (req, res) => {

    try {

        const variantId = Number(req.params.id);

        if (!Number.isFinite(variantId) || variantId <= 0) {

            return res.status(400).json({ message: 'Невірний id кольору' });

        }



        const current = await ProductColorVariant.findById(variantId);

        if (!current || Number(current.is_constructor) !== 1) {

            return res.status(404).json({ message: 'Колір не знайдено' });

        }



        const ok = await ProductColorVariant.updateById(variantId, req.body || {});

        if (!ok) {

            return res.status(400).json({ message: 'Не вдалося оновити колір' });

        }



        const colors = await ProductColorVariant.listByProductId(current.product_id);

        return res.status(200).json({ message: 'Колір оновлено', colors });

    } catch (err) {

        console.error('adminConstructor updateColor:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const deleteColor = async (req, res) => {

    try {

        const variantId = Number(req.params.id);

        if (!Number.isFinite(variantId) || variantId <= 0) {

            return res.status(400).json({ message: 'Невірний id кольору' });

        }



        const current = await ProductColorVariant.findById(variantId);

        if (!current || Number(current.is_constructor) !== 1) {

            return res.status(404).json({ message: 'Колір не знайдено' });

        }



        const ok = await ProductColorVariant.deleteById(variantId);

        if (!ok) {

            return res.status(400).json({ message: 'Не вдалося видалити колір' });

        }



        const colors = await ProductColorVariant.listByProductId(current.product_id);

        return res.status(200).json({ message: 'Колір видалено', colors });

    } catch (err) {

        console.error('adminConstructor deleteColor:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



module.exports = {

    listProducts,

    listColors,

    createColor,

    updateColor,

    deleteColor

};

