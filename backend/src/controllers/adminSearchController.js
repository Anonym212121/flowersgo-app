const OrderModel = require('../models/Order');
const ProductModel = require('../models/Product');
const UserModel = require('../models/User');

const search = async (req, res) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (q.length < 2 && !/^\d+$/.test(q)) {
            return res.status(200).json({
                orders: [],
                products: [],
                users: []
            });
        }

        const [orders, products, users] = await Promise.all([
            OrderModel.searchForAdmin(q),
            ProductModel.searchForAdmin(q),
            UserModel.searchForAdmin(q)
        ]);

        return res.status(200).json({
            orders: orders || [],
            products: products || [],
            users: users || []
        });
    } catch (err) {
        console.error('adminSearch:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    search
};
