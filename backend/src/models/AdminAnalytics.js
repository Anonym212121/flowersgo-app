const db = require('../config/db');
const { paymentStatusLabel } = require('../utils/paymentStatusLabel');

const pad2 = (n) => String(n).padStart(2, '0');
const orderDateExpr = 'COALESCE(o.paid_at, o.createdAt)';

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

const buildPeriod = ({ mode, date, month, dateFrom, dateTo }) => {
    const m = String(mode || 'month').trim();

    if (m === 'today') {
        return {
            from: null,
            toExclusive: null,
            useCurdate: true,
            useLastDays: null,
            useDate: null,
            label: 'Сьогодні'
        };
    }
    if (m === 'week') {
        return {
            from: null,
            toExclusive: null,
            useCurdate: false,
            useLastDays: 7,
            useDate: null,
            label: 'Останні 7 днів'
        };
    }
    if (m === 'last30') {
        return {
            from: null,
            toExclusive: null,
            useCurdate: false,
            useLastDays: 30,
            useDate: null,
            label: 'Останні 30 днів'
        };
    }
    if (m === 'last90') {
        return {
            from: null,
            toExclusive: null,
            useCurdate: false,
            useLastDays: 90,
            useDate: null,
            label: 'Останні 90 днів'
        };
    }
    if (m === 'day') {
        const day = parseDateOnly(date);
        if (!day) {
            throw new Error('Вкажіть коректну дату (РРРР-ММ-ДД)');
        }
        const parts = day.split('-');
        return {
            from: day + ' 00:00:00',
            toExclusive: null,
            useCurdate: false,
            useLastDays: null,
            useDate: day,
            label: 'Дата ' + parts[2] + '.' + parts[1] + '.' + parts[0]
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
        return {
            from: `${parsed.year}-${pad2(parsed.month)}-01 00:00:00`,
            toExclusive: `${nextYear}-${pad2(nextMonth)}-01 00:00:00`,
            useCurdate: false,
            useLastDays: null,
            useDate: null,
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
        return {
            from: fromDay + ' 00:00:00',
            toExclusive,
            useCurdate: false,
            useLastDays: null,
            useDate: null,
            label:
                'Період ' +
                fromDay.split('-').reverse().join('.') +
                ' — ' +
                toDay.split('-').reverse().join('.')
        };
    }

    throw new Error('Невірний тип періоду');
};

const appendPeriodSql = (sql, params, period) => {
    if (period.useCurdate) {
        return sql + ' AND DATE(' + orderDateExpr + ') = CURDATE()';
    }
    if (period.useLastDays) {
        params.push(period.useLastDays);
        return sql + ' AND ' + orderDateExpr + ' >= DATE_SUB(NOW(), INTERVAL ? DAY)';
    }
    if (period.useDate) {
        params.push(period.useDate);
        return sql + ' AND DATE(' + orderDateExpr + ') = ?';
    }
    params.push(period.from);
    let next = sql + ' AND ' + orderDateExpr + ' >= ?';
    if (period.toExclusive) {
        params.push(period.toExclusive);
        next += ' AND ' + orderDateExpr + ' < ?';
    }
    return next;
};

const buildComparePeriod = (period) => {
    if (period.useCurdate) {
        return { usePrevDay: true, label: 'Вчора' };
    }
    if (period.useLastDays) {
        return { usePrevDays: period.useLastDays, label: 'Попередні ' + period.useLastDays + ' днів' };
    }
    if (period.useDate) {
        const parts = period.useDate.split('-');
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() - 1);
        const prev =
            d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        return { useDate: prev, label: 'Попередній день' };
    }
    if (period.from && period.toExclusive) {
        const fromMs = new Date(String(period.from).replace(' ', 'T')).getTime();
        const toMs = new Date(String(period.toExclusive).replace(' ', 'T')).getTime();
        const len = toMs - fromMs;
        if (!Number.isFinite(len) || len <= 0) {
            return null;
        }
        return {
            from: new Date(fromMs - len).toISOString().slice(0, 19).replace('T', ' '),
            toExclusive: period.from,
            label: 'Попередній період'
        };
    }
    return null;
};

const appendComparePeriodSql = (sql, params, compare) => {
    if (!compare) {
        return sql + ' AND 1=0';
    }
    if (compare.usePrevDay) {
        return sql + ' AND DATE(' + orderDateExpr + ') = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
    }
    if (compare.usePrevDays) {
        params.push(compare.usePrevDays * 2);
        params.push(compare.usePrevDays);
        return (
            sql +
            ' AND ' +
            orderDateExpr +
            ' >= DATE_SUB(NOW(), INTERVAL ? DAY)' +
            ' AND ' +
            orderDateExpr +
            ' < DATE_SUB(NOW(), INTERVAL ? DAY)'
        );
    }
    if (compare.useDate) {
        params.push(compare.useDate);
        return sql + ' AND DATE(' + orderDateExpr + ') = ?';
    }
    params.push(compare.from);
    let next = sql + ' AND ' + orderDateExpr + ' >= ?';
    if (compare.toExclusive) {
        params.push(compare.toExclusive);
        next += ' AND ' + orderDateExpr + ' < ?';
    }
    return next;
};

const buildFilterClauses = (filters) => {
    const where = [];
    const params = [];

    const payment = String(filters.payment || 'revenue').trim();
    if (payment === 'paid') {
        where.push("o.payment_status = 'paid'");
        where.push('o.admin_approved <> -1');
    } else if (payment === 'cod') {
        where.push("o.payment_status = 'cod'");
        where.push('o.admin_approved <> -1');
    } else if (payment === 'unpaid') {
        where.push("o.payment_status = 'unpaid'");
    } else if (payment === 'all') {
        where.push('o.admin_approved <> -1');
    } else {
        where.push("o.payment_status IN ('paid', 'cod')");
        where.push('o.admin_approved <> -1');
    }

    const delivery = String(filters.delivery || 'all').trim();
    if (delivery === 'courier') {
        where.push("o.delivery_method <> 'pickup'");
    } else if (delivery === 'pickup') {
        where.push("o.delivery_method = 'pickup'");
    }

    const status = String(filters.status || '').trim();
    if (status) {
        where.push('s.status_name = ?');
        params.push(status);
    }

    const categoryId = Number(filters.category_id);
    if (Number.isFinite(categoryId) && categoryId > 0) {
        where.push(
            `EXISTS (
                SELECT 1 FROM order_items oi
                INNER JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = o.id AND p.category_id = ?
            )`
        );
        params.push(categoryId);
    }

    const productType = String(filters.product_type || 'all').trim();
    if (productType === 'catalog') {
        where.push(
            `EXISTS (
                SELECT 1 FROM order_items oi
                INNER JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = o.id AND IFNULL(p.is_constructor, 0) = 0
            )`
        );
    } else if (productType === 'constructor') {
        where.push(
            `EXISTS (
                SELECT 1 FROM order_items oi
                INNER JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = o.id AND IFNULL(p.is_constructor, 0) = 1
            )`
        );
    }

    return {
        whereSql: where.length ? ' AND ' + where.join(' AND ') : '',
        params,
        meta: {
            payment,
            delivery,
            status,
            category_id: Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null,
            product_type: productType
        }
    };
};

const pctChange = (current, previous) => {
    const cur = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (prev === 0) {
        return cur > 0 ? 100 : 0;
    }
    return Math.round(((cur - prev) / prev) * 1000) / 10;
};

const baseFrom = () => {
    return ' FROM orders o INNER JOIN statuses s ON o.status_id = s.id WHERE 1=1';
};

const runOrderAgg = async (selectSql, period, filterClauses, compare) => {
    let sql = selectSql + baseFrom() + filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    const [rows] = await db.execute(sql, params);
    const row = rows && rows[0] ? rows[0] : {};

    let compareRow = null;
    if (compare) {
        let csql = selectSql + baseFrom() + filterClauses.whereSql;
        const cparams = filterClauses.params.slice();
        csql = appendComparePeriodSql(csql, cparams, compare);
        const [crows] = await db.execute(csql, cparams);
        compareRow = crows && crows[0] ? crows[0] : {};
    }

    return { row, compareRow };
};

const buildCancelFilterClauses = (filters) => {
    return buildFilterClauses(Object.assign({}, filters, { payment: 'all' }));
};

const fetchSummary = async (period, filterClauses, compare) => {
    const { row, compareRow } = await runOrderAgg(
        `SELECT COALESCE(SUM(o.total_amount), 0) AS revenue,
                COUNT(*) AS orders_count,
                COALESCE(AVG(o.total_amount), 0) AS avg_order`,
        period,
        filterClauses,
        compare
    );

    const cancelClauses = buildCancelFilterClauses(filterClauses.meta || {});

    let cancelSql =
        `SELECT COUNT(*) AS c` +
        baseFrom() +
        " AND s.status_name = 'cancelled'" +
        cancelClauses.whereSql;
    const cancelParams = cancelClauses.params.slice();
    cancelSql = appendPeriodSql(cancelSql, cancelParams, period);
    const [cancelRows] = await db.execute(cancelSql, cancelParams);
    const cancelled = Number(cancelRows[0].c) || 0;

    const revenue = Number(row.revenue) || 0;
    const ordersCount = Number(row.orders_count) || 0;
    const avgOrder = Math.round(Number(row.avg_order) || 0);
    const prevRevenue = compareRow ? Number(compareRow.revenue) || 0 : 0;
    const prevOrders = compareRow ? Number(compareRow.orders_count) || 0 : 0;

    return {
        revenue,
        orders_count: ordersCount,
        avg_order: avgOrder,
        cancelled_count: cancelled,
        cancel_rate:
            ordersCount + cancelled > 0
                ? Math.round((cancelled / (ordersCount + cancelled)) * 1000) / 10
                : 0,
        compare: compare
            ? {
                  label: compare.label,
                  revenue: prevRevenue,
                  orders_count: prevOrders,
                  revenue_change_pct: pctChange(revenue, prevRevenue),
                  orders_change_pct: pctChange(ordersCount, prevOrders)
              }
            : null
    };
};

const fetchRevenueSeries = async (period, filterClauses) => {
    let sql =
        `SELECT DATE(` +
        orderDateExpr +
        `) AS day,
                COALESCE(SUM(o.total_amount), 0) AS revenue,
                COUNT(*) AS orders_count` +
        baseFrom() +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY DATE(' + orderDateExpr + ') ORDER BY day ASC';
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        day: r.day ? String(r.day).slice(0, 10) : '',
        revenue: Number(r.revenue) || 0,
        orders_count: Number(r.orders_count) || 0
    }));
};

