const OrderModel = require('../models/Order');

const orderCancelRefundService = require('../services/orderCancelRefundService');

const courierAssignService = require('../services/courierAssignService');

const orderRoleNotifyService = require('../services/orderRoleNotifyService');
const orderWarehouseNotifyService = require('../services/orderWarehouseNotifyService');

const formatDelivery = require('../utils/formatDelivery');

const orderDeliveryFields = require('../utils/orderDeliveryFields');



const listPendingForAdmin = async (req, res) => {

    try {

        const orders = (await OrderModel.listPendingForAdmin()).map(formatDelivery.withDeliveryDisplay);

        return res.status(200).json({ orders });

    } catch (err) {

        console.error('listPendingOrdersForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const listAwaitingPaymentForAdmin = async (req, res) => {

    try {

        const orders = (await OrderModel.listAwaitingPaymentForAdmin()).map(formatDelivery.withDeliveryDisplay);

        return res.status(200).json({ orders });

    } catch (err) {

        console.error('listAwaitingPaymentForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const approveForAdmin = async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isFinite(id) || id <= 0) {

            return res.status(400).json({ message: 'Невірний ідентифікатор замовлення' });

        }



        const result = await OrderModel.approveForAdmin(id);

        if (!result.ok) {

            if (result.code === 'no_stock') {

                return res.status(400).json({ message: 'Недостатньо товару на складі — оновіть залишки або відхиліть замовлення' });

            }

            if (result.code === 'not_paid') {

                return res.status(400).json({ message: 'Замовлення ще не оплачене — дочекайтеся оплати або відхиліть його' });

            }

            const pending = await OrderModel.getByIdForCancelAdmin(id);

            if (pending && pending.cancel_request_at) {

                return res.status(400).json({ message: 'Спочатку підтвердіть або відхиліть запит клієнта на скасування' });

            }

            return res.status(404).json({ message: 'Замовлення не знайдено або вже оброблене' });

        }



        try {

            await orderRoleNotifyService.onOrderApprovedForWarehouse(id);

        } catch (hookErr) {

            console.error('approveForAdmin hooks:', hookErr.message);

        }



        return res.status(200).json({ message: 'Замовлення відправлено на склад' });

    } catch (err) {

        console.error('approveOrderForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const rejectForAdmin = async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isFinite(id) || id <= 0) {

            return res.status(400).json({ message: 'Невірний ідентифікатор замовлення' });

        }



        const order = await OrderModel.getByIdForPayment(id);

        if (!order || Number(order.admin_approved) !== 0) {

            return res.status(404).json({ message: 'Замовлення не знайдено або вже оброблене' });

        }



        let refundMessage = '';

        if (order.payment_status === 'paid') {

            const refundResult = await orderCancelRefundService.tryRefundPaidOrder(order);

            refundMessage = refundResult.message || '';

            if (refundResult.refund_status === 'refunded') {

                await OrderModel.updatePaymentStatus(id, 'refunded');

            }

        }



        const ok = await OrderModel.rejectForAdmin(id);

        if (!ok) {

            return res.status(404).json({ message: 'Замовлення не знайдено або вже оброблене' });

        }

        try {
            await orderWarehouseNotifyService.notifyCustomerOrderRejected(id);
        } catch (notifyErr) {
            console.error('notifyCustomerOrderRejected:', notifyErr.message);
        }

        let message = 'Замовлення відхилено';

        if (refundMessage) {

            message += '. ' + refundMessage;

        }



        return res.status(200).json({ message: message });

    } catch (err) {

        console.error('rejectOrderForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const approveCancelForAdmin = async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isFinite(id) || id <= 0) {

            return res.status(400).json({ message: 'Невірне замовлення' });

        }



        const order = await OrderModel.getByIdForCancelAdmin(id);

        if (!order || !order.cancel_request_at) {

            return res.status(404).json({ message: 'Немає запиту на скасування' });

        }



        const courierId = order.courier_id ? Number(order.courier_id) : null;



        const refundResult = await orderCancelRefundService.tryRefundPaidOrder(order);

        const ok = await OrderModel.finishCancelAfterApprove(id, refundResult.refund_status);

        if (!ok) {

            return res.status(500).json({ message: 'Не вдалося скасувати замовлення' });

        }



        if (courierId) {

            try {

                await orderRoleNotifyService.onOrderCancelledForCourier(id, courierId);

            } catch (notifyErr) {

                console.error('onOrderCancelledForCourier:', notifyErr.message);

            }

        }

        try {
            await orderWarehouseNotifyService.notifyCustomerCancelApproved(id);
        } catch (notifyErr) {
            console.error('notifyCustomerCancelApproved:', notifyErr.message);
        }

        let message = 'Замовлення скасовано';

        if (refundResult.message) {

            message += '. ' + refundResult.message;

        }



        return res.status(200).json({ message: message });

    } catch (err) {

        console.error('approveCancelForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const rejectCancelForAdmin = async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isFinite(id) || id <= 0) {

            return res.status(400).json({ message: 'Невірне замовлення' });

        }



        const ok = await OrderModel.rejectCancelRequest(id);

        if (!ok) {

            return res.status(404).json({ message: 'Запит не знайдено' });

        }

        try {
            await orderWarehouseNotifyService.notifyCustomerCancelRejected(id);
        } catch (notifyErr) {
            console.error('notifyCustomerCancelRejected:', notifyErr.message);
        }

        return res.status(200).json({ message: 'Запит на скасування відхилено — замовлення залишається активним' });

    } catch (err) {

        console.error('rejectCancelForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const listAllForAdmin = async (req, res) => {

    try {

        const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';

        const search = typeof req.query.q === 'string' ? req.query.q : '';

        const orders = (await OrderModel.listForAdminAll({ filter, search })).map(formatDelivery.withDeliveryDisplay);

        return res.status(200).json({ orders });

    } catch (err) {

        console.error('listAllOrdersForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



const getDetailForAdmin = async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isFinite(id) || id <= 0) {

            return res.status(400).json({ message: 'Невірне замовлення' });

        }



        const data = await OrderModel.getDetailForAdmin(id);

        if (!data) {

            return res.status(404).json({ message: 'Замовлення не знайдено' });

        }



        data.order = formatDelivery.withDeliveryDisplay(data.order);
        data.order.delivery_place = orderDeliveryFields.formatDeliveryPlaceFromRow(data.order);
        data.order.recipient_note_display = orderDeliveryFields.recipientNoteFromRow(data.order);
        data.order.bouquet_note_display = orderDeliveryFields.bouquetNoteFromRow(data.order);

        return res.status(200).json(data);

    } catch (err) {

        console.error('getOrderDetailForAdmin:', err.message);

        return res.status(500).json({ message: 'помилка' });

    }

};



module.exports = {

    listPendingForAdmin,

    listAwaitingPaymentForAdmin,

    listAllForAdmin,

    getDetailForAdmin,

    approveForAdmin,

    rejectForAdmin,

    approveCancelForAdmin,

    rejectCancelForAdmin

};

