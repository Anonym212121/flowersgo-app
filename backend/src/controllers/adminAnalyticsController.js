const AdminAnalytics = require('../models/AdminAnalytics');

const isBadPeriodError = (msg) => {
    return (
        msg.includes('Вкажіть') ||
        msg.includes('Невірний') ||
        msg.includes('не може')
    );
};

const getFilterOptions = async (req, res) => {
    try {
        const options = await AdminAnalytics.getFilterOptions();
        return res.status(200).json(options);
    } catch (err) {
        console.error('adminAnalytics getFilterOptions:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const getReport = async (req, res) => {
    try {
        const report = await AdminAnalytics.getReport({
            mode: req.query.mode,
            date: req.query.date,
            month: req.query.month,
            dateFrom: req.query.from,
            dateTo: req.query.to,
            payment: req.query.payment,
            delivery: req.query.delivery,
            status: req.query.status,
            category_id: req.query.category_id,
            product_type: req.query.product_type,
            limit: req.query.limit
        });
        return res.status(200).json({ report });
    } catch (err) {
        const msg = err && err.message ? err.message : 'помилка';
        if (isBadPeriodError(msg)) {
            return res.status(400).json({ message: msg });
        }
        console.error('adminAnalytics getReport:', msg);
        return res.status(500).json({ message: 'помилка' });
    }
};

const exportCsv = async (req, res) => {
    try {
        const rows = await AdminAnalytics.getExportRows({
            mode: req.query.mode,
            date: req.query.date,
            month: req.query.month,
            dateFrom: req.query.from,
            dateTo: req.query.to,
            payment: req.query.payment,
            delivery: req.query.delivery,
            status: req.query.status,
            category_id: req.query.category_id,
            product_type: req.query.product_type
        });

        const lines = ['Дата;Виручка;Замовлення'];
        for (const row of rows) {
            lines.push(
                row.day + ';' + row.revenue + ';' + row.orders_count
            );
        }

        const bom = '\uFEFF';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="flowersgo-stats.csv"'
        );
        return res.send(bom + lines.join('\n'));
    } catch (err) {
        const msg = err && err.message ? err.message : 'помилка';
        if (isBadPeriodError(msg)) {
            return res.status(400).json({ message: msg });
        }
        console.error('adminAnalytics exportCsv:', msg);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    getFilterOptions,
    getReport,
    exportCsv
};
