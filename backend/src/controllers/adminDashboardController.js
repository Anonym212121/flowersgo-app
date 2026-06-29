const AdminStatsModel = require('../models/AdminStats');

const getStats = async (req, res) => {
    try {
        const stats = await AdminStatsModel.getOverview();
        return res.status(200).json({ stats });
    } catch (err) {
        console.error('adminDashboard getStats:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const getRevenue = async (req, res) => {
    try {
        const revenue = await AdminStatsModel.getRevenue({
            mode: req.query.mode,
            date: req.query.date,
            month: req.query.month,
            dateFrom: req.query.from,
            dateTo: req.query.to
        });
        return res.status(200).json({ revenue });
    } catch (err) {
        const msg = err && err.message ? err.message : 'помилка';
        if (
            msg.includes('Вкажіть') ||
            msg.includes('Невірний') ||
            msg.includes('не може')
        ) {
            return res.status(400).json({ message: msg });
        }
        console.error('adminDashboard getRevenue:', msg);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    getStats,
    getRevenue
};
