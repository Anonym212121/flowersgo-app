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

module.exports = {
    listForAdmin
};