const fetchTopProducts = async (period, filterClauses, limit) => {
    const lim = Math.min(Math.max(Number(limit) || 10, 1), 25);
    let sql =
        `SELECT p.id, p.name,
                SUM(oi.quantity) AS qty,
                SUM(oi.quantity * oi.price_at_purchase) AS revenue,
                IFNULL(p.is_constructor, 0) AS is_constructor
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         INNER JOIN statuses s ON o.status_id = s.id
         INNER JOIN products p ON p.id = oi.product_id
         WHERE 1=1` +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY p.id, p.name, p.is_constructor ORDER BY revenue DESC LIMIT ' + lim;
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        id: Number(r.id),
        name: r.name,
        qty: Number(r.qty) || 0,
        revenue: Number(r.revenue) || 0,
        is_constructor: Number(r.is_constructor) === 1
    }));
};

const fetchTopCategories = async (period, filterClauses, limit) => {
    const lim = Math.min(Math.max(Number(limit) || 8, 1), 20);
    let sql =
        `SELECT c.id, c.name,
                SUM(oi.quantity * oi.price_at_purchase) AS revenue,
                SUM(oi.quantity) AS qty
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         INNER JOIN statuses s ON o.status_id = s.id
         INNER JOIN products p ON p.id = oi.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE 1=1` +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT ' + lim;
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        id: r.id != null ? Number(r.id) : null,
        name: r.name || 'Без категорії',
        revenue: Number(r.revenue) || 0,
        qty: Number(r.qty) || 0
    }));
};

