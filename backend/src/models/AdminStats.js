const db = require('../config/db');

const REVENUE_BASE_WHERE = `
    payment_status IN ('paid', 'cod')
    AND admin_approved <> -1
`;

const getOverview = async () => {
    const [pendingOrdersRows] = await db.execute(
        'SELECT COUNT(*) AS c FROM orders WHERE admin_approved = 0 AND payment_status IN (\'paid\', \'cod\')'
    );
    const [awaitingPaymentRows] = await db.execute(
        `SELECT COUNT(*) AS c FROM orders
         WHERE admin_approved = 0
           AND payment_status = 'unpaid'
           AND (payment_deadline_at IS NULL OR payment_deadline_at > NOW())`
    );
    const [pendingReviewsRows] = await db.execute(
        'SELECT COUNT(*) AS c FROM reviews WHERE is_visible = 0'
    );
    const [lowStockRows] = await db.execute(
        'SELECT COUNT(*) AS c FROM products WHERE is_active = 1 AND stock_quantity <= 5'
    );
    const [todayRows] = await db.execute(
        `SELECT COALESCE(SUM(total_amount), 0) AS s
         FROM orders
         WHERE DATE(COALESCE(paid_at, createdAt)) = CURDATE()
           AND ${REVENUE_BASE_WHERE}`
    );
    const [weekRows] = await db.execute(
        `SELECT COALESCE(SUM(total_amount), 0) AS s
         FROM orders
         WHERE COALESCE(paid_at, createdAt) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
           AND ${REVENUE_BASE_WHERE}`
    );
    const [allOrdersRows] = await db.execute('SELECT COUNT(*) AS c FROM orders');
    const [activeProductsRows] = await db.execute(
        'SELECT COUNT(*) AS c FROM products WHERE is_active = 1'
    );
    const [cancelRequestsRows] = await db.execute(
        'SELECT COUNT(*) AS c FROM orders WHERE cancel_request_at IS NOT NULL'
    );
    const [unassignedCourierRows] = await db.execute(
        `SELECT COUNT(*) AS c FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         WHERE o.admin_approved = 1
           AND s.status_name IN ('processing', 'ready_for_pickup')
           AND o.courier_id IS NULL
           AND o.delivery_method <> 'pickup'`
    );
    const [lowStockList] = await db.execute(
        `SELECT id, name, stock_quantity
         FROM products
         WHERE is_active = 1 AND stock_quantity <= 5
         ORDER BY stock_quantity ASC, id DESC
         LIMIT 8`
    );

    return {
        pending_orders: Number(pendingOrdersRows[0].c) || 0,
        awaiting_payment: Number(awaitingPaymentRows[0].c) || 0,
        pending_reviews: Number(pendingReviewsRows[0].c) || 0,
        cancel_requests: Number(cancelRequestsRows[0].c) || 0,
        unassigned_courier: Number(unassignedCourierRows[0].c) || 0,
        low_stock_count: Number(lowStockRows[0].c) || 0,
        revenue_today: Number(todayRows[0].s) || 0,
        revenue_week: Number(weekRows[0].s) || 0,
        orders_total: Number(allOrdersRows[0].c) || 0,
        products_active: Number(activeProductsRows[0].c) || 0,
        low_stock_products: lowStockList || []
    };
};

const parseDateOnly = (text) => {
    const value = String(text || '').trim();
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const check = new Date(year, month - 1, day);
    if (
        check.getFullYear() !== year ||
        check.getMonth() !== month - 1 ||
        check.getDate() !== day
    ) {
        return null;
    }
    return value;
};

const parseMonth = (text) => {
    const value = String(text || '').trim();
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) {
        return null;
    }
    return { year, month, value };
};

const pad2 = (n) => String(n).padStart(2, '0');

