const OrderModel = require('../models/Order');
const StatusModel = require('../models/Status');
const UserModel = require('../models/User');
const OrderStatusLogModel = require('../models/OrderStatusLog');
const orderWarehouseNotifyService = require('../services/orderWarehouseNotifyService');
const orderRoleNotifyService = require('../services/orderRoleNotifyService');
const courierAssignService = require('../services/courierAssignService');
const { mapOrderForWarehouse, buildWarehouseStats } = require('../utils/warehouseOrderView');
const { buildMapsLink } = require('../utils/mapsLink');

const renderLayout = (res, title, bodyPartial, extraLocals = {}) => {
    return res.status(200).render('layout', {
        title,
        bodyPartial,
        headerType: res.locals.headerType || 'guest',
        currentUser: res.locals.currentUser || null,
        navPath: res.locals.navPath || '/',
        ...extraLocals
    });
};

const getUserId = (res) => {
    const raw = res.locals.currentUser && res.locals.currentUser.user_id;
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
        return null;
    }
    return userId;
};

const buildCourierRedirect = (req, body, suffix) => {
    const returnTo = typeof body.return_to === 'string' ? body.return_to.trim() : '';
    if (returnTo === 'detail') {
        const orderId = Number(req.params.id);
        return '/courier/orders/' + orderId + suffix;
    }

    const parts = [];
    const day = typeof body.return_day === 'string' ? body.return_day.trim() : '';
    const status = typeof body.return_status === 'string' ? body.return_status.trim() : '';
    const view = typeof body.return_view === 'string' ? body.return_view.trim() : '';
    if (day) {
        parts.push('day=' + encodeURIComponent(day));
    }
    if (status) {
        parts.push('status=' + encodeURIComponent(status));
    }
    if (view) {
        parts.push('view=' + encodeURIComponent(view));
    }

    let url = '/courier/orders' + suffix;
    if (parts.length > 0) {
        url += (suffix.indexOf('?') === -1 ? '?' : '&') + parts.join('&');
    }
    return url;
};