const fetchPaymentSplit = async (period, filterClauses) => {
    let cleanWhere = filterClauses.whereSql;
    cleanWhere = cleanWhere.replace(/ AND o\.payment_status IN \('paid', 'cod'\)/g, '');
    cleanWhere = cleanWhere.replace(/ AND o\.payment_status = 'paid'/g, '');
    cleanWhere = cleanWhere.replace(/ AND o\.payment_status = 'cod'/g, '');
    cleanWhere = cleanWhere.replace(/ AND o\.payment_status = 'unpaid'/g, '');
    cleanWhere = cleanWhere.replace(/ AND o\.admin_approved <> -1/g, '');

    let sql =
        `SELECT o.payment_status AS key_name, COUNT(*) AS cnt,
                COALESCE(SUM(o.total_amount), 0) AS revenue` +
        baseFrom() +
        ' AND o.admin_approved <> -1' +
        cleanWhere;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY o.payment_status ORDER BY revenue DESC';
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        key: r.key_name,
        label: paymentStatusLabel(r.key_name),
        count: Number(r.cnt) || 0,
        revenue: Number(r.revenue) || 0
    }));
};

const deliveryMethodLabel = (key) => {
    const k = String(key || '').trim();
    const labels = {
        standard: 'Стандартна доставка',
        exact: 'Точний час',
        express: 'Експрес-доставка',
        pickup: 'Самовивіз'
    };
    if (!k) {
        return 'Не вказано';
    }
    return labels[k] || k;
};