const buildRevenuePeriod = ({ mode, date, month, dateFrom, dateTo }) => {
    const m = String(mode || '').trim();

    if (m === 'today') {
        const now = new Date();
        const day = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
        return {
            from: day + ' 00:00:00',
            toExclusive: null,
            useCurdate: true,
            label: 'Сьогодні'
        };
    }

    if (m === 'week') {
        return {
            from: null,
            toExclusive: null,
            useLastDays: 7,
            label: 'Останні 7 днів'
        };
    }

    if (m === 'day') {
        const day = parseDateOnly(date);
        if (!day) {
            throw new Error('Вкажіть коректну дату (РРРР-ММ-ДД)');
        }
        const parts = day.split('-');
        const label = `${parts[2]}.${parts[1]}.${parts[0]}`;
        return {
            from: day + ' 00:00:00',
            toExclusive: null,
            useDate: day,
            label: 'Дата ' + label
        };
    }

    if (m === 'month') {
        const parsed = parseMonth(month);
        if (!parsed) {
            throw new Error('Вкажіть коректний місяць (РРРР-ММ)');
        }
        let nextYear = parsed.year;
        let nextMonth = parsed.month + 1;
        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
        }
        const from = `${parsed.year}-${pad2(parsed.month)}-01 00:00:00`;
        const toExclusive = `${nextYear}-${pad2(nextMonth)}-01 00:00:00`;
        return {
            from,
            toExclusive,
            label: 'Місяць ' + pad2(parsed.month) + '.' + parsed.year
        };
    }

    if (m === 'range') {
        const fromDay = parseDateOnly(dateFrom);
        const toDay = parseDateOnly(dateTo);
        if (!fromDay || !toDay) {
            throw new Error('Вкажіть коректний початок і кінець періоду');
        }
        if (fromDay > toDay) {
            throw new Error('Дата початку не може бути пізніше за кінець');
        }
        const toParts = toDay.split('-');
        const toDate = new Date(Number(toParts[0]), Number(toParts[1]) - 1, Number(toParts[2]));
        toDate.setDate(toDate.getDate() + 1);
        const toExclusive =
            toDate.getFullYear() +
            '-' +
            pad2(toDate.getMonth() + 1) +
            '-' +
            pad2(toDate.getDate()) +
            ' 00:00:00';
        const fromLabel = fromDay.split('-').reverse().join('.');
        const toLabel = toDay.split('-').reverse().join('.');
        return {
            from: fromDay + ' 00:00:00',
            toExclusive,
            label: 'Період ' + fromLabel + ' — ' + toLabel
        };
    }

    throw new Error('Невірний тип періоду');
};

const getRevenue = async (params) => {
    const period = buildRevenuePeriod(params);

    let sql = `
        SELECT COALESCE(SUM(total_amount), 0) AS revenue,
               COUNT(*) AS orders_count
        FROM orders
        WHERE ${REVENUE_BASE_WHERE}
    `;
    const queryParams = [];

    if (period.useCurdate) {
        sql += ' AND DATE(COALESCE(paid_at, createdAt)) = CURDATE()';
    } else if (period.useLastDays) {
        sql += ' AND COALESCE(paid_at, createdAt) >= DATE_SUB(NOW(), INTERVAL ? DAY)';
        queryParams.push(period.useLastDays);
    } else if (period.useDate) {
        sql += ' AND DATE(COALESCE(paid_at, createdAt)) = ?';
        queryParams.push(period.useDate);
    } else {
        sql += ' AND COALESCE(paid_at, createdAt) >= ?';
        queryParams.push(period.from);
        if (period.toExclusive) {
            sql += ' AND COALESCE(paid_at, createdAt) < ?';
            queryParams.push(period.toExclusive);
        }
    }

    const [rows] = await db.execute(sql, queryParams);
    const row = rows && rows[0] ? rows[0] : { revenue: 0, orders_count: 0 };

    return {
        revenue: Number(row.revenue) || 0,
        orders_count: Number(row.orders_count) || 0,
        period_label: period.label,
        mode: String(params.mode || '').trim()
    };
};

module.exports = {
    getOverview,
    getRevenue
};
