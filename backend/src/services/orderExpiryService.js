const OrderModel = require('../models/Order');

const courierAssignService = require('./courierAssignService');
const orderWarehouseNotifyService = require('./orderWarehouseNotifyService');



let timer = null;

let assignTimer = null;



const cancelExpiredUnpaid = async () => {

    try {

        const result = await OrderModel.cancelExpiredUnpaidOrders();
        const ids = result && Array.isArray(result.ids) ? result.ids : [];

        for (let i = 0; i < ids.length; i++) {
            try {
                await orderWarehouseNotifyService.notifyCustomerOrderExpired(ids[i]);
            } catch (notifyErr) {
                console.error('notifyCustomerOrderExpired:', notifyErr.message);
            }
        }

    } catch (err) {

        console.error('orderExpiry:', err.message);

    }

};



const assignReadyCouriers = async () => {

    try {

        await courierAssignService.assignPendingReadyOrders();

    } catch (err) {

        console.error('courierAssignJob:', err.message);

    }

};



const startOrderExpiryJob = () => {

    if (process.env.NODE_ENV === 'test') {

        return;

    }

    if (timer) {

        return;

    }

    cancelExpiredUnpaid();

    assignReadyCouriers();

    timer = setInterval(cancelExpiredUnpaid, 60000);

    assignTimer = setInterval(assignReadyCouriers, 120000);

};



module.exports = {

    cancelExpiredUnpaid,

    assignReadyCouriers,

    startOrderExpiryJob

};


