(function () {
    const STATS_FILTER_KEY = 'flowersgo_admin_stats_filters';
    let chartMap = {};

    const defaultFilters = () => {
        const now = new Date();
        const month =
            now.getFullYear() +
            '-' +
            String(now.getMonth() + 1).padStart(2, '0');
        return {
            mode: 'month',
            month: month,
            date: '',
            from: '',
            to: '',
            payment: 'revenue',
            delivery: 'all',
            status: '',
            category_id: '',
            product_type: 'all'
        };
    };

    const readFilters = () => {
        try {
            const raw = localStorage.getItem(STATS_FILTER_KEY);
            if (!raw) {
                return defaultFilters();
            }
            return Object.assign(defaultFilters(), JSON.parse(raw) || {});
        } catch (err) {
            return defaultFilters();
        }
    };

    const saveFilters = (filters) => {
        try {
            localStorage.setItem(STATS_FILTER_KEY, JSON.stringify(filters));
        } catch (err) {
        }
    };

    const escapeHtml = (value) => {
        return String(value == null ? '' : value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    };

    const formatMoney = (n) => {
        return (Number(n) || 0).toLocaleString('uk-UA') + ' грн';
    };

    const formatDelta = (pct) => {
        const n = Number(pct);
        if (!Number.isFinite(n)) {
            return '';
        }
        const sign = n > 0 ? '+' : '';
        const cls =
            n > 0 ? 'admin-stats-delta--up' : n < 0 ? 'admin-stats-delta--down' : 'admin-stats-delta--flat';
        return (
            '<span class="admin-stats-delta ' +
            cls +
            '">' +
            sign +
            n +
            '%</span>'
        );
    };

    const paymentFilterLabel = (value) => {
        const map = {
            revenue: 'Оплачені (онлайн + при отриманні)',
            paid: 'Тільки онлайн-оплата',
            cod: 'Тільки при отриманні',
            unpaid: 'Не оплачені',
            all: 'Усі (крім відхилених)'
        };
        return map[value] || map.revenue;
    };

    const deliveryFilterLabel = (value) => {
        const map = {
            all: 'Усі способи доставки',
            courier: 'Адресна доставка',
            pickup: 'Самовивіз'
        };
        return map[value] || map.all;
    };

    const productTypeFilterLabel = (value) => {
        const map = {
            all: 'Усі товари',
            catalog: 'Лише каталог',
            constructor: 'Лише конструктор'
        };
        return map[value] || map.all;
    };

    const periodModeLabel = (value) => {
        const map = {
            today: 'Сьогодні',
            week: '7 днів',
            last30: '30 днів',
            last90: '90 днів',
            month: 'Місяць',
            day: 'Одна дата',
            range: 'Діапазон дат'
        };
        return map[value] || value;
    };

    const buildFilterSummary = (filters, options) => {
        const parts = ['Період: ' + periodModeLabel(filters.mode)];
        if (filters.mode === 'month' && filters.month) {
            parts.push('місяць ' + filters.month);
        }
        if (filters.mode === 'day' && filters.date) {
            parts.push('дата ' + filters.date);
        }
        if (filters.mode === 'range' && filters.from && filters.to) {
            parts.push('з ' + filters.from + ' по ' + filters.to);
        }
        parts.push('Оплата: ' + paymentFilterLabel(filters.payment));
        parts.push('Доставка: ' + deliveryFilterLabel(filters.delivery));
        parts.push('Товари: ' + productTypeFilterLabel(filters.product_type));
        if (filters.category_id) {
            const cat = (options.categories || []).find((c) => String(c.id) === String(filters.category_id));
            parts.push('Категорія: ' + (cat ? cat.name : filters.category_id));
        }
        if (filters.status) {
            const st = (options.statuses || []).find((s) => s.value === filters.status);
            parts.push('Статус: ' + (st ? st.label : filters.status));
        }
        return parts.join(' · ');
    };

    const chartTooltipBase = {
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        padding: 10
    };

    const applyTooltip = (options, kind) => {
        options.plugins = options.plugins || {};
        if (kind === 'money') {
            options.plugins.tooltip = {
                ...chartTooltipBase,
                callbacks: {
                    label: (item) => {
                        const name = item.dataset.label || item.label || 'Сума';
                        return name + ': ' + formatMoney(item.raw);
                    }
                }
            };
        } else if (kind === 'count') {
            options.plugins.tooltip = {
                ...chartTooltipBase,
                callbacks: {
                    label: (item) => {
                        const name = item.label || item.dataset.label || '';
                        return name + ': ' + item.raw + ' зам.';
                    }
                }
            };
        }
        return options;
    };

    const renderChartCard = (title, hint, canvasId, extraClass) => {
        return (
            '<div class="admin-stats-chart-card' +
            (extraClass ? ' ' + extraClass : '') +
            '">' +
            '<h4>' +
            escapeHtml(title) +
            '</h4>' +
            '<p class="admin-stats-chart-hint">' +
            escapeHtml(hint) +
            '</p>' +
            '<div class="admin-stats-chart-wrap' +
            (extraClass && extraClass.indexOf('tall') !== -1 ? ' admin-stats-chart-wrap--tall' : '') +
            '"><canvas id="' +
            canvasId +
            '"></canvas></div>' +
            '<p class="admin-stats-chart-foot" id="' +
            canvasId +
            'Foot" hidden></p>' +
            '</div>'
        );
    };

    const hasChartData = (rows, field) => {
        if (!rows || !rows.length) {
            return false;
        }
        return rows.some((r) => Number(r[field != null ? field : 'revenue']) > 0 || Number(r.count) > 0 || Number(r.qty) > 0);
    };

    const showChartEmpty = (canvasId, message) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }
        const wrap = canvas.closest('.admin-stats-chart-wrap');
        if (wrap) {
            wrap.innerHTML =
                '<p class="admin-stats-empty">' + escapeHtml(message || 'Немає даних за обрані фільтри') + '</p>';
        }
    };

    const buildQuery = (filters) => {
        const q = new URLSearchParams();
        q.set('mode', filters.mode || 'month');
        if (filters.mode === 'month' && filters.month) {
            q.set('month', filters.month);
        }
        if (filters.mode === 'day' && filters.date) {
            q.set('date', filters.date);
        }
        if (filters.mode === 'range') {
            if (filters.from) {
                q.set('from', filters.from);
            }
            if (filters.to) {
                q.set('to', filters.to);
            }
        }
        q.set('payment', filters.payment || 'revenue');
        q.set('delivery', filters.delivery || 'all');
        if (filters.status) {
            q.set('status', filters.status);
        }
        if (filters.category_id) {
            q.set('category_id', filters.category_id);
        }
        q.set('product_type', filters.product_type || 'all');
        return q.toString();
    };

    const destroyCharts = () => {
        Object.keys(chartMap).forEach((key) => {
            if (chartMap[key]) {
                chartMap[key].destroy();
            }
        });
        chartMap = {};
    };

    const chartColors = [
        '#22c55e',
        '#60a5fa',
        '#f59e0b',
        '#a78bfa',
        '#f472b6',
        '#34d399',
        '#fb7185',
        '#38bdf8'
    ];

    const makeChart = (id, config) => {
        const canvas = document.getElementById(id);
        if (!canvas || typeof Chart === 'undefined') {
            return;
        }
        if (chartMap[id]) {
            chartMap[id].destroy();
        }
        chartMap[id] = new Chart(canvas, config);
    };

    const renderCharts = (report) => {
        const series = report.revenue_series || [];
        const labels = series.map((r) => {
            const p = String(r.day || '').split('-');
            return p.length === 3 ? p[2] + '.' + p[1] : r.day;
        });

        if (!series.length) {
            showChartEmpty('adminStatsChartRevenue', 'Немає замовлень за обраний період');
        } else {
            makeChart('adminStatsChartRevenue', {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Виручка',
                            data: series.map((r) => r.revenue),
                            borderColor: '#22c55e',
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            fill: true,
                            tension: 0.3,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Замовлення',
                            data: series.map((r) => r.orders_count),
                            borderColor: '#60a5fa',
                            backgroundColor: 'rgba(96, 165, 250, 0.1)',
                            fill: false,
                            tension: 0.3,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: Object.assign(
                    {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { labels: { color: '#cbd5e1' } },
                            tooltip: {
                                ...chartTooltipBase,
                                callbacks: {
                                    label: (item) => {
                                        if (item.datasetIndex === 0) {
                                            return 'Виручка: ' + formatMoney(item.raw);
                                        }
                                        return 'Замовлення: ' + item.raw;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
                            y: {
                                position: 'left',
                                ticks: { color: '#94a3b8' },
                                grid: { color: 'rgba(148,163,184,0.12)' }
                            },
                            y1: {
                                position: 'right',
                                ticks: { color: '#94a3b8', stepSize: 1 },
                                grid: { drawOnChartArea: false }
                            }
                        }
                    }
                )
            });
        }

        const topProducts = report.top_products || [];
        if (!topProducts.length) {
            showChartEmpty('adminStatsChartProducts', 'Немає продажів товарів');
        } else {
            makeChart('adminStatsChartProducts', {
                type: 'bar',
                data: {
                    labels: topProducts.map((r) => r.name),
                    datasets: [
                        {
                            label: 'Виручка',
                            data: topProducts.map((r) => r.revenue),
                            backgroundColor: chartColors
                        }
                    ]
                },
                options: applyTooltip(
                    {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
                            y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                        }
                    },
                    'money'
                )
            });
        }

        const paymentSplit = report.payment_split || [];
        if (!hasChartData(paymentSplit, 'revenue')) {
            showChartEmpty('adminStatsChartPayment', 'Немає оплачених замовлень');
        } else {
            makeChart('adminStatsChartPayment', {
                type: 'doughnut',
                data: {
                    labels: paymentSplit.map((r) => r.label),
                    datasets: [
                        {
                            label: 'Виручка',
                            data: paymentSplit.map((r) => r.revenue),
                            backgroundColor: chartColors
                        }
                    ]
                },
                options: applyTooltip(
                    {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } }
                    },
                    'money'
                )
            });
        }

        const deliverySplit = report.delivery_split || [];
        if (!hasChartData(deliverySplit, 'count')) {
            showChartEmpty('adminStatsChartDelivery', 'Немає замовлень з доставкою');
        } else {
            makeChart('adminStatsChartDelivery', {
                type: 'doughnut',
                data: {
                    labels: deliverySplit.map((r) => r.label),
                    datasets: [
                        {
                            label: 'Замовлення',
                            data: deliverySplit.map((r) => r.count),
                            backgroundColor: ['#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#fb7185']
                        }
                    ]
                },
                options: applyTooltip(
                    {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } }
                    },
                    'count'
                )
            });
        }

        const categories = report.top_categories || [];
        if (!categories.length) {
            showChartEmpty('adminStatsChartCategories', 'Немає продажів по категоріях');
        } else {
            makeChart('adminStatsChartCategories', {
                type: 'bar',
                data: {
                    labels: categories.map((r) => r.name),
                    datasets: [
                        {
                            label: 'Виручка',
                            data: categories.map((r) => r.revenue),
                            backgroundColor: '#a78bfa'
                        }
                    ]
                },
                options: applyTooltip(
                    {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } }
                        }
                    },
                    'money'
                )
            });
        }

        const weekday = report.orders_by_weekday || [];
        if (!weekday.length) {
            showChartEmpty('adminStatsChartWeekday', 'Немає замовлень');
        } else {
            makeChart('adminStatsChartWeekday', {
                type: 'bar',
                data: {
                    labels: weekday.map((r) => r.weekday),
                    datasets: [
                        {
                            label: 'Замовлення',
                            data: weekday.map((r) => r.count),
                            backgroundColor: '#38bdf8'
                        }
                    ]
                },
                options: applyTooltip(
                    {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                            y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.12)' } }
                        }
                    },
                    'count'
                )
            });
        }

        const hours = report.orders_by_hour || [];
        if (!hours.length) {
            showChartEmpty('adminStatsChartHour', 'Немає замовлень');
        } else {
            makeChart('adminStatsChartHour', {
                type: 'line',
                data: {
                    labels: hours.map((r) => r.label),
                    datasets: [
                        {
                            label: 'Замовлення',
                            data: hours.map((r) => r.count),
                            borderColor: '#f472b6',
                            backgroundColor: 'rgba(244, 114, 182, 0.15)',
                            fill: true,
                            tension: 0.3
                        }
                    ]
                },
                options: applyTooltip(
                    {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
                            y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.12)' } }
                        }
                    },
                    'count'
                )
            });
        }

        const productType = report.product_type_split || [];
        const catalogRow = productType.find((r) => r.key === 'catalog') || { revenue: 0, qty: 0 };
        const constructorRow = productType.find((r) => r.key === 'constructor') || { revenue: 0, qty: 0 };
        const foot = document.getElementById('adminStatsChartProductTypeFoot');
        if (foot) {
            foot.hidden = false;
            foot.textContent =
                'Каталог: ' +
                formatMoney(catalogRow.revenue) +
                ' (' +
                catalogRow.qty +
                ' поз.) · Конструктор: ' +
                formatMoney(constructorRow.revenue) +
                ' (' +
                constructorRow.qty +
                ' поз.)';
        }
        if (catalogRow.revenue <= 0 && constructorRow.revenue <= 0) {
            showChartEmpty('adminStatsChartProductType', 'Немає продажів товарів');
        } else {
            makeChart('adminStatsChartProductType', {
                type: 'pie',
                data: {
                    labels: productType.map((r) => r.label),
                    datasets: [
                        {
                            label: 'Виручка',
                            data: productType.map((r) => r.revenue),
                            backgroundColor: ['#22c55e', '#f59e0b']
                        }
                    ]
                },
                options: applyTooltip(
                    {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } }
                    },
                    'money'
                )
            });
        }

        const statusFunnel = report.status_funnel || [];
        if (!statusFunnel.length) {
            showChartEmpty('adminStatsChartStatus', 'Немає замовлень');
        } else {
            makeChart('adminStatsChartStatus', {
                type: 'bar',
                data: {
                    labels: statusFunnel.map((r) => r.label),
                    datasets: [
                        {
                            label: 'Замовлення',
                            data: statusFunnel.map((r) => r.count),
                            backgroundColor: '#34d399'
                        }
                    ]
                },
                options: applyTooltip(
                    {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.12)' } },
                            y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                        }
                    },
                    'count'
                )
            });
        }
    };

    const renderTable = (series) => {
        if (!series.length) {
            return '<p class="admin-stats-empty">Немає даних за обраний період.</p>';
        }
        let rows = '';
        for (const row of series) {
            const p = String(row.day || '').split('-');
            const label = p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : row.day;
            rows +=
                '<tr><td>' +
                escapeHtml(label) +
                '</td><td>' +
                formatMoney(row.revenue) +
                '</td><td>' +
                (Number(row.orders_count) || 0) +
                '</td></tr>';
        }
        return (
            '<table class="admin-table admin-stats-table">' +
            '<thead><tr><th>Дата</th><th>Виручка</th><th>Замовлення</th></tr></thead>' +
            '<tbody>' +
            rows +
            '</tbody></table>'
        );
    };

    const renderCouriers = (rows) => {
        if (!rows.length) {
            return '<p class="admin-stats-empty">Немає призначень курʼєрам за період.</p>';
        }
        let html = '';
        for (const row of rows) {
            html +=
                '<tr><td>' +
                escapeHtml(row.name) +
                '</td><td>' +
                (Number(row.orders_count) || 0) +
                '</td></tr>';
        }
        return (
            '<table class="admin-table admin-stats-table">' +
            '<thead><tr><th>Курʼєр</th><th>Замовлення</th></tr></thead>' +
            '<tbody>' +
            html +
            '</tbody></table>'
        );
    };

    const renderTopCustomers = (rows) => {
        if (!rows.length) {
            return '<p class="admin-stats-empty">Немає зареєстрованих покупців за період.</p>';
        }
        let html = '';
        for (const row of rows) {
            html +=
                '<tr><td>' +
                escapeHtml(row.name) +
                '</td><td>' +
                (Number(row.orders_count) || 0) +
                '</td><td>' +
                formatMoney(row.revenue) +
                '</td></tr>';
        }
        return (
            '<table class="admin-table admin-stats-table">' +
            '<thead><tr><th>Клієнт</th><th>Замовлення</th><th>Сума</th></tr></thead>' +
            '<tbody>' +
            html +
            '</tbody></table>'
        );
    };

    const syncPeriodFields = (root, filters) => {
        const mode = filters.mode || 'month';
        root.querySelector('#admin-stats-mode').value = mode;
        root.querySelector('#admin-stats-month-wrap').hidden = mode !== 'month';
        root.querySelector('#admin-stats-day-wrap').hidden = mode !== 'day';
        root.querySelector('#admin-stats-range-wrap').hidden = mode !== 'range';
    };

    const collectFilters = (root) => {
        return {
            mode: root.querySelector('#admin-stats-mode').value,
            month: root.querySelector('#admin-stats-month').value,
            date: root.querySelector('#admin-stats-date').value,
            from: root.querySelector('#admin-stats-from').value,
            to: root.querySelector('#admin-stats-to').value,
            payment: root.querySelector('#admin-stats-payment').value,
            delivery: root.querySelector('#admin-stats-delivery').value,
            status: root.querySelector('#admin-stats-status').value,
            category_id: root.querySelector('#admin-stats-category').value,
            product_type: root.querySelector('#admin-stats-product-type').value
        };
    };

    async function loadStatsPage(api) {
        const content = document.getElementById('admin-panel-content');
        if (!content || !api || !api.apiFetch) {
            return;
        }

        if (api.setActiveMenu) {
            api.setActiveMenu('statistics');
        }
        if (api.saveAdminView) {
            api.saveAdminView({ view: 'statistics' });
        }

        api.showMessage('');
        destroyCharts();

        const filters = readFilters();
        content.innerHTML =
            '<div class="admin-stats-page"><p class="admin-panel-loading">Завантаження статистики…</p></div>';

        let options = { categories: [], statuses: [] };
        try {
            options = await api.apiFetch('/api/admin/stats/options');
        } catch (err) {
        }

        const catOptions =
            '<option value="">Усі категорії</option>' +
            (options.categories || [])
                .map(
                    (c) =>
                        '<option value="' +
                        c.id +
                        '"' +
                        (String(filters.category_id) === String(c.id) ? ' selected' : '') +
                        '>' +
                        escapeHtml(c.name) +
                        '</option>'
                )
                .join('');

        const statusOptions =
            '<option value="">Усі статуси</option>' +
            (options.statuses || [])
                .map(
                    (s) =>
                        '<option value="' +
                        escapeHtml(s.value) +
                        '"' +
                        (filters.status === s.value ? ' selected' : '') +
                        '>' +
                        escapeHtml(s.label) +
                        '</option>'
                )
                .join('');

        content.innerHTML =
            '<div class="admin-stats-page">' +
            '<div class="admin-stats-filters admin-revenue-filters">' +
            '<label>Період<select id="admin-stats-mode">' +
            '<option value="today"' +
            (filters.mode === 'today' ? ' selected' : '') +
            '>Сьогодні</option>' +
            '<option value="week"' +
            (filters.mode === 'week' ? ' selected' : '') +
            '>7 днів</option>' +
            '<option value="last30"' +
            (filters.mode === 'last30' ? ' selected' : '') +
            '>30 днів</option>' +
            '<option value="last90"' +
            (filters.mode === 'last90' ? ' selected' : '') +
            '>90 днів</option>' +
            '<option value="month"' +
            (filters.mode === 'month' ? ' selected' : '') +
            '>Місяць</option>' +
            '<option value="day"' +
            (filters.mode === 'day' ? ' selected' : '') +
            '>Одна дата</option>' +
            '<option value="range"' +
            (filters.mode === 'range' ? ' selected' : '') +
            '>Діапазон</option>' +
            '</select></label>' +
            '<label id="admin-stats-month-wrap">Місяць<input type="month" id="admin-stats-month" value="' +
            escapeHtml(filters.month) +
            '" /></label>' +
            '<label id="admin-stats-day-wrap" hidden>Дата<input type="date" id="admin-stats-date" value="' +
            escapeHtml(filters.date) +
            '" /></label>' +
            '<div id="admin-stats-range-wrap" class="admin-revenue-range" hidden>' +
            '<label>Від<input type="date" id="admin-stats-from" value="' +
            escapeHtml(filters.from) +
            '" /></label>' +
            '<label>До<input type="date" id="admin-stats-to" value="' +
            escapeHtml(filters.to) +
            '" /></label></div>' +
            '<label>Оплата<select id="admin-stats-payment">' +
            '<option value="revenue"' +
            (filters.payment === 'revenue' ? ' selected' : '') +
            '>Оплачені (онлайн + при отриманні)</option>' +
            '<option value="paid"' +
            (filters.payment === 'paid' ? ' selected' : '') +
            '>Тільки онлайн-оплата</option>' +
            '<option value="cod"' +
            (filters.payment === 'cod' ? ' selected' : '') +
            '>Тільки при отриманні</option>' +
            '<option value="unpaid"' +
            (filters.payment === 'unpaid' ? ' selected' : '') +
            '>Не оплачені</option>' +
            '<option value="all"' +
            (filters.payment === 'all' ? ' selected' : '') +
            '>Усі (крім відхилених)</option>' +
            '</select></label>' +
            '<label>Доставка<select id="admin-stats-delivery">' +
            '<option value="all"' +
            (filters.delivery === 'all' ? ' selected' : '') +
            '>Усі</option>' +
            '<option value="courier"' +
            (filters.delivery === 'courier' ? ' selected' : '') +
            '>Адресна доставка</option>' +
            '<option value="pickup"' +
            (filters.delivery === 'pickup' ? ' selected' : '') +
            '>Самовивіз</option>' +
            '</select></label>' +
            '<label>Категорія<select id="admin-stats-category">' +
            catOptions +
            '</select></label>' +
            '<label>Тип товару<select id="admin-stats-product-type">' +
            '<option value="all"' +
            (filters.product_type === 'all' ? ' selected' : '') +
            '>Усі</option>' +
            '<option value="catalog"' +
            (filters.product_type === 'catalog' ? ' selected' : '') +
            '>Каталог</option>' +
            '<option value="constructor"' +
            (filters.product_type === 'constructor' ? ' selected' : '') +
            '>Конструктор</option>' +
            '</select></label>' +
            '<label>Статус<select id="admin-stats-status">' +
            statusOptions +
            '</select></label>' +
            '<button type="button" class="admin-primary-btn" id="admin-stats-apply">Застосувати</button>' +
            '<a class="admin-secondary-btn admin-stats-export" id="admin-stats-export" href="#" title="Завантажити таблицю по днях">Експорт CSV</a>' +
            '</div>' +
            '<p class="admin-stats-intro">Підсумки продажів за обраний період. Наведіть на графік — побачите точні суми. Фільтри зверху застосовуються до всіх блоків нижче.</p>' +
            '<div id="admin-stats-body"><p class="admin-panel-loading">Завантаження…</p></div>' +
            '</div>';

        const root = content.querySelector('.admin-stats-page');
        root.dataset.statsOptions = JSON.stringify(options);
        syncPeriodFields(root, filters);

        const applyReport = async () => {
            const current = collectFilters(root);
            saveFilters(current);
            syncPeriodFields(root, current);

            const body = root.querySelector('#admin-stats-body');
            body.innerHTML = '<p class="admin-panel-loading">Оновлення…</p>';
            destroyCharts();

            try {
                const data = await api.apiFetch('/api/admin/stats/report?' + buildQuery(current));
                const report = data.report || {};
                const summary = report.summary || {};
                const compare = summary.compare;
                const customerTypes = report.customer_types || {};
                let statsOptions = { categories: [], statuses: [] };
                try {
                    statsOptions = JSON.parse(root.dataset.statsOptions || '{}');
                } catch (err) {
                }
                const filterSummary = buildFilterSummary(current, statsOptions);
                const oneOrderClients =
                    Number(customerTypes.one_order_clients != null ? customerTypes.one_order_clients : customerTypes.new_customers) || 0;
                const repeatClients =
                    Number(customerTypes.repeat_clients != null ? customerTypes.repeat_clients : customerTypes.returning_customers) || 0;

                body.innerHTML =
                    '<p class="admin-stats-period-label"><strong>' +
                    escapeHtml(report.period_label || '') +
                    '</strong></p>' +
                    '<p class="admin-stats-filter-summary">' +
                    escapeHtml(filterSummary) +
                    '</p>' +
                    '<h3 class="admin-stats-section-title">Головні показники</h3>' +
                    '<div class="admin-stats-grid admin-stats-kpi">' +
                    '<div class="admin-stat" title="Сума оплачених замовлень за фільтром"><span>Виручка</span><strong>' +
                    formatMoney(summary.revenue) +
                    '</strong>' +
                    (compare ? formatDelta(compare.revenue_change_pct) : '') +
                    '</div>' +
                    '<div class="admin-stat" title="Кількість замовлень у періоді"><span>Замовлення</span><strong>' +
                    (Number(summary.orders_count) || 0) +
                    '</strong>' +
                    (compare ? formatDelta(compare.orders_change_pct) : '') +
                    '</div>' +
                    '<div class="admin-stat" title="Виручка ÷ кількість замовлень"><span>Середній чек</span><strong>' +
                    formatMoney(summary.avg_order) +
                    '</strong></div>' +
                    '<div class="admin-stat admin-stat-warn" title="Замовлення зі статусом «Скасовано»"><span>Скасовано</span><strong>' +
                    (Number(summary.cancelled_count) || 0) +
                    ' (' +
                    (Number(summary.cancel_rate) || 0) +
                    '%)</strong></div>' +
                    '<div class="admin-stat" title="Клієнти з одним замовленням за період"><span>Разові покупці</span><strong>' +
                    oneOrderClients +
                    '</strong></div>' +
                    '<div class="admin-stat" title="Клієнти з двома і більше замовленнями за період"><span>Постійні клієнти</span><strong>' +
                    repeatClients +
                    '</strong></div>' +
                    '<div class="admin-stat" title="Середня оцінка опублікованих відгуків"><span>Рейтинг</span><strong>' +
                    (Number((report.reviews || {}).avg_rating) || 0) +
                    ' ★</strong></div>' +
                    '<div class="admin-stat" title="Кількість нових відгуків за період"><span>Відгуків</span><strong>' +
                    (Number((report.reviews || {}).count) || 0) +
                    '</strong></div>' +
                    '</div>' +
                    (compare
                        ? '<p class="admin-stats-compare-hint">Порівняно з «' +
                          escapeHtml(compare.label) +
                          '»: було ' +
                          formatMoney(compare.revenue) +
                          ' і ' +
                          (Number(compare.orders_count) || 0) +
                          ' зам. · відсоток показує зміну до попереднього періоду</p>'
                        : '') +
                    '<h3 class="admin-stats-section-title">Графіки</h3>' +
                    '<div class="admin-stats-charts">' +
                    renderChartCard(
                        'Динаміка продажів',
                        'Зелена лінія — виручка по днях, синя — кількість замовлень',
                        'adminStatsChartRevenue',
                        'admin-stats-chart-card--wide'
                    ) +
                    renderChartCard(
                        'Топ-10 товарів',
                        'Товари з найбільшою виручкою за період',
                        'adminStatsChartProducts',
                        'admin-stats-chart-card--tall'
                    ) +
                    renderChartCard(
                        'Способи оплати',
                        'Частка виручки: онлайн або при отриманні',
                        'adminStatsChartPayment',
                        ''
                    ) +
                    renderChartCard(
                        'Способи доставки',
                        'Скільки замовлень: стандарт, експрес, самовивіз тощо',
                        'adminStatsChartDelivery',
                        ''
                    ) +
                    renderChartCard(
                        'Топ категорій',
                        'Категорії каталогу з найбільшою виручкою',
                        'adminStatsChartCategories',
                        ''
                    ) +
                    renderChartCard(
                        'Дні тижня',
                        'Коли клієнти найчастіше оформлюють замовлення',
                        'adminStatsChartWeekday',
                        ''
                    ) +
                    renderChartCard(
                        'Години замовлень',
                        'Час доби створення замовлення (за годинним поясом сервера)',
                        'adminStatsChartHour',
                        ''
                    ) +
                    renderChartCard(
                        'Каталог vs конструктор',
                        'Виручка від готових товарів і від квітів з конструктора',
                        'adminStatsChartProductType',
                        ''
                    ) +
                    renderChartCard(
                        'Статуси замовлень',
                        'Скільки замовлень у кожному статусі (нове, доставлено, скасовано…)',
                        'adminStatsChartStatus',
                        'admin-stats-chart-card--wide admin-stats-chart-card--tall'
                    ) +
                    '</div>' +
                    '<h3 class="admin-stats-section-title">Таблиці</h3>' +
                    '<div class="admin-stats-tables">' +
                    '<div class="admin-stats-table-block"><h4>Деталізація по днях</h4><p class="admin-stats-chart-hint">Виручка та кількість замовлень на кожен день</p>' +
                    renderTable(report.revenue_series || []) +
                    '</div>' +
                    '<div class="admin-stats-table-block"><h4>Топ клієнтів</h4><p class="admin-stats-chart-hint">Зареєстровані покупці з найбільшою сумою</p>' +
                    renderTopCustomers(report.top_customers || []) +
                    '</div>' +
                    '<div class="admin-stats-table-block"><h4>Курʼєри</h4><p class="admin-stats-chart-hint">Скільки замовлень доставив кожен курʼєр</p>' +
                    renderCouriers(report.couriers || []) +
                    '</div>' +
                    '</div>';

                renderCharts(report);
            } catch (err) {
                body.innerHTML =
                    '<p class="admin-stats-error">' + escapeHtml(err.message || 'Помилка') + '</p>';
            }
        };

        root.querySelector('#admin-stats-mode').addEventListener('change', () => {
            syncPeriodFields(root, collectFilters(root));
        });

        root.querySelector('#admin-stats-apply').addEventListener('click', applyReport);

        const exportBtn = root.querySelector('#admin-stats-export');
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const current = collectFilters(root);
            window.location.href = '/api/admin/stats/export?' + buildQuery(current);
        });

        await applyReport();
    }

    window.adminStatsPage = {
        load: loadStatsPage
    };
})();