const fetchDeliverySplit = async (period, filterClauses) => {
    let sql =
        `SELECT COALESCE(NULLIF(TRIM(o.delivery_method), ''), '__none__') AS key_name,
                COUNT(*) AS cnt,
                COALESCE(SUM(o.total_amount), 0) AS revenue` +
        baseFrom() +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY COALESCE(NULLIF(TRIM(o.delivery_method), \'\'), \'__none__\') ORDER BY revenue DESC';
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => {
        const rawKey = String(r.key_name || '');
        const key = rawKey === '__none__' ? '' : rawKey;
        return {
            key,
            label: deliveryMethodLabel(key),
            count: Number(r.cnt) || 0,
            revenue: Number(r.revenue) || 0
        };
    });
};

const fetchStatusFunnel = async (period, filterClauses) => {
    let sql =
        `SELECT s.status_name, s.label_uk, COUNT(*) AS cnt` +
        baseFrom() +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY s.status_name, s.label_uk ORDER BY cnt DESC';
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        status_name: r.status_name,
        label: r.label_uk || r.status_name,
        count: Number(r.cnt) || 0
    }));
};

const fetchOrdersByWeekday = async (period, filterClauses) => {
    let sql =
        `SELECT DAYOFWEEK(` +
        orderDateExpr +
        `) AS dow, COUNT(*) AS cnt` +
        baseFrom() +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY dow ORDER BY dow ASC';
    const [rows] = await db.execute(sql, params);
    const names = ['', 'Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return (rows || []).map((r) => ({
        weekday: names[Number(r.dow)] || String(r.dow),
        count: Number(r.cnt) || 0
    }));
};

const fetchOrdersByHour = async (period, filterClauses) => {
    let sql =
        `SELECT HOUR(o.createdAt) AS hr, COUNT(*) AS cnt` +
        baseFrom() +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY hr ORDER BY hr ASC';
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        hour: Number(r.hr),
        label: pad2(Number(r.hr)) + ':00',
        count: Number(r.cnt) || 0
    }));
};