const courierOrdersPage = async (req, res) => {
    try {
        const courierId = getUserId(res);
        if (!courierId) {
            return res.redirect('/login');
        }

        const onShift = await UserModel.getCourierShift(courierId);
        const day = typeof req.query.day === 'string' ? req.query.day.trim() : '';
        const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';
        const status_id = statusRaw !== '' ? Number(statusRaw) : null;
        const viewRaw = typeof req.query.view === 'string' ? req.query.view.trim() : 'active';
        const isHistory = viewRaw === 'history';
        const historyFilter = typeof req.query.history === 'string' ? req.query.history.trim() : 'done';

        let rawOrders;
        if (isHistory) {
            rawOrders = await OrderModel.listForCourierHistory({
                courier_id: courierId,
                day: day,
                history_filter: historyFilter
            });
        } else {
            rawOrders = await OrderModel.listForCourier({
                courier_id: courierId,
                day: day,
                status_id: status_id
            });
        }
        const orders = rawOrders.map((row) => mapOrderForWarehouse(row));

        const statsRows = await OrderModel.listForCourierStats(courierId);
        const courierStats = buildWarehouseStats(statsRows);

        let pollMaxOrderId = 0;
        for (let i = 0; i < orders.length; i += 1) {
            const id = Number(orders[i].id);
            if (Number.isFinite(id) && id > pollMaxOrderId) {
                pollMaxOrderId = id;
            }
        }

        const statuses = await StatusModel.listForCourier();
        const statusTransitions = await StatusModel.listTransitionsMap();

        const errCode = typeof req.query.err === 'string' ? req.query.err.trim() : '';
        const errorMap = {
            bad_status: 'Невірний статус',
            not_found: 'Замовлення не знайдено',
            status_unavailable: 'Статус недоступний',
            invalid_transition: 'Недопустимий перехід статусу',
            cancel_pending: 'Замовлення на скасуванні',
            waiting_warehouse: 'Замовлення ще комплектується на складі',
            need_shipped: 'Спочатку забери замовлення на складі — «В дорозі»',
            off_shift: 'Увімкни зміну, щоб працювати з доставками',
            update_failed: 'Не вдалося оновити статус',
            not_delivered: 'Спочатку відміть «Доставлено»',
            not_cod: 'Оплата не при отриманні',
            not_paid: 'Спочатку підтверди оплату замовника',
            cod_paid: 'Оплату зафіксовано',
            closed: 'Замовлення завершено',
            server: 'Помилка сервера'
        };

        let successMessage = '';
        if (req.query.ok === '1') {
            successMessage = 'Статус оновлено';
        } else if (req.query.ok === 'cod') {
            successMessage = errorMap.cod_paid;
        } else if (req.query.ok === 'closed') {
            successMessage = errorMap.closed;
        }

        return renderLayout(res, isHistory ? 'Історія доставок' : 'Мої доставки', 'pages/courier/orders', {
            orders,
            statuses,
            statusTransitions,
            courierStats,
            onShift,
            filterDay: day,
            filterStatus: statusRaw,
            listView: isHistory ? 'history' : 'active',
            historyFilter: historyFilter,
            successMessage: successMessage,
            errorMessage: errorMap[errCode] || '',
            pollListCount: orders.length,
            pollMaxOrderId: pollMaxOrderId
        });
    } catch (err) {
        console.error('courierOrdersPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const courierOrdersPoll = async (req, res) => {
    try {
        const courierId = getUserId(res);
        if (!courierId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const day = typeof req.query.day === 'string' ? req.query.day.trim() : '';
        const statsRows = await OrderModel.listForCourierStats(courierId);
        const courierStats = buildWarehouseStats(statsRows);

        const rawOrders = await OrderModel.listForCourier({
            courier_id: courierId,
            day: day,
            status_id: null
        });
        const orders = rawOrders.map((row) => mapOrderForWarehouse(row));

        let maxOrderId = 0;
        for (let i = 0; i < orders.length; i += 1) {
            const id = Number(orders[i].id);
            if (Number.isFinite(id) && id > maxOrderId) {
                maxOrderId = id;
            }
        }

        const onShift = await UserModel.getCourierShift(courierId);

        return res.json({
            stats: courierStats,
            list_count: orders.length,
            max_order_id: maxOrderId,
            on_shift: onShift ? 1 : 0
        });
    } catch (err) {
        console.error('courierOrdersPoll:', err.message);
        return res.status(500).json({ message: 'помилка' });
    }
};

const courierOrderDetailPage = async (req, res) => {
    try {
        const courierId = getUserId(res);
        if (!courierId) {
            return res.redirect('/login');
        }

        const orderId = Number(req.params.id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.status(404).send('Замовлення не знайдено');
        }

        const data = await OrderModel.getDetailForCourier(orderId, courierId);
        if (!data) {
            return res.status(404).send('Замовлення не знайдено');
        }

        const order = mapOrderForWarehouse(data.order);
        const statuses = await StatusModel.listForCourier();
        const statusTransitions = await StatusModel.listTransitionsMap();
        const onShift = await UserModel.getCourierShift(courierId);
        const mapsUrl = buildMapsLink(order.delivery_place_display || '');

        const errCode = typeof req.query.err === 'string' ? req.query.err.trim() : '';
        const errorMap = {
            bad_status: 'Невірний статус',
            status_unavailable: 'Статус недоступний',
            invalid_transition: 'Недопустимий перехід статусу',
            cancel_pending: 'Замовлення на скасуванні',
            waiting_warehouse: 'Замовлення ще комплектується на складі',
            need_shipped: 'Спочатку забери замовлення на складі — «В дорозі»',
            off_shift: 'Увімкни зміну',
            update_failed: 'Не вдалося оновити статус',
            not_delivered: 'Спочатку відміть «Доставлено»',
            not_cod: 'Оплата не при отриманні',
            not_paid: 'Спочатку підтверди оплату замовника',
            server: 'Помилка сервера'
        };

        let successMessage = '';
        if (req.query.ok === '1') {
            successMessage = 'Статус оновлено';
        } else if (req.query.ok === 'cod') {
            successMessage = 'Оплату зафіксовано';
        } else if (req.query.ok === 'closed') {
            successMessage = 'Замовлення завершено';
        }

        return renderLayout(res, 'Доставка №' + orderId, 'pages/courier/order-detail', {
            order,
            items: data.items || [],
            statuses,
            statusTransitions,
            onShift,
            mapsUrl,
            errorMessage: errorMap[errCode] || '',
            successMessage: successMessage
        });
    } catch (err) {
        console.error('courierOrderDetailPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const courierShiftPage = async (req, res) => {
    try {
        const courierId = getUserId(res);
        if (!courierId) {
            return res.redirect('/login');
        }

        const onShift = await UserModel.getCourierShift(courierId);
        const profile = await UserModel.getUserid(courierId);
        const statsRows = await OrderModel.listForCourierStats(courierId);
        const activeCount = statsRows.length;
        const notifyEmail = UserModel.resolveCourierNotifyEmail(profile);
        const canEndShift = !onShift || activeCount === 0;

        let successMessage = '';
        if (req.query.ok === '1') {
            const assignedRaw = Number(req.query.assigned);
            if (onShift && Number.isFinite(assignedRaw) && assignedRaw > 0) {
                successMessage = 'Зміну розпочато. Авто-призначено замовлень: ' + assignedRaw;
            } else if (onShift) {
                successMessage = 'Ти на зміні — нові доставки можуть призначатися автоматично';
            } else {
                successMessage = 'Зміну завершено';
            }
        }

        let errorMessage = '';
        if (req.query.err === 'server') {
            errorMessage = 'Помилка сервера';
        } else if (req.query.err === 'active_orders') {
            errorMessage = 'Спочатку заверши активні доставки — без цього зміну не можна закрити';
        }

        return renderLayout(res, 'Моя зміна', 'pages/courier/shift', {
            onShift,
            activeCount,
            canEndShift,
            personalEmail: profile && profile.email ? profile.email : '',
            workEmail: profile && profile.courier_work_email ? profile.courier_work_email : '',
            notifyEmail,
            successMessage,
            errorMessage
        });
    } catch (err) {
        console.error('courierShiftPage:', err.message);
        return res.status(500).send('помилка');
    }
};

const toggleShift = async (req, res) => {
    try {
        const courierId = getUserId(res);
        if (!courierId) {
            return res.redirect('/login');
        }

        const current = await UserModel.getCourierShift(courierId);
        const next = !current;

        if (current && !next) {
            const activeRows = await OrderModel.listForCourierStats(courierId);
            if (activeRows.length > 0) {
                return res.redirect('/courier/shift?err=active_orders');
            }
        }

        const ok = await UserModel.setCourierOnShift(courierId, next);
        if (!ok) {
            return res.redirect('/courier/shift?err=server');
        }

        if (next) {
            let assigned = 0;
            try {
                assigned = await courierAssignService.assignPendingReadyOrders();
            } catch (assignErr) {
                console.error('assignPendingReadyOrders:', assignErr.message);
            }
            let url = '/courier/shift?ok=1';
            if (assigned > 0) {
                url += '&assigned=' + assigned;
            }
            return res.redirect(url);
        }

        return res.redirect('/courier/shift?ok=1');
    } catch (err) {
        console.error('toggleShift:', err.message);
        return res.redirect('/courier/shift?err=server');
    }
};

const updateOrderStatusForCourier = async (req, res) => {
    try {
        const courierId = getUserId(res);
        if (!courierId) {
            return res.redirect('/login');
        }

        const onShift = await UserModel.getCourierShift(courierId);
        if (!onShift) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=off_shift'));
        }

        const orderId = Number(req.params.id);
        const statusId = Number(req.body.status_id);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=bad_order'));
        }
        if (!Number.isFinite(statusId) || statusId <= 0) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=bad_status'));
        }

        const allowedStatuses = await StatusModel.listForCourier();
        const currentOrder = await OrderModel.getByIdForCourier(orderId, courierId);
        if (!currentOrder) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=not_found'));
        }
        if (currentOrder.cancel_request_at) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=cancel_pending'));
        }

        if (currentOrder.status_name === 'processing') {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=waiting_warehouse'));
        }

        if (currentOrder.status_name === 'delivered' || currentOrder.status_name === 'accepted') {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=bad_status'));
        }

        const allowedStatusIds = allowedStatuses.map((row) => Number(row.id));
        if (!allowedStatusIds.includes(statusId)) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=status_unavailable'));
        }

        const transitionOk = await StatusModel.canTransition(currentOrder.status_id, statusId);
        if (!transitionOk) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=invalid_transition'));
        }

        let targetStatusName = currentOrder.status_name;
        for (const row of allowedStatuses) {
            if (Number(row.id) === statusId) {
                targetStatusName = row.status_name;
                break;
            }
        }
        if (
            currentOrder.status_name === 'ready_for_pickup' &&
            targetStatusName === 'delivered' &&
            currentOrder.delivery_method !== 'pickup'
        ) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=need_shipped'));
        }

        const ok = await OrderModel.updateStatusByCourier(orderId, statusId, Number(currentOrder.status_id));
        if (!ok) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=update_failed'));
        }

        const oldStatusId = Number(currentOrder.status_id);
        if (oldStatusId !== statusId) {
            try {
                await OrderStatusLogModel.insert({
                    order_id: orderId,
                    user_id: courierId,
                    from_status_id: oldStatusId,
                    to_status_id: statusId
                });
            } catch (logErr) {
                console.error('courier status log:', logErr.message);
            }
        }

        let newStatusName = currentOrder.status_name;
        for (const row of allowedStatuses) {
            if (Number(row.id) === statusId) {
                newStatusName = row.status_name;
                break;
            }
        }

        if (newStatusName !== currentOrder.status_name) {
            try {
                await orderWarehouseNotifyService.notifyCustomerOnStatus(orderId, newStatusName);
            } catch (notifyErr) {
                console.error('notifyCustomerOnStatus:', notifyErr.message);
            }
        }

        return res.redirect(buildCourierRedirect(req, req.body, '?ok=1'));
    } catch (err) {
        console.error('updateOrderStatusForCourier:', err.message);
        return res.redirect(buildCourierRedirect(req, req.body, '?err=server'));
    }
};

