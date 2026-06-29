const DeliverySettingsModel = require('../models/DeliverySettings');
const deliveryService = require('../services/deliveryService');

const getSettings = async (req, res) => {
    try {
        const row = await DeliverySettingsModel.get();
        const settings = deliveryService.buildConfig(row);
        return res.status(200).json({ settings });
    } catch (err) {
        console.error('adminDelivery get:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const saveSettings = async (req, res) => {
    try {
        const body = req.body || {};
        const ok = await DeliverySettingsModel.save(body);
        if (!ok) {
            return res.status(400).json({ message: 'Невірні налаштування доставки' });
        }

        const row = await DeliverySettingsModel.get();
        const settings = deliveryService.buildConfig(row);
        return res.status(200).json({ message: 'Налаштування збережено', settings });
    } catch (err) {
        console.error('adminDelivery save:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

module.exports = {
    getSettings,
    saveSettings
};