const fetchProductTypeSplit = async (period, filterClauses) => {
    let sql =
        `SELECT IFNULL(p.is_constructor, 0) AS is_constructor,
                SUM(oi.quantity * oi.price_at_purchase) AS revenue,
                SUM(oi.quantity) AS qty
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         INNER JOIN statuses s ON o.status_id = s.id
         INNER JOIN products p ON p.id = oi.product_id
         WHERE 1=1` +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY IFNULL(p.is_constructor, 0)';
    const [rows] = await db.execute(sql, params);
    const bucket = {
        catalog: { key: 'catalog', label: 'Каталог', revenue: 0, qty: 0 },
        constructor: { key: 'constructor', label: 'Конструктор', revenue: 0, qty: 0 }
    };
    for (const r of rows || []) {
        const key = Number(r.is_constructor) === 1 ? 'constructor' : 'catalog';
        bucket[key].revenue += Number(r.revenue) || 0;
        bucket[key].qty += Number(r.qty) || 0;
    }
    return [bucket.catalog, bucket.constructor];
};

const fetchTopCustomers = async (period, filterClauses, limit) => {
    const lim = Math.min(Math.max(Number(limit) || 8, 1), 20);
    let sql =
        `SELECT o.user_id,
                COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email, 'Гість') AS name,
                COUNT(*) AS orders_count,
                COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.user_id IS NOT NULL` +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY o.user_id, name ORDER BY revenue DESC LIMIT ' + lim;
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        user_id: Number(r.user_id),
        name: r.name,
        orders_count: Number(r.orders_count) || 0,
        revenue: Number(r.revenue) || 0
    }));
};

const fetchCustomerTypes = async (period, filterClauses) => {
    let sql =
        `SELECT o.user_id, COUNT(*) AS cnt` +
        baseFrom() +
        ' AND o.user_id IS NOT NULL' +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY o.user_id';
    const [rows] = await db.execute(sql, params);
    let returning = 0;
    let single = 0;
    for (const row of rows || []) {
        if (Number(row.cnt) > 1) {
            returning += 1;
        } else {
            single += 1;
        }
    }
    return {
        one_order_clients: single,
        repeat_clients: returning
    };
};

const fetchReviewsSummary = async (period) => {
    let sql =
        `SELECT COUNT(*) AS cnt, COALESCE(AVG(r.rating), 0) AS avg_rating
         FROM reviews r
         WHERE r.is_visible = 1 AND 1=1`;
    const params = [];
    if (period.useCurdate) {
        sql += ' AND DATE(r.createdAt) = CURDATE()';
    } else if (period.useLastDays) {
        params.push(period.useLastDays);
        sql += ' AND r.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)';
    } else if (period.useDate) {
        params.push(period.useDate);
        sql += ' AND DATE(r.createdAt) = ?';
    } else {
        params.push(period.from);
        sql += ' AND r.createdAt >= ?';
        if (period.toExclusive) {
            params.push(period.toExclusive);
            sql += ' AND r.createdAt < ?';
        }
    }
    const [rows] = await db.execute(sql, params);
    const row = rows && rows[0] ? rows[0] : {};
    return {
        count: Number(row.cnt) || 0,
        avg_rating: Math.round(Number(row.avg_rating) * 10) / 10
    };
};

const fetchCourierStats = async (period, filterClauses) => {
    let sql =
        `SELECT o.courier_id,
                COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email, 'Курʼєр') AS name,
                COUNT(*) AS orders_count
         FROM orders o
         INNER JOIN statuses s ON o.status_id = s.id
         LEFT JOIN users u ON u.id = o.courier_id
         WHERE o.courier_id IS NOT NULL` +
        filterClauses.whereSql;
    const params = filterClauses.params.slice();
    sql = appendPeriodSql(sql, params, period);
    sql += ' GROUP BY o.courier_id, name ORDER BY orders_count DESC LIMIT 10';
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        courier_id: Number(r.courier_id),
        name: r.name,
        orders_count: Number(r.orders_count) || 0
    }));
};