const confirmCodPayment = async (req, res) => {
    try {
        const courierId = getUserId(res);
        if (!courierId) {
            return res.redirect('/login');
        }

        const onShift = await UserModel.getCourierShift(courierId);
        if (!onShift) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=off_shift'));
        }

        const orderId = Number(req.params.id);
        const result = await OrderModel.confirmCodPaidByCourier(orderId, courierId);
        if (!result.ok) {
            const code = result.code || 'update_failed';
            return res.redirect(buildCourierRedirect(req, req.body, '?err=' + code));
        }

        return res.redirect(buildCourierRedirect(req, req.body, '?ok=cod'));
    } catch (err) {
        console.error('confirmCodPayment:', err.message);
        return res.redirect(buildCourierRedirect(req, req.body, '?err=server'));
    }
};

const closeOrder = async (req, res) => {
    try {
        const courierId = getUserId(res);
        if (!courierId) {
            return res.redirect('/login');
        }

        const onShift = await UserModel.getCourierShift(courierId);
        if (!onShift) {
            return res.redirect(buildCourierRedirect(req, req.body, '?err=off_shift'));
        }

        const orderId = Number(req.params.id);
        const result = await OrderModel.closeByCourier(orderId, courierId);
        if (!result.ok) {
            const code = result.code || 'update_failed';
            return res.redirect(buildCourierRedirect(req, req.body, '?err=' + code));
        }

        try {
            await OrderStatusLogModel.insert({
                order_id: orderId,
                user_id: courierId,
                from_status_id: result.from_status_id,
                to_status_id: result.to_status_id
            });
        } catch (logErr) {
            console.error('courier close log:', logErr.message);
        }

        try {
            await orderRoleNotifyService.onOrderClosed(orderId, courierId);
        } catch (notifyErr) {
            console.error('onOrderClosed:', notifyErr.message);
        }

        try {
            await orderWarehouseNotifyService.notifyCustomerOnStatus(orderId, 'accepted');
        } catch (notifyErr) {
            console.error('notifyCustomerOnStatus close:', notifyErr.message);
        }

        return res.redirect(buildCourierRedirect(req, req.body, '?ok=closed'));
    } catch (err) {
        console.error('closeOrder:', err.message);
        return res.redirect(buildCourierRedirect(req, req.body, '?err=server'));
    }
};

module.exports = {
    courierOrdersPage,
    courierOrdersPoll,
    courierOrderDetailPage,
    courierShiftPage,
    toggleShift,
    updateOrderStatusForCourier,
    confirmCodPayment,
    closeOrder
};
