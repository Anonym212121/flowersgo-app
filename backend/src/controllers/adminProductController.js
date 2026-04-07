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

module.exports = {
    listForAdmin
};