const fetchRegistrationsSeries = async (period) => {
    let sql =
        `SELECT DATE(u.createdAt) AS day, COUNT(*) AS cnt
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE r.role_name = 'user' AND 1=1`;
    const params = [];
    if (period.useCurdate) {
        sql += ' AND DATE(u.createdAt) = CURDATE()';
    } else if (period.useLastDays) {
        params.push(period.useLastDays);
        sql += ' AND u.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)';
    } else if (period.useDate) {
        params.push(period.useDate);
        sql += ' AND DATE(u.createdAt) = ?';
    } else {
        params.push(period.from);
        sql += ' AND u.createdAt >= ?';
        if (period.toExclusive) {
            params.push(period.toExclusive);
            sql += ' AND u.createdAt < ?';
        }
    }
    sql += ' GROUP BY DATE(u.createdAt) ORDER BY day ASC';
    const [rows] = await db.execute(sql, params);
    return (rows || []).map((r) => ({
        day: r.day ? String(r.day).slice(0, 10) : '',
        count: Number(r.cnt) || 0
    }));
};

const fetchFilterOptions = async () => {
    const [categories] = await db.execute(
        'SELECT id, name FROM categories ORDER BY name ASC'
    );
    const [statuses] = await db.execute(
        'SELECT status_name, label_uk FROM statuses ORDER BY sort_order ASC, id ASC'
    );
    return {
        categories: categories || [],
        statuses: (statuses || []).map((s) => ({
            value: s.status_name,
            label: s.label_uk || s.status_name
        }))
    };
};

const getReport = async (query) => {
    const period = buildPeriod(query);
    const compare = buildComparePeriod(period);
    const filterClauses = buildFilterClauses(query);

    const [
        summary,
        revenue_series,
        top_products,
        top_categories,
        payment_split,
        delivery_split,
        status_funnel,
        orders_by_weekday,
        orders_by_hour,
        product_type_split,
        top_customers,
        customer_types,
        reviews,
        couriers,
        registrations
    ] = await Promise.all([
        fetchSummary(period, filterClauses, compare),
        fetchRevenueSeries(period, filterClauses),
        fetchTopProducts(period, filterClauses, query.limit),
        fetchTopCategories(period, filterClauses, query.limit),
        fetchPaymentSplit(period, filterClauses),
        fetchDeliverySplit(period, filterClauses),
        fetchStatusFunnel(period, filterClauses),
        fetchOrdersByWeekday(period, filterClauses),
        fetchOrdersByHour(period, filterClauses),
        fetchProductTypeSplit(period, filterClauses),
        fetchTopCustomers(period, filterClauses, query.limit),
        fetchCustomerTypes(period, filterClauses),
        fetchReviewsSummary(period),
        fetchCourierStats(period, filterClauses),
        fetchRegistrationsSeries(period)
    ]);

    return {
        period_label: period.label,
        filters: {
            mode: String(query.mode || 'month'),
            payment: String(query.payment || 'revenue'),
            delivery: String(query.delivery || 'all'),
            status: String(query.status || ''),
            category_id: query.category_id || '',
            product_type: String(query.product_type || 'all')
        },
        summary,
        revenue_series,
        top_products,
        top_categories,
        payment_split,
        delivery_split,
        status_funnel,
        orders_by_weekday,
        orders_by_hour,
        product_type_split,
        top_customers,
        customer_types,
        reviews,
        couriers,
        registrations
    };
};

const getExportRows = async (query) => {
    const period = buildPeriod(query);
    const filterClauses = buildFilterClauses(query);
    return fetchRevenueSeries(period, filterClauses);
};

module.exports = {
    buildPeriod,
    getFilterOptions: fetchFilterOptions,
    getReport,
    getExportRows
};
