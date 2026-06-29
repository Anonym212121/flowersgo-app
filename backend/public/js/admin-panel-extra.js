(() => {
    const content = document.getElementById('admin-panel-content');
    const dashBtn = document.getElementById('admin-show-dashboard');
    const statsBtn = document.getElementById('admin-show-statistics');
    const catsBtn = document.getElementById('admin-show-categories');
    const ordersAllBtn = document.getElementById('admin-show-orders-all');
    const usersBtn = document.getElementById('admin-show-users');
    const couriersBtn = document.getElementById('admin-show-couriers');
    const deliveryBtn = document.getElementById('admin-show-delivery');
    const constructorBtn = document.getElementById('admin-show-constructor');
    const legalBtn = document.getElementById('admin-show-legal');

    if (!content || !dashBtn) {
        return;
    }

    let ordersSearchTimer = null;
    let usersSearchTimer = null;

    const ADMIN_VIEW_KEY = 'flowersgo_admin_view';

    const saveAdminView = (state) => {
        if (typeof window.saveFormDraftView === 'function') {
            window.saveFormDraftView(ADMIN_VIEW_KEY, state);
        }
    };

    const bindAdminDraft = (form, key, opts) => {
        if (!form || typeof window.bindFormDraft !== 'function') {
            return null;
        }
        const base = {
            key: key,
            storage: 'local',
            notifyMessage: 'Чернетку форми відновлено'
        };
        return window.bindFormDraft(form, Object.assign(base, opts || {}));
    };

    const bindTableSearch = (inputId, countId, emptyRowId, rowSelector, getHaystack) => {
        const searchInput = document.getElementById(inputId);
        const searchCount = countId ? document.getElementById(countId) : null;
        const emptyRow = emptyRowId ? document.getElementById(emptyRowId) : null;
        if (!searchInput) {
            return;
        }
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            const rows = content.querySelectorAll(rowSelector);
            let shown = 0;
            rows.forEach((row) => {
                const hay = getHaystack(row).toLowerCase();
                const ok = !q || hay.indexOf(q) !== -1;
                row.hidden = !ok;
                if (ok) {
                    shown += 1;
                }
            });
            if (emptyRow) {
                emptyRow.hidden = !q || shown > 0;
            }
            if (searchCount) {
                searchCount.textContent = q ? `Показано: ${shown}` : '';
            }
        });
    };

    const adminApprovedLabel = (val) => {
        if (Number(val) === 0) return 'На модерації';
        if (Number(val) === -1) return 'Відхилено';
        return 'На складі';
    };

    const paymentLabel = (status) => {
        if (status === 'paid') return 'Оплачено';
        if (status === 'cod') return 'Оплата при отриманні';
        return 'Не оплачено';
    };

    const formatUserSavedAddress = (user) => {
        const street = String(user.saved_delivery_street || '').trim();
        const house = String(user.saved_delivery_house || '').trim();
        const apartment = String(user.saved_delivery_apartment || '').trim();
        if (!street || !house) {
            return '—';
        }
        let text = `${street}, буд. ${house}`;
        if (apartment) {
            text += `, кв./офіс ${apartment}`;
        }
        return text;
    };

    const formatLiqpayPaidAt = (order) => {
        if (!order || order.payment_status !== 'paid' || !order.paid_at) {
            return '';
        }
        const date = new Date(order.paid_at);
        if (!Number.isFinite(date.getTime())) {
            return '';
        }
        return date.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
    };

    const paymentInfoText = (order) => {
        const label = paymentLabel(order.payment_status);
        const paidAt = formatLiqpayPaidAt(order);
        if (!paidAt) {
            return label;
        }
        return label + ' (LiqPay: ' + paidAt + ')';
    };

    const formatAdminDateTime = (raw) => {
        if (!raw) {
            return '—';
        }
        try {
            return new Date(raw).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
        } catch (e) {
            return '—';
        }
    };

    const refundStatusLabel = (status) => {
        if (status === 'refunded') {
            return 'Повернено через LiqPay';
        }
        if (status === 'manual') {
            return 'Потрібне ручне повернення';
        }
        if (status === 'not_needed') {
            return 'Повернення не потрібне';
        }
        if (status) {
            return String(status);
        }
        return '—';
    };

    const deliveryMethodLabel = (method) => {
        if (method === 'pickup') {
            return 'Самовивіз';
        }
        if (method === 'express') {
            return 'Експрес';
        }
        return 'Стандартна доставка';
    };

    const renderStatusTimeline = (api, log) => {
        if (!Array.isArray(log) || log.length === 0) {
            return '<p class="admin-muted-hint">Історія змін статусу поки порожня.</p>';
        }
        let html = '<ol class="admin-status-timeline">';
        for (let i = 0; i < log.length; i += 1) {
            const row = log[i];
            const who =
                [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email || 'Система';
            html += '<li class="admin-status-timeline__item">';
            html +=
                '<span class="admin-status-timeline__time">' +
                api.escapeHtml(formatAdminDateTime(row.createdAt)) +
                '</span>';
            html +=
                '<span class="admin-status-timeline__change">' +
                api.escapeHtml(row.from_label || row.from_name || '?') +
                ' → ' +
                api.escapeHtml(row.to_label || row.to_name || '?') +
                '</span>';
            html += '<span class="admin-status-timeline__who">' + api.escapeHtml(who) + '</span>';
            html += '</li>';
        }
        html += '</ol>';
        return html;
    };

    const getTodayInputValue = () => {
        const now = new Date();
        return (
            now.getFullYear() +
            '-' +
            String(now.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(now.getDate()).padStart(2, '0')
        );
    };

    const getCurrentMonthValue = () => {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    };

    const bindRevenueFilters = (api) => {
        const modeEl = document.getElementById('admin-revenue-mode');
        const monthWrap = document.getElementById('admin-revenue-month-wrap');
        const dayWrap = document.getElementById('admin-revenue-day-wrap');
        const rangeWrap = document.getElementById('admin-revenue-range-wrap');
        const showBtn = document.getElementById('admin-revenue-show');

        if (!modeEl || !showBtn) {
            return;
        }

        const syncFields = () => {
            const mode = modeEl.value;
            if (monthWrap) {
                monthWrap.hidden = mode !== 'month';
            }
            if (dayWrap) {
                dayWrap.hidden = mode !== 'day';
            }
            if (rangeWrap) {
                rangeWrap.hidden = mode !== 'range';
            }
        };

        modeEl.addEventListener('change', syncFields);
        syncFields();

        showBtn.addEventListener('click', () => {
            loadRevenue(api);
        });

        loadRevenue(api);
    };

    const loadRevenue = async (api) => {
        const modeEl = document.getElementById('admin-revenue-mode');
        const resultEl = document.getElementById('admin-revenue-result');
        if (!modeEl || !resultEl) {
            return;
        }

        const mode = modeEl.value;
        let url = '/api/admin/dashboard/revenue?mode=' + encodeURIComponent(mode);

        if (mode === 'day') {
            const dateEl = document.getElementById('admin-revenue-date');
            if (!dateEl || !dateEl.value) {
                api.showMessage('Оберіть дату', true);
                return;
            }
            url += '&date=' + encodeURIComponent(dateEl.value);
        } else if (mode === 'month') {
            const monthEl = document.getElementById('admin-revenue-month');
            if (!monthEl || !monthEl.value) {
                api.showMessage('Оберіть місяць', true);
                return;
            }
            url += '&month=' + encodeURIComponent(monthEl.value);
        } else if (mode === 'range') {
            const fromEl = document.getElementById('admin-revenue-from');
            const toEl = document.getElementById('admin-revenue-to');
            if (!fromEl || !toEl || !fromEl.value || !toEl.value) {
                api.showMessage('Оберіть початок і кінець періоду', true);
                return;
            }
            url += '&from=' + encodeURIComponent(fromEl.value);
            url += '&to=' + encodeURIComponent(toEl.value);
        }

        try {
            const data = await api.apiFetch(url);
            const r = data.revenue || {};
            resultEl.innerHTML =
                '<p class="admin-revenue-label">' +
                api.escapeHtml(r.period_label || 'Період') +
                '</p>' +
                '<p class="admin-revenue-sum"><strong>' +
                Number(r.revenue || 0).toLocaleString('uk-UA') +
                ' грн</strong></p>' +
                '<p class="admin-revenue-orders">Замовлень: <strong>' +
                Number(r.orders_count || 0) +
                '</strong> (оплачено карткою або при отриманні)</p>';
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    const loadDashboard = async (api) => {
        if (api.setActiveMenu) {
            api.setActiveMenu('dashboard', true);
        } else if (api.saveAdminView) {
            api.saveAdminView({ view: 'dashboard' });
        }
        try {
            const data = await api.apiFetch('/api/admin/dashboard');
            const s = data.stats || {};
            const low = s.low_stock_products || [];
            let lowHtml = '';
            for (let i = 0; i < low.length; i += 1) {
                lowHtml +=
                    '<li><button type="button" class="admin-low-stock-link" data-id="' +
                    low[i].id +
                    '">' +
                    api.escapeHtml(low[i].name) +
                    ' — ' +
                    low[i].stock_quantity +
                    ' шт</button></li>';
            }

            let alertsHtml = '';
            const alertItems = [];
            if (Number(s.pending_orders) > 0) {
                alertItems.push({
                    go: 'orders-pending',
                    text: s.pending_orders + ' замовлень на модерації'
                });
            }
            if (Number(s.awaiting_payment) > 0) {
                alertItems.push({
                    go: 'orders-awaiting',
                    text: s.awaiting_payment + ' очікують оплату'
                });
            }
            if (Number(s.cancel_requests) > 0) {
                alertItems.push({
                    go: 'orders-cancel',
                    text: s.cancel_requests + ' запитів на скасування'
                });
            }
            if (Number(s.unassigned_courier) > 0) {
                alertItems.push({
                    go: 'couriers-unassigned',
                    text: s.unassigned_courier + ' замовлень без кур\'єра'
                });
            }
            if (Number(s.low_stock_count) > 0) {
                alertItems.push({
                    go: 'products-low',
                    text: s.low_stock_count + ' товарів з низьким залишком'
                });
            }
            if (alertItems.length > 0) {
                alertsHtml =
                    '<div class="admin-attention"><h4 class="admin-dashboard-section-title">Потребує уваги</h4><ul class="admin-attention__list">';
                for (let j = 0; j < alertItems.length; j += 1) {
                    alertsHtml +=
                        '<li><button type="button" class="admin-attention__item" data-dashboard-go="' +
                        alertItems[j].go +
                        '">' +
                        api.escapeHtml(alertItems[j].text) +
                        '</button></li>';
                }
                alertsHtml += '</ul></div>';
            }

            const todayVal = getTodayInputValue();
            const monthVal = getCurrentMonthValue();

            content.innerHTML = `
                ${alertsHtml}
                <div class="admin-dashboard-quick">
                    <h3 class="admin-dashboard-quick__title">Швидкі дії</h3>
                    <div class="admin-dashboard-quick__grid">
                        <button type="button" class="admin-quick-card" data-dashboard-go="product-create">
                            <strong>+ Товар</strong>
                            <span>Додати позицію в каталог</span>
                        </button>
                        <button type="button" class="admin-quick-card" data-dashboard-go="orders-pending">
                            <strong>Модерація</strong>
                            <span>${s.pending_orders || 0} нових замовлень</span>
                        </button>
                        <button type="button" class="admin-quick-card" data-dashboard-go="support">
                            <strong>Підтримка</strong>
                            <span>Чати з клієнтами</span>
                        </button>
                        <button type="button" class="admin-quick-card" data-dashboard-go="constructor">
                            <strong>Конструктор</strong>
                            <span>Квіти та шаблони букетів</span>
                        </button>
                        <button type="button" class="admin-quick-card" data-dashboard-go="delivery">
                            <strong>Доставка</strong>
                            <span>Тарифи та правила</span>
                        </button>
                        <a class="admin-quick-card admin-quick-card--link" href="/" target="_blank" rel="noopener">
                            <strong>Сайт ↗</strong>
                            <span>Переглянути вітрину</span>
                        </a>
                    </div>
                </div>
                <h3 class="admin-dashboard-section-title">Показники</h3>
                <div class="admin-stats-grid">
                    <div class="admin-stat admin-stat--click" data-dashboard-go="orders-pending">
                        <span>Нові замовлення</span><strong>${s.pending_orders || 0}</strong>
                    </div>
                    <div class="admin-stat admin-stat--click" data-dashboard-go="orders-awaiting">
                        <span>Очікують оплату</span><strong>${s.awaiting_payment || 0}</strong>
                    </div>
                    <div class="admin-stat admin-stat--click" data-dashboard-go="reviews">
                        <span>Відгуки на модерації</span><strong>${s.pending_reviews || 0}</strong>
                    </div>
                    <div class="admin-stat"><span>Виручка сьогодні</span><strong>${Number(s.revenue_today || 0).toLocaleString('uk-UA')} грн</strong></div>
                    <div class="admin-stat"><span>Виручка 7 днів</span><strong>${Number(s.revenue_week || 0).toLocaleString('uk-UA')} грн</strong></div>
                    <div class="admin-stat admin-stat--click" data-dashboard-go="orders-all">
                        <span>Усі замовлення</span><strong>${s.orders_total || 0}</strong>
                    </div>
                    <div class="admin-stat admin-stat--click" data-dashboard-go="products">
                        <span>Активні товари</span><strong>${s.products_active || 0}</strong>
                    </div>
                    <div class="admin-stat admin-stat-warn admin-stat--click" data-dashboard-go="products-low">
                        <span>Мало на складі</span><strong>${s.low_stock_count || 0}</strong>
                    </div>
                </div>
                <div class="admin-revenue-block">
                    <h4>Виручка за період</h4>
                    <div class="admin-filters admin-revenue-filters">
                        <label>
                            Період
                            <select id="admin-revenue-mode">
                                <option value="month" selected>Місяць</option>
                                <option value="day">Одна дата</option>
                                <option value="range">Проміжок дат</option>
                                <option value="today">Сьогодні</option>
                                <option value="week">Останні 7 днів</option>
                            </select>
                        </label>
                        <label id="admin-revenue-month-wrap">
                            Місяць
                            <input type="month" id="admin-revenue-month" value="${monthVal}">
                        </label>
                        <label id="admin-revenue-day-wrap" hidden>
                            Дата
                            <input type="date" id="admin-revenue-date" value="${todayVal}">
                        </label>
                        <span id="admin-revenue-range-wrap" hidden class="admin-revenue-range">
                            <label>
                                Від
                                <input type="date" id="admin-revenue-from" value="${todayVal}">
                            </label>
                            <label>
                                До
                                <input type="date" id="admin-revenue-to" value="${todayVal}">
                            </label>
                        </span>
                        <button type="button" class="admin-primary-btn" id="admin-revenue-show">Показати</button>
                    </div>
                    <div class="admin-revenue-result" id="admin-revenue-result">
                        <p class="admin-revenue-label">Оберіть період і натисніть «Показати»</p>
                    </div>
                </div>
                ${lowHtml ? '<div class="admin-low-stock"><h4>Товари з низьким залишком</h4><ul class="admin-low-stock__list">' + lowHtml + '</ul><button type="button" class="admin-secondary-btn" data-dashboard-go="products-low">Усі з низьким складом</button></div>' : ''}
            `;

            bindRevenueFilters(api);

            content.querySelectorAll('[data-dashboard-go]').forEach((el) => {
                el.addEventListener('click', () => {
                    const go = el.getAttribute('data-dashboard-go');
                    api.showMessage('');
                    if (go === 'product-create') {
                        api.setActiveMenu('create');
                        api.renderForm(null);
                    } else if (go === 'orders-pending') {
                        api.setActiveMenu('orders');
                        api.loadPendingOrders();
                    } else if (go === 'orders-awaiting') {
                        api.setActiveMenu('orders-awaiting');
                        api.loadAwaitingPaymentOrders();
                    } else if (go === 'reviews') {
                        api.setActiveMenu('reviews');
                        api.loadPendingReviews();
                    } else if (go === 'orders-all') {
                        api.setActiveMenu('ordersAll');
                        loadAllOrders(api);
                    } else if (go === 'products') {
                        api.setActiveMenu('list');
                        api.loadProductList();
                    } else if (go === 'products-low') {
                        if (typeof api.setProductStockFilter === 'function') {
                            api.setProductStockFilter('low');
                        }
                        api.setActiveMenu('list');
                        api.loadProductList();
                    } else if (go === 'orders-cancel') {
                        api.setActiveMenu('ordersAll');
                        loadAllOrders(api, 'cancel_requests');
                    } else if (go === 'couriers-unassigned') {
                        api.setActiveMenu('ordersAll');
                        loadAllOrders(api, 'unassigned');
                    } else if (go === 'support') {
                        const supportBtn = document.getElementById('admin-show-support');
                        if (supportBtn) {
                            supportBtn.click();
                        }
                    } else if (go === 'constructor') {
                        const constructorBtn = document.getElementById('admin-show-constructor');
                        if (constructorBtn) {
                            constructorBtn.click();
                        }
                    } else if (go === 'delivery') {
                        const deliveryBtn = document.getElementById('admin-show-delivery');
                        if (deliveryBtn) {
                            deliveryBtn.click();
                        }
                    }
                });
            });

            content.querySelectorAll('.admin-low-stock-link').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    if (typeof api.openProductEdit === 'function') {
                        api.openProductEdit(id);
                    }
                });
            });

            if (window.adminNav && typeof window.adminNav.refreshBadges === 'function') {
                window.adminNav.refreshBadges(api);
            }
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    const renderCategories = async (api) => {
        const data = await api.apiFetch('/api/admin/categories');
        const list = data.categories || [];
        const parents = list.filter((c) => c.parent_id == null);
        const parentOptions = parents
            .map((c) => `<option value="${c.id}">${api.escapeHtml(c.name)}</option>`)
            .join('');

        const sortCats = (a, b) => {
            const oa = Number(a.sort_order || 0);
            const ob = Number(b.sort_order || 0);
            if (oa !== ob) {
                return oa - ob;
            }
            return Number(a.id) - Number(b.id);
        };

        const groups = {};
        for (let i = 0; i < list.length; i += 1) {
            const c = list[i];
            const key = c.parent_id == null ? 'root' : String(c.parent_id);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(c);
        }
        for (const key in groups) {
            groups[key].sort(sortCats);
        }

        const sortedList = [];
        const rootList = groups.root || [];
        for (let i = 0; i < rootList.length; i += 1) {
            const p = rootList[i];
            sortedList.push(p);
            const subs = groups[String(p.id)] || [];
            for (let j = 0; j < subs.length; j += 1) {
                sortedList.push(subs[j]);
            }
        }
        for (let i = 0; i < list.length; i += 1) {
            const c = list[i];
            if (c.parent_id != null && !sortedList.find((x) => Number(x.id) === Number(c.id))) {
                sortedList.push(c);
            }
        }

        const rows = sortedList
            .map((c) => {
                const parent = list.find((x) => Number(x.id) === Number(c.parent_id));
                const parentName = parent ? parent.name : '—';
                let photoCell = '—';
                if (c.image_url) {
                    photoCell = `<img src="${api.escapeHtml(c.image_url)}" alt="" class="admin-cat-thumb">`;
                }
                const groupKey = c.parent_id == null ? 'root' : String(c.parent_id);
                const group = groups[groupKey] || [c];
                let idx = 0;
                for (let i = 0; i < group.length; i += 1) {
                    if (Number(group[i].id) === Number(c.id)) {
                        idx = i;
                        break;
                    }
                }
                let moveBtns = '';
                if (idx > 0) {
                    moveBtns += `<button type="button" class="admin-cat-move admin-cat-move-up" data-id="${c.id}" title="Вгору">↑</button>`;
                }
                if (idx < group.length - 1) {
                    moveBtns += `<button type="button" class="admin-cat-move admin-cat-move-down" data-id="${c.id}" title="Вниз">↓</button>`;
                }
                return `<tr class="admin-cat-row" data-name="${api.escapeHtml(c.name)}" data-parent="${api.escapeHtml(parentName === '—' ? '' : parentName)}">
                    <td>${c.id}</td>
                    <td class="admin-cat-move-cell">${moveBtns || '—'}</td>
                    <td>${photoCell}</td>
                    <td>${api.escapeHtml(c.name)}</td>
                    <td>${api.escapeHtml(parentName)}</td>
                    <td>${c.parent_id == null && Number(c.is_packaging) === 1 ? 'Так' : '—'}</td>
                    <td>
                        <button type="button" class="admin-edit-btn admin-cat-edit" data-id="${c.id}">Редагувати</button>
                        <button type="button" class="admin-secondary-btn admin-cat-delete" data-id="${c.id}">Видалити</button>
                    </td>
                </tr>`;
            })
            .join('');

        content.innerHTML = `
            <h3>Категорії</h3>
            <form id="admin-category-form" class="admin-form admin-form-inline">
                <label>Назва <input name="name" type="text" required></label>
                <label>Батьківська
                    <select name="parent_id" id="admin-category-parent">
                        <option value="">Без батьківської</option>
                        ${parentOptions}
                    </select>
                </label>
                <label class="auth-label auth-label--checkbox" id="admin-category-pack-wrap">
                    <input type="checkbox" name="is_packaging" value="1">
                    Упаковка (конструктор)
                </label>
                <label>Фото <input name="image" type="file" accept="image/jpeg,image/png,image/gif,image/webp"></label>
                <button type="submit" class="admin-primary-btn">Додати</button>
            </form>
            <div class="admin-filters">
                <label>Пошук <input type="search" id="admin-category-search" placeholder="Назва категорії"></label>
                <span id="admin-category-search-count"></span>
            </div>
            <div id="admin-category-edit-panel" class="admin-category-edit-panel" hidden>
                <h4>Редагування категорії</h4>
                <form id="admin-category-edit-form" class="admin-form">
                    <input type="hidden" name="id" id="admin-category-edit-id">
                    <label>Назва <input name="name" id="admin-category-edit-name" type="text" required></label>
                    <label>Батьківська
                        <select name="parent_id" id="admin-category-edit-parent">
                            <option value="">Без батьківської</option>
                        </select>
                    </label>
                    <label class="auth-label auth-label--checkbox" id="admin-category-edit-pack-wrap">
                        <input type="checkbox" name="is_packaging" id="admin-category-edit-packaging" value="1">
                        Упаковка (конструктор)
                    </label>
                    <img id="admin-category-edit-preview" class="admin-cat-thumb admin-cat-edit-preview" alt="" hidden>
                    <label>Нове фото <input name="image" id="admin-category-edit-image" type="file" accept="image/jpeg,image/png,image/gif,image/webp"></label>
                    <div class="admin-form-actions">
                        <button type="submit" class="admin-primary-btn">Зберегти</button>
                        <button type="button" class="admin-secondary-btn" id="admin-category-edit-cancel">Скасувати</button>
                    </div>
                </form>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>ID</th><th>Порядок</th><th>Фото</th><th>Назва</th><th>Батьківська</th><th>Упаковка</th><th>Дії</th></tr></thead>
                    <tbody id="admin-category-tbody">
                        ${rows}
                        <tr id="admin-category-empty-search" hidden><td colspan="7">Немає збігів</td></tr>
                        ${!rows ? '<tr><td colspan="7">Немає категорій</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;

        const syncCategoryPackVisibility = (parentSelect, packWrap) => {
            if (!parentSelect || !packWrap) {
                return;
            }
            const isRoot = !parentSelect.value;
            packWrap.hidden = !isRoot;
            if (!isRoot) {
                const cb = packWrap.querySelector('input[name="is_packaging"]');
                if (cb) {
                    cb.checked = false;
                }
            }
        };

        const parentSelectCreate = document.getElementById('admin-category-parent');
        const packWrapCreate = document.getElementById('admin-category-pack-wrap');
        if (parentSelectCreate) {
            parentSelectCreate.addEventListener('change', () => {
                syncCategoryPackVisibility(parentSelectCreate, packWrapCreate);
            });
            syncCategoryPackVisibility(parentSelectCreate, packWrapCreate);
        }

        document.getElementById('admin-category-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                const created = await api.apiFetch('/api/admin/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: fd.get('name'),
                        parent_id: fd.get('parent_id') || null,
                        is_packaging: fd.get('is_packaging') === '1' ? 1 : 0
                    })
                });
                const file = fd.get('image');
                if (file && file.size > 0 && created.id) {
                    await api.uploadCategoryPhoto(created.id, file);
                }
                if (e.target._formDraftHandle && e.target._formDraftHandle.clear) {
                    e.target._formDraftHandle.clear();
                }
                api.showMessage('Категорію додано');
                api.setActiveMenu('categories');
                await renderCategories(api);
            } catch (err) {
                api.showMessage(err.message, true);
            }
        });

        const searchInput = document.getElementById('admin-category-search');
        const searchCount = document.getElementById('admin-category-search-count');
        const emptyRow = document.getElementById('admin-category-empty-search');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const q = searchInput.value.trim().toLowerCase();
                const catRows = content.querySelectorAll('tr.admin-cat-row');
                let shown = 0;
                catRows.forEach((row) => {
                    const name = (row.getAttribute('data-name') || '').toLowerCase();
                    const parent = (row.getAttribute('data-parent') || '').toLowerCase();
                    const ok = !q || name.indexOf(q) !== -1 || parent.indexOf(q) !== -1;
                    row.hidden = !ok;
                    if (ok) {
                        shown += 1;
                    }
                });
                if (emptyRow) {
                    emptyRow.hidden = !q || shown > 0;
                }
                if (searchCount) {
                    searchCount.textContent = q ? `Показано: ${shown}` : '';
                }
            });
        }

        content.querySelectorAll('.admin-cat-move-up').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    await api.apiFetch(`/api/admin/categories/${id}/move`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ direction: 'up' })
                    });
                    await renderCategories(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-cat-move-down').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    await api.apiFetch(`/api/admin/categories/${id}/move`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ direction: 'down' })
                    });
                    await renderCategories(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-cat-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Видалити категорію?')) {
                    return;
                }
                try {
                    await api.apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
                    api.showMessage('Категорію видалено');
                    await renderCategories(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        });

        const editPanel = document.getElementById('admin-category-edit-panel');
        const editForm = document.getElementById('admin-category-edit-form');
        const editParent = document.getElementById('admin-category-edit-parent');
        const editPreview = document.getElementById('admin-category-edit-preview');
        const packWrapEdit = document.getElementById('admin-category-edit-pack-wrap');

        if (editParent) {
            editParent.onchange = () => {
                syncCategoryPackVisibility(editParent, packWrapEdit);
            };
        }

        content.querySelectorAll('.admin-cat-edit').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                const cat = list.find((x) => Number(x.id) === id);
                if (!cat) {
                    return;
                }
                document.getElementById('admin-category-edit-id').value = String(cat.id);
                document.getElementById('admin-category-edit-name').value = cat.name || '';
                let parentHtml = '<option value="">Без батьківської</option>';
                for (let i = 0; i < parents.length; i += 1) {
                    const p = parents[i];
                    if (Number(p.id) === Number(cat.id)) {
                        continue;
                    }
                    const sel = Number(p.id) === Number(cat.parent_id) ? ' selected' : '';
                    parentHtml += `<option value="${p.id}"${sel}>${api.escapeHtml(p.name)}</option>`;
                }
                editParent.innerHTML = parentHtml;
                const packCb = document.getElementById('admin-category-edit-packaging');
                if (packCb) {
                    packCb.checked = cat.parent_id == null && Number(cat.is_packaging) === 1;
                }
                syncCategoryPackVisibility(editParent, packWrapEdit);
                document.getElementById('admin-category-edit-image').value = '';
                if (cat.image_url) {
                    editPreview.src = cat.image_url;
                    editPreview.hidden = false;
                } else {
                    editPreview.removeAttribute('src');
                    editPreview.hidden = true;
                }
                editPanel.hidden = false;
                bindAdminDraft(editForm, 'flowersgo_admin_category_draft:' + String(cat.id), {
                    notifyMessage: 'Чернетку категорії відновлено',
                    onRestore: function () {
                        editPanel.hidden = false;
                        syncCategoryPackVisibility(editParent, packWrapEdit);
                    }
                });
            });
        });

        document.getElementById('admin-category-edit-cancel').addEventListener('click', () => {
            editPanel.hidden = true;
        });

        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(editForm);
            const id = fd.get('id');
            try {
                await api.apiFetch(`/api/admin/categories/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: String(fd.get('name') || '').trim(),
                        parent_id: fd.get('parent_id') || null,
                        is_packaging: fd.get('is_packaging') === '1' ? 1 : 0
                    })
                });
                const file = fd.get('image');
                if (file && file.size > 0) {
                    await api.uploadCategoryPhoto(id, file);
                }
                editPanel.hidden = true;
                if (editForm._formDraftHandle && editForm._formDraftHandle.clear) {
                    editForm._formDraftHandle.clear();
                }
                api.showMessage('Категорію оновлено');
                await renderCategories(api);
            } catch (err) {
                api.showMessage(err.message, true);
            }
        });

        bindAdminDraft(document.getElementById('admin-category-form'), 'flowersgo_admin_category_draft:new', {
            notifyMessage: 'Чернетку нової категорії відновлено',
            onRestore: function () {
                syncCategoryPackVisibility(parentSelectCreate, packWrapCreate);
            }
        });
    };

    const renderOrderDetail = async (api, orderId, backTo) => {
        if (typeof api.showAdminLoading === 'function') {
            api.showAdminLoading('Завантаження замовлення…');
        }
        if (window.adminNav && typeof window.adminNav.setCrumb === 'function') {
            window.adminNav.setCrumb('Замовлення №' + orderId);
        }

        let data;
        try {
            data = await api.apiFetch(`/api/admin/orders/${orderId}/detail`);
        } catch (err) {
            api.showMessage(err.message, true);
            if (window.adminNav && typeof window.adminNav.setCrumb === 'function') {
                window.adminNav.setCrumb('');
            }
            return;
        }

        const o = data.order || {};
        const items = data.items || [];
        const statusLog = data.status_log || [];
        const backMode = backTo || 'ordersAll';
        let backLabel = '← До списку';
        if (backMode === 'moderation') {
            backLabel = '← До модерації';
        } else if (backMode === 'awaiting') {
            backLabel = '← До очікування оплати';
        }

        let courierBlock = '';
        const canAssignCourier =
            o.delivery_method !== 'pickup' &&
            (o.status_name === 'processing' ||
                o.status_name === 'ready_for_pickup' ||
                o.status_name === 'shipped');

        if (canAssignCourier) {
            let courierData;
            try {
                courierData = await api.apiFetch('/api/admin/couriers');
            } catch (err) {
                courierData = { couriers: [] };
            }
            const couriers = Array.isArray(courierData.couriers) ? courierData.couriers : [];
            let opts = '<option value="">— обрати —</option>';
            for (let i = 0; i < couriers.length; i++) {
                const c = couriers[i];
                const name =
                    [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Кур\'єр';
                const selected = Number(o.courier_id) === Number(c.id) ? ' selected' : '';
                opts +=
                    '<option value="' +
                    c.id +
                    '"' +
                    selected +
                    '>' +
                    api.escapeHtml(name) +
                    ' (на зміні: ' +
                    (Number(c.courier_on_shift) === 1 ? 'так' : 'ні') +
                    ')</option>';
            }

            courierBlock = `
                <section class="admin-order-card">
                    <h4>Кур'єр</h4>
                    <p><strong>Поточний:</strong> ${api.escapeHtml(o.courier_name || 'Не призначено')}</p>
                    <label class="auth-label">Призначити
                        <select id="admin-assign-courier-select">${opts}</select>
                    </label>
                    <div class="admin-order-courier-actions">
                        <button type="button" class="admin-primary-btn" id="admin-assign-courier-btn">Зберегти кур'єра</button>
                        ${!Number(o.courier_id) &&
                        (o.status_name === 'processing' || o.status_name === 'ready_for_pickup') ? `
                        <button type="button" class="admin-secondary-btn" id="admin-auto-assign-btn">Авто-призначити</button>
                        ` : ''}
                        ${Number(o.courier_id) > 0 &&
                        (o.status_name === 'processing' || o.status_name === 'ready_for_pickup') ? `
                        <button type="button" class="admin-secondary-btn" id="admin-unassign-courier-btn">Зняти кур'єра</button>
                        <button type="button" class="admin-secondary-btn" id="admin-unassign-reassign-btn">Зняти і авто-призначити</button>
                        ` : ''}
                    </div>
                </section>`;
        }

        const itemRows = items
            .map((it) => {
                const sum = Number(it.unit_price || 0) * Number(it.quantity || 0);
                const colorHint = it.color_name
                    ? '<br><span class="admin-muted-hint">' + api.escapeHtml(it.color_name) + '</span>'
                    : '';
                return `<tr><td>${api.escapeHtml(it.product_name)}${colorHint}</td><td>${it.quantity}</td><td>${Number(it.unit_price || 0).toLocaleString('uk-UA')} грн</td><td>${sum.toLocaleString('uk-UA')} грн</td></tr>`;
            })
            .join('');

        const cancelBlock = o.cancel_request_at
            ? `<div class="admin-order-alert admin-order-alert--warn">
                <p><strong>Запит на скасування</strong> (${api.escapeHtml(formatAdminDateTime(o.cancel_request_at))})</p>
                <p>${api.escapeHtml(o.cancel_request_note || 'без коментаря')}</p>
                <div class="admin-order-moderation-actions">
                    <button type="button" class="admin-primary-btn" id="admin-detail-cancel-approve">Підтвердити скасування</button>
                    <button type="button" class="admin-secondary-btn" id="admin-detail-cancel-reject">Відхилити запит</button>
                </div>
               </div>`
            : '';

        const moderationBlock =
            Number(o.admin_approved) === 0 &&
            (o.payment_status === 'paid' || o.payment_status === 'cod')
                ? `<div class="admin-order-alert">
                <p><strong>Замовлення чекає модерації</strong> — підтвердіть перед відправкою на склад.</p>
                <div class="admin-order-moderation-actions">
                <button type="button" class="admin-primary-btn" id="admin-detail-approve">На склад</button>
                <button type="button" class="admin-secondary-btn" id="admin-detail-reject">Відхилити</button>
                </div>
               </div>`
                : '';

        const showWarehouseLink =
            Number(o.admin_approved) === 1 && o.status_name !== 'cancelled' && o.status_name !== 'rejected';
        const warehouseLink = showWarehouseLink
            ? `<a class="admin-link-btn" href="/warehouse/orders/${o.id}" target="_blank" rel="noopener">Склад ↗</a>`
            : '';

        const liqpayRef = o.liqpay_last_ref
            ? `<p><strong>LiqPay ref:</strong> <code class="admin-code">${api.escapeHtml(o.liqpay_last_ref)}</code></p>`
            : '';
        const refundBlock =
            o.refund_status || o.payment_status === 'refunded'
                ? `<p><strong>Повернення:</strong> ${api.escapeHtml(refundStatusLabel(o.refund_status))}${
                      o.refunded_at ? ' (' + api.escapeHtml(formatAdminDateTime(o.refunded_at)) + ')' : ''
                  }</p>`
                : '';
        const paymentDeadline =
            o.payment_status === 'unpaid' && o.payment_deadline_at
                ? `<p><strong>Дедлайн оплати:</strong> ${api.escapeHtml(formatAdminDateTime(o.payment_deadline_at))}</p>`
                : '';

        const recipientNote = o.recipient_note_display
            ? `<p><strong>Примітка одержувачу:</strong> ${api.escapeHtml(o.recipient_note_display)}</p>`
            : '';
        const bouquetNote = o.bouquet_note_display
            ? `<p><strong>Примітка до букета:</strong> ${api.escapeHtml(o.bouquet_note_display)}</p>`
            : '';
        const deliveryPlace = o.delivery_place || o.delivery_address || '—';

        content.innerHTML = `
            <div class="admin-order-head">
                <button type="button" class="admin-secondary-btn" id="admin-back-orders-all">${backLabel}</button>
                <div class="admin-order-head__main">
                    <h3>Замовлення №${o.id}</h3>
                    <p class="admin-order-meta">Створено: ${api.escapeHtml(formatAdminDateTime(o.createdAt))} ${warehouseLink}</p>
                </div>
            </div>
            ${moderationBlock}
            ${cancelBlock}
            <div class="admin-order-grid">
                <section class="admin-order-card">
                    <h4>Статус і оплата</h4>
                    <p><strong>Статус:</strong> ${api.escapeHtml(o.status_label || o.status_name || '—')}</p>
                    <p><strong>Модерація:</strong> ${api.escapeHtml(adminApprovedLabel(o.admin_approved))}</p>
                    <p><strong>Оплата:</strong> ${api.escapeHtml(paymentInfoText(o))}</p>
                    ${paymentDeadline}
                    ${liqpayRef}
                    ${refundBlock}
                    <p><strong>Сума:</strong> ${Number(o.total_price || 0).toLocaleString('uk-UA')} грн</p>
                </section>
                <section class="admin-order-card">
                    <h4>Клієнт і доставка</h4>
                    <p><strong>Клієнт:</strong> ${api.escapeHtml(o.first_name || '')} ${api.escapeHtml(o.last_name || '')}</p>
                    <p><strong>Email:</strong> ${api.escapeHtml(o.customer_email || '—')}</p>
                    <p><strong>Телефон:</strong> ${api.escapeHtml(o.customer_phone || '—')}</p>
                    <p><strong>Одержувач:</strong> ${api.escapeHtml(o.receiver_name || '—')} ${api.escapeHtml(o.receiver_phone || '')}</p>
                    <p><strong>Спосіб:</strong> ${api.escapeHtml(deliveryMethodLabel(o.delivery_method))}</p>
                    <p><strong>Дата доставки:</strong> ${api.escapeHtml(o.delivery_display || '—')}</p>
                    <p><strong>Адреса:</strong><br>${api.escapeHtml(deliveryPlace)}</p>
                    ${recipientNote}
                    ${bouquetNote}
                </section>
            </div>
            ${courierBlock}
            <h4 class="admin-section-head">Товари</h4>
            <div class="admin-table-wrap">
            <table class="admin-table">
                <thead><tr><th>Назва</th><th>К-сть</th><th>Ціна</th><th>Сума</th></tr></thead>
                <tbody>${itemRows || '<tr><td colspan="4">—</td></tr>'}</tbody>
            </table>
            </div>
            <h4 class="admin-section-head">Історія статусів</h4>
            ${renderStatusTimeline(api, statusLog)}
        `;

        document.getElementById('admin-back-orders-all').addEventListener('click', () => {
            if (window.adminNav && typeof window.adminNav.setCrumb === 'function') {
                window.adminNav.setCrumb('');
            }
            if (backMode === 'moderation') {
                api.setActiveMenu('orders');
                api.loadPendingOrders();
            } else if (backMode === 'awaiting') {
                api.setActiveMenu('orders-awaiting');
                api.loadAwaitingPaymentOrders();
            } else {
                api.setActiveMenu('ordersAll');
                loadAllOrders(api);
            }
        });

        const detailApproveBtn = document.getElementById('admin-detail-approve');
        if (detailApproveBtn) {
            detailApproveBtn.addEventListener('click', async () => {
                if (!window.confirm('Підтвердити замовлення і відправити на склад?')) {
                    return;
                }
                try {
                    await api.apiFetch(`/api/admin/orders/${orderId}/approve`, { method: 'POST' });
                    api.showMessage('Замовлення відправлено на склад');
                    api.setActiveMenu('orders');
                    await api.loadPendingOrders();
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        const detailRejectBtn = document.getElementById('admin-detail-reject');
        if (detailRejectBtn) {
            detailRejectBtn.addEventListener('click', async () => {
                if (!window.confirm('Відхилити це замовлення? На склад воно не потрапить.')) {
                    return;
                }
                try {
                    await api.apiFetch(`/api/admin/orders/${orderId}/reject`, { method: 'POST' });
                    api.showMessage('Замовлення відхилено');
                    api.setActiveMenu('orders');
                    await api.loadPendingOrders();
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        const approveCancelBtn = document.getElementById('admin-detail-cancel-approve');
        if (approveCancelBtn) {
            approveCancelBtn.addEventListener('click', async () => {
                if (!window.confirm('Підтвердити скасування замовлення? Для оплачених замовлень буде запит на повернення LiqPay.')) {
                    return;
                }
                try {
                    const data = await api.apiFetch(`/api/admin/orders/${orderId}/cancel/approve`, { method: 'POST' });
                    api.showMessage(data.message || 'Скасовано');
                    await renderOrderDetail(api, orderId);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        const rejectCancelBtn = document.getElementById('admin-detail-cancel-reject');
        if (rejectCancelBtn) {
            rejectCancelBtn.addEventListener('click', async () => {
                try {
                    const data = await api.apiFetch(`/api/admin/orders/${orderId}/cancel/reject`, { method: 'POST' });
                    api.showMessage(data.message || 'Запит відхилено');
                    await renderOrderDetail(api, orderId);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        const assignBtn = document.getElementById('admin-assign-courier-btn');
        if (assignBtn) {
            assignBtn.addEventListener('click', async () => {
                const sel = document.getElementById('admin-assign-courier-select');
                const courierId = sel ? sel.value : '';
                if (!courierId) {
                    api.showMessage('Оберіть кур\'єра', true);
                    return;
                }
                try {
                    const data = await api.apiFetch(`/api/admin/orders/${orderId}/assign-courier`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ courier_id: Number(courierId) })
                    });
                    api.showMessage(data.message || 'Кур\'єра призначено');
                    await renderOrderDetail(api, orderId);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        const bindUnassign = (btnId, autoReassign) => {
            const btn = document.getElementById(btnId);
            if (!btn) {
                return;
            }
            btn.addEventListener('click', async () => {
                const msg = autoReassign
                    ? 'Зняти поточного кур\'єра і спробувати призначити іншого?'
                    : 'Зняти кур\'єра з цього замовлення?';
                if (!window.confirm(msg)) {
                    return;
                }
                try {
                    const data = await api.apiFetch(`/api/admin/orders/${orderId}/unassign-courier`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ auto_reassign: autoReassign })
                    });
                    api.showMessage(data.message || 'Кур\'єра знято');
                    await renderOrderDetail(api, orderId);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        };

        bindUnassign('admin-unassign-courier-btn', false);
        bindUnassign('admin-unassign-reassign-btn', true);

        const autoAssignBtn = document.getElementById('admin-auto-assign-btn');
        if (autoAssignBtn) {
            autoAssignBtn.addEventListener('click', async () => {
                try {
                    const data = await api.apiFetch(`/api/admin/orders/${orderId}/auto-assign-courier`, {
                        method: 'POST'
                    });
                    api.showMessage(data.message || 'Кур\'єра призначено');
                    await renderOrderDetail(api, orderId);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }
    };

    const loadAllOrders = async (api, filter, search) => {
        const f = filter || 'all';
        const q = search || '';
        try {
            const data = await api.apiFetch(`/api/admin/orders/all?filter=${encodeURIComponent(f)}&q=${encodeURIComponent(q)}`);
            const orders = data.orders || [];
            const rows = orders
                .map((o) => {
                    return `<tr>
                        <td>${o.id}</td>
                        <td>${api.escapeHtml(o.status_label || o.status_name || '—')}<br><span class="warehouse-orders-email">${api.escapeHtml(adminApprovedLabel(o.admin_approved))}</span></td>
                        <td>${api.escapeHtml(paymentInfoText(o))}</td>
                        <td>${api.escapeHtml(o.first_name || '')} ${api.escapeHtml(o.last_name || '')}</td>
                        <td>${Number(o.total_price || 0).toLocaleString('uk-UA')} грн</td>
                        <td><button type="button" class="admin-edit-btn admin-order-open" data-id="${o.id}">Деталі</button></td>
                    </tr>`;
                })
                .join('');

            content.innerHTML = `
                <h3>Всі замовлення</h3>
                <div class="admin-filters">
                    <label>Статус
                    <select id="admin-orders-filter">
                        <option value="all" ${f === 'all' ? 'selected' : ''}>Усі</option>
                        <option value="pending" ${f === 'pending' ? 'selected' : ''}>На модерації</option>
                        <option value="awaiting_unpaid" ${f === 'awaiting_unpaid' ? 'selected' : ''}>Очікують оплату</option>
                        <option value="warehouse" ${f === 'warehouse' ? 'selected' : ''}>На складі</option>
                        <option value="unassigned" ${f === 'unassigned' ? 'selected' : ''}>Без кур'єра</option>
                        <option value="cancel_requests" ${f === 'cancel_requests' ? 'selected' : ''}>Запити на скасування</option>
                        <option value="rejected" ${f === 'rejected' ? 'selected' : ''}>Відхилені</option>
                    </select>
                    </label>
                    <label>Пошук <input type="search" id="admin-orders-search" placeholder="№, телефон, email" value="${api.escapeHtml(q)}"></label>
                    <span id="admin-orders-search-count">${q ? `Показано: ${orders.length}` : ''}</span>
                </div>
                <div class="admin-table-wrap" data-list-pager data-list-pager-item="tbody tr">
                    <table class="admin-table">
                        <thead><tr><th>№</th><th>Статус</th><th>Оплата</th><th>Клієнт</th><th>Сума</th><th></th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="6">Замовлень немає</td></tr>'}</tbody>
                    </table>
                </div>
            `;

            if (window.ListPager) {
                const wrap = content.querySelector('.admin-table-wrap[data-list-pager]');
                if (wrap) {
                    window.ListPager.mount(wrap);
                }
            }

            const runOrdersSearch = () => {
                const nf = document.getElementById('admin-orders-filter').value;
                const nq = document.getElementById('admin-orders-search').value;
                loadAllOrders(api, nf, nq);
            };

            document.getElementById('admin-orders-filter').addEventListener('change', runOrdersSearch);

            document.getElementById('admin-orders-search').addEventListener('input', () => {
                clearTimeout(ordersSearchTimer);
                ordersSearchTimer = setTimeout(runOrdersSearch, 350);
            });

            content.querySelectorAll('.admin-order-open').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    try {
                        await renderOrderDetail(api, btn.getAttribute('data-id'), 'ordersAll');
                    } catch (err) {
                        api.showMessage(err.message, true);
                    }
                });
            });
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    const reasonLabelFromUser = (reasons, user) => {
        const key = user.block_reason_key || '';
        if (key === 'other') {
            return user.block_reason_text || 'Інша причина';
        }
        for (let i = 0; i < reasons.length; i++) {
            if (reasons[i].key === key) {
                return reasons[i].label;
            }
        }
        return '—';
    };

    const renderBlockPanel = (api, reasons, userId, userEmail, onDone) => {
        const old = document.getElementById('admin-block-panel');
        if (old) {
            old.remove();
        }

        let opts = '';
        for (let i = 0; i < reasons.length; i++) {
            opts += '<option value="' + api.escapeHtml(reasons[i].key) + '">' + api.escapeHtml(reasons[i].label) + '</option>';
        }

        const panel = document.createElement('div');
        panel.id = 'admin-block-panel';
        panel.className = 'admin-block-panel';
        panel.innerHTML = `
            <h4>Блокування: ${api.escapeHtml(userEmail || '')}</h4>
            <label class="auth-label">Причина
                <select id="admin-block-reason-key">${opts}</select>
            </label>
            <label class="auth-label" id="admin-block-other-wrap" hidden>Опишіть причину
                <textarea id="admin-block-reason-text" rows="3" maxlength="500"></textarea>
            </label>
            <div class="admin-filters">
                <button type="button" class="admin-primary-btn" id="admin-block-confirm">Заблокувати</button>
                <button type="button" class="admin-secondary-btn" id="admin-block-cancel">Скасувати</button>
            </div>
        `;

        const filters = content.querySelector('.admin-filters');
        if (filters && filters.parentNode) {
            filters.parentNode.insertBefore(panel, filters.nextSibling);
        } else {
            content.prepend(panel);
        }

        const keySel = document.getElementById('admin-block-reason-key');
        const otherWrap = document.getElementById('admin-block-other-wrap');

        const syncOther = () => {
            otherWrap.hidden = keySel.value !== 'other';
        };
        keySel.addEventListener('change', syncOther);
        syncOther();

        document.getElementById('admin-block-cancel').addEventListener('click', () => {
            panel.remove();
        });

        document.getElementById('admin-block-confirm').addEventListener('click', async () => {
            const reason_key = keySel.value;
            const reason_text = document.getElementById('admin-block-reason-text').value.trim();
            try {
                await api.apiFetch(`/api/admin/users/${userId}/block`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        blocked: true,
                        reason_key,
                        reason_text
                    })
                });
                api.showMessage('Заблоковано');
                panel.remove();
                if (onDone) {
                    onDone();
                }
            } catch (err) {
                api.showMessage(err.message, true);
            }
        });
    };

    const loadUsers = async (api, search) => {
        const q = search || '';
        try {
            const usersData = await api.apiFetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
            const users = usersData.users || [];
            const reasons = usersData.reasons || [];
            const rows = users
                .map((u) => {
                    const blocked = Number(u.is_blocked) === 1;
                    const reasonText = reasonLabelFromUser(reasons, u);
                    const blockCell = blocked
                        ? `<div class="admin-block-cell">
                            <span class="admin-block-cell__label">Заблоковано</span>
                            <button type="button" class="admin-link-btn admin-user-reason" data-reason="${api.escapeHtml(reasonText)}">Причина</button>
                           </div>`
                        : '—';
                    const savedAddress = formatUserSavedAddress(u);
                    return `<tr>
                        <td>${u.id}</td>
                        <td>${api.escapeHtml(u.first_name || '')} ${api.escapeHtml(u.last_name || '')}</td>
                        <td>${api.escapeHtml(u.email || '')}</td>
                        <td>${api.escapeHtml(u.phone || '—')}</td>
                        <td class="admin-user-address-cell">${api.escapeHtml(savedAddress)}</td>
                        <td>
                            <select class="admin-user-role" data-id="${u.id}">
                                <option value="user" ${u.role_name === 'user' ? 'selected' : ''}>Клієнт</option>
                                <option value="warehouse_worker" ${u.role_name === 'warehouse_worker' ? 'selected' : ''}>Склад</option>
                                <option value="courier" ${u.role_name === 'courier' ? 'selected' : ''}>Кур'єр</option>
                                <option value="admin" ${u.role_name === 'admin' ? 'selected' : ''}>Адмін</option>
                            </select>
                        </td>
                        <td>${blockCell}</td>
                        <td>
                            <button type="button" class="admin-secondary-btn admin-user-block" data-id="${u.id}" data-email="${api.escapeHtml(u.email || '')}" data-blocked="${blocked ? '0' : '1'}">${blocked ? 'Розблокувати' : 'Блок'}</button>
                        </td>
                    </tr>`;
                })
                .join('');

            content.innerHTML = `
                <h3>Користувачі</h3>
                <div class="admin-filters">
                    <label>Пошук <input type="search" id="admin-users-search" placeholder="Email, телефон, ім'я" value="${api.escapeHtml(q)}"></label>
                    <span id="admin-users-search-count">${q ? `Показано: ${users.length}` : ''}</span>
                </div>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead><tr><th>ID</th><th>Ім'я</th><th>Email</th><th>Телефон</th><th>Адреса</th><th>Роль</th><th>Блок</th><th></th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="8">Немає користувачів</td></tr>'}</tbody>
                    </table>
                </div>
            `;

            document.getElementById('admin-users-search').addEventListener('input', () => {
                clearTimeout(usersSearchTimer);
                usersSearchTimer = setTimeout(() => {
                    loadUsers(api, document.getElementById('admin-users-search').value);
                }, 350);
            });

            content.querySelectorAll('.admin-user-role').forEach((sel) => {
                sel.addEventListener('change', async () => {
                    const id = sel.getAttribute('data-id');
                    try {
                        await api.apiFetch(`/api/admin/users/${id}/role`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ role_name: sel.value })
                        });
                        api.showMessage('Роль змінено');
                    } catch (err) {
                        api.showMessage(err.message, true);
                        loadUsers(api, q);
                    }
                });
            });

            content.querySelectorAll('.admin-user-reason').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const reason = btn.getAttribute('data-reason') || 'Причину не вказано';
                    api.showMessage('Причина блокування: ' + reason);
                });
            });

            content.querySelectorAll('.admin-user-block').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const email = btn.getAttribute('data-email') || '';
                    const blocked = btn.getAttribute('data-blocked') === '1';
                    if (blocked) {
                        renderBlockPanel(api, reasons, id, email, () => loadUsers(api, q));
                        return;
                    }
                    if (!window.confirm('Розблокувати цього користувача?')) {
                        return;
                    }
                    try {
                        await api.apiFetch(`/api/admin/users/${id}/block`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ blocked: false })
                        });
                        api.showMessage('Розблоковано');
                        loadUsers(api, q);
                    } catch (err) {
                        api.showMessage(err.message, true);
                    }
                });
            });
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    const renderConstructorProductList = (api, products) => {
        const rows = products
            .map(
                (p) => {
                    const preview = p.preview_image_url || p.image_url || '';
                    const stockTotal = Number(p.variant_stock_total != null ? p.variant_stock_total : p.stock_quantity || 0);
                    return `
            <tr class="admin-constructor-product-row" data-name="${api.escapeHtml(p.name)}" data-category="${api.escapeHtml(p.category_name || '')}" data-id="${p.id}">
                <td>${p.id}</td>
                <td class="admin-table-photo">${
                    preview
                        ? `<img class="admin-table-thumb" src="${api.escapeHtml(preview)}" alt="">`
                        : '—'
                }</td>
                <td>${api.escapeHtml(p.name)}</td>
                <td>${api.escapeHtml(p.category_name || '')}</td>
                <td>${Number(p.colors_count || 0)}</td>
                <td>${api.escapeHtml(p.sale_price)}</td>
                <td>${stockTotal}</td>
                <td>${Number(p.is_active) === 1 ? 'Так' : 'Ні'}</td>
                <td>
                    <button type="button" class="admin-edit-btn admin-constructor-colors" data-id="${p.id}" data-name="${api.escapeHtml(p.name)}">Кольори</button>
                    <button type="button" class="admin-edit-btn admin-constructor-edit" data-id="${p.id}">Редагувати</button>
                    <button type="button" class="admin-secondary-btn admin-constructor-delete" data-id="${p.id}">В архів</button>
                </td>
            </tr>
        `;
                }
            )
            .join('');

        return `
            <div class="admin-constructor-products">
                <div class="admin-constructor-products__head">
                    <h4>Квіти для конструктора</h4>
                    <button type="button" id="admin-constructor-add-product" class="admin-primary-btn">Додати квітку</button>
                </div>
                <div class="admin-filters">
                    <label>Пошук <input type="search" id="admin-constructor-product-search" placeholder="Назва, категорія, ID"></label>
                    <span id="admin-constructor-product-search-count"></span>
                </div>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Фото</th>
                                <th>Назва</th>
                                <th>Категорія</th>
                                <th>Кольорів</th>
                                <th>Ціна</th>
                                <th>Склад</th>
                                <th>Активний</th>
                                <th>Дія</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                            <tr id="admin-constructor-product-empty-search" hidden><td colspan="9">Немає збігів</td></tr>
                            ${!rows ? '<tr><td colspan="9">Квітів для конструктора ще немає</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
                <div id="admin-constructor-colors-panel" class="admin-constructor-colors-panel" hidden></div>
            </div>
        `;
    };

    const renderConstructorColorsPanel = (api, product, colors) => {
        const rows = (colors || [])
            .map(
                (c) => `
            <tr data-variant-id="${c.id}">
                <td class="admin-table-photo">${
                    c.image_url
                        ? `<img class="admin-table-thumb" src="${api.escapeHtml(c.image_url)}" alt="">`
                        : '—'
                }</td>
                <td>
                    <input type="text" class="admin-variant-input admin-variant-color-name" data-id="${c.id}" value="${api.escapeHtml(c.flower_color || '')}" maxlength="50" aria-label="Назва кольору">
                    <input type="color" class="admin-variant-input admin-variant-color-hex" data-id="${c.id}" value="${api.escapeHtml(c.color_hex || '#94a3b8')}" aria-label="Відтінок">
                </td>
                <td><input type="number" min="0" class="admin-variant-input admin-variant-stock" data-id="${c.id}" value="${Number(c.stock_quantity || 0)}" aria-label="Склад"></td>
                <td>
                    <label class="admin-variant-active-label">
                        <input type="checkbox" class="admin-variant-active" data-id="${c.id}"${Number(c.is_active) === 1 ? ' checked' : ''}>
                        Активний
                    </label>
                </td>
                <td class="admin-variant-actions">
                    <button type="button" class="admin-primary-btn admin-variant-save" data-id="${c.id}">Зберегти</button>
                    <label class="admin-inline-file">
                        Фото
                        <input type="file" class="admin-variant-image-input" data-id="${c.id}" accept="image/jpeg,image/png,image/gif,image/webp">
                    </label>
                    <button type="button" class="admin-secondary-btn admin-variant-delete" data-id="${c.id}">Видалити</button>
                </td>
            </tr>
        `
            )
            .join('');

        return `
            <div class="admin-constructor-colors-panel__inner">
                <div class="admin-constructor-colors-panel__head">
                    <h4>Кольори: ${api.escapeHtml(product.name || '')}</h4>
                    <button type="button" id="admin-constructor-colors-close" class="admin-secondary-btn">Закрити</button>
                </div>
                <form id="admin-constructor-color-add-form" class="admin-form admin-constructor-color-add-form">
                    <input type="hidden" name="product_id" value="${product.id}">
                    <label>Назва кольору <input name="flower_color" type="text" maxlength="50" required placeholder="Напр. Червоний"></label>
                    <label>Відтінок <input name="color_hex" type="color" value="#e53935"></label>
                    <label>Склад <input name="stock_quantity" type="number" min="0" value="0"></label>
                    <button type="submit" class="admin-primary-btn">Додати колір</button>
                </form>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Фото</th>
                                <th>Колір</th>
                                <th>Склад</th>
                                <th>Активний</th>
                                <th>Дія</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="5">Ще немає кольорів — додай перший вище</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    const openConstructorColorsPanel = async (api, productId, productName) => {
        const panel = document.getElementById('admin-constructor-colors-panel');
        if (!panel) {
            return;
        }
        try {
            const data = await api.apiFetch(`/api/admin/constructor-products/${productId}/colors`);
            panel.innerHTML = renderConstructorColorsPanel(api, data.product || { id: productId, name: productName }, data.colors || []);
            panel.removeAttribute('hidden');
            bindConstructorColorsPanel(api, productId);
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    const bindConstructorColorsPanel = (api, productId) => {
        const panel = document.getElementById('admin-constructor-colors-panel');
        if (!panel) {
            return;
        }

        const closeBtn = document.getElementById('admin-constructor-colors-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                panel.setAttribute('hidden', '');
                panel.innerHTML = '';
            });
        }

        const addForm = document.getElementById('admin-constructor-color-add-form');
        if (addForm) {
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(addForm);
                const body = {};
                fd.forEach((val, key) => {
                    body[key] = val;
                });
                try {
                    await api.apiFetch(`/api/admin/constructor-products/${productId}/colors`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    api.showMessage('Колір додано');
                    await openConstructorColorsPanel(api, productId);
                    await loadConstructorPage(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        panel.querySelectorAll('.admin-variant-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Видалити цей колір?')) {
                    return;
                }
                try {
                    await api.apiFetch(`/api/admin/constructor-colors/${id}`, { method: 'DELETE' });
                    api.showMessage('Колір видалено');
                    await openConstructorColorsPanel(api, productId);
                    await loadConstructorPage(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        });

        panel.querySelectorAll('.admin-variant-save').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const row = panel.querySelector('tr[data-variant-id="' + id + '"]');
                if (!row) {
                    return;
                }
                const nameInput = row.querySelector('.admin-variant-color-name');
                const hexInput = row.querySelector('.admin-variant-color-hex');
                const stockInput = row.querySelector('.admin-variant-stock');
                const activeInput = row.querySelector('.admin-variant-active');
                const body = {
                    flower_color: nameInput ? String(nameInput.value || '').trim() : '',
                    color_hex: hexInput ? hexInput.value : '',
                    stock_quantity: stockInput ? stockInput.value : 0,
                    is_active: activeInput && activeInput.checked ? 1 : 0
                };
                if (!body.flower_color) {
                    api.showMessage('Вкажіть назву кольору', true);
                    return;
                }
                btn.disabled = true;
                try {
                    await api.apiFetch(`/api/admin/constructor-colors/${id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    api.showMessage('Колір оновлено');
                    await openConstructorColorsPanel(api, productId);
                    await loadConstructorPage(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                } finally {
                    btn.disabled = false;
                }
            });
        });

        panel.querySelectorAll('.admin-variant-image-input').forEach((input) => {
            input.addEventListener('change', async () => {
                const id = input.getAttribute('data-id');
                const file = input.files && input.files[0];
                if (!id || !file) {
                    return;
                }
                const fd = new FormData();
                fd.append('image', file);
                try {
                    const res = await fetch(`/api/admin/constructor-colors/${id}/image`, {
                        method: 'POST',
                        credentials: 'same-origin',
                        body: fd
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(data.message || 'Помилка завантаження');
                    }
                    api.showMessage('Фото збережено');
                    await openConstructorColorsPanel(api, productId);
                    await loadConstructorPage(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
                input.value = '';
            });
        });
    };

    const bindConstructorProductTable = (api) => {
        bindTableSearch(
            'admin-constructor-product-search',
            'admin-constructor-product-search-count',
            'admin-constructor-product-empty-search',
            'tr.admin-constructor-product-row',
            (row) => {
                const name = row.getAttribute('data-name') || '';
                const category = row.getAttribute('data-category') || '';
                const id = row.getAttribute('data-id') || '';
                return `${name} ${category} ${id}`;
            }
        );

        content.querySelectorAll('.admin-constructor-colors').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name') || '';
                await openConstructorColorsPanel(api, id, name);
            });
        });

        const addBtn = document.getElementById('admin-constructor-add-product');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                api.showMessage('');
                try {
                    await api.renderForm({ is_constructor: 1 }, { returnTo: 'constructor' });
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        content.querySelectorAll('.admin-constructor-edit').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    const data = await api.apiFetch(`/api/admin/products/${id}`);
                    await api.renderForm(data.product, { returnTo: 'constructor' });
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-constructor-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Прибрати квітку з конструктора?')) {
                    return;
                }
                try {
                    await api.apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
                    api.showMessage('Товар прибрано');
                    await loadConstructorPage(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        });
    };

    const loadConstructorPage = async (api) => {
        try {
            const productsData = await api.apiFetch('/api/admin/constructor-products');
            const products = Array.isArray(productsData.products) ? productsData.products : [];

            content.innerHTML = `
                <h3>Конструктор букета</h3>
                <p class="admin-muted-hint">Мінімум квіток і вимкнення конструктора — у <code>backend/src/config/constructor.js</code> або змінні <code>CONSTRUCTOR_MIN_STEMS</code>, <code>CONSTRUCTOR_ENABLED</code> у .env.</p>
                ${renderConstructorProductList(api, products)}
                <div id="admin-bouquet-templates-root" class="admin-bouquet-templates-root"></div>
            `;

            bindConstructorProductTable(api);

            if (typeof window.loadBouquetTemplatesAdminSection === 'function') {
                window.loadBouquetTemplatesAdminSection(api, document.getElementById('admin-bouquet-templates-root'));
            }
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    const loadDeliverySettings = async (api) => {
        try {
            const data = await api.apiFetch('/api/admin/delivery-settings');
            const s = data.settings || {};
            const fees = s.fees || {};

            content.innerHTML = `
                <h3>Налаштування доставки</h3>
                <form id="admin-delivery-form" class="admin-form">
                    <label>Робота з <input name="work_start_hour" type="number" min="0" max="23" value="${s.workStartHour}"></label>
                    <label>Робота до <input name="work_end_hour" type="number" min="0" max="23" value="${s.workEndHour}"></label>
                    <label>Слот (год) <input name="slot_hours" type="number" min="1" max="6" value="${s.slotHours}"></label>
                    <label>Буфер стандарт (хв) <input name="standard_buffer_min" type="number" min="0" value="${s.standardBufferMin}"></label>
                    <label>Буфер експрес (хв) <input name="express_buffer_min" type="number" min="0" value="${s.expressBufferMin}"></label>
                    <label>Самовивіз з <input name="pickup_start_hour" type="number" min="0" max="23" value="${s.pickupStartHour}"></label>
                    <label>Самовивіз до <input name="pickup_end_hour" type="number" min="0" max="23" value="${s.pickupEndHour}"></label>
                    <label>Буфер самовивіз (хв) <input name="pickup_buffer_min" type="number" min="0" value="${s.pickupBufferMin}"></label>
                    <label>Ціна стандарт <input name="fee_standard" type="number" min="0" step="1" value="${fees.standard}"></label>
                    <label>Ціна точний час <input name="fee_exact" type="number" min="0" step="1" value="${fees.exact}"></label>
                    <label>Ціна експрес <input name="fee_express" type="number" min="0" step="1" value="${fees.express}"></label>
                    <label>Ціна самовивіз <input name="fee_pickup" type="number" min="0" step="1" value="${fees.pickup}"></label>
                    <button type="submit" class="admin-primary-btn">Зберегти</button>
                </form>
            `;

            document.getElementById('admin-delivery-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const body = {};
                fd.forEach((val, key) => {
                    body[key] = val;
                });
                try {
                    await api.apiFetch('/api/admin/delivery-settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    api.showMessage('Налаштування доставки збережено');
                    if (e.target._formDraftHandle && e.target._formDraftHandle.clear) {
                        e.target._formDraftHandle.clear();
                    }
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });

            bindAdminDraft(document.getElementById('admin-delivery-form'), 'flowersgo_admin_delivery_draft', {
                notifyMessage: 'Чернетку налаштувань доставки відновлено'
            });
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    const safeTextarea = (text) => {
        return String(text || '').replace(/<\/textarea>/gi, '&lt;/textarea&gt;');
    };

    const loadLegalEditor = async (api, slug) => {
        saveAdminView({ view: 'legal-edit', slug: slug });
        const data = await api.apiFetch('/api/admin/legal-pages/' + encodeURIComponent(slug));
        const page = data.page || {};
        const publicUrl = slug === 'privacy' ? '/privacy' : '/delivery-terms';
        content.innerHTML = `
            <button type="button" class="admin-secondary-btn" id="admin-legal-back">← До списку</button>
            <h3>Редагування: ${api.escapeHtml(page.title || slug)}</h3>
            <p class="admin-legal-hint"><a href="${publicUrl}" target="_blank" rel="noopener">Відкрити на сайті</a></p>
            <form id="admin-legal-form" class="admin-form">
                <input type="hidden" name="slug" value="${api.escapeHtml(slug)}">
                <label class="auth-label">Заголовок
                    <input class="auth-input" name="title" type="text" maxlength="200" value="${api.escapeHtml(page.title || '')}" required>
                </label>
                <label class="auth-label">Короткий вступ
                    <textarea class="auth-input admin-legal-lead" name="lead_text" rows="3" maxlength="1000">${safeTextarea(page.lead_text)}</textarea>
                </label>
                <label class="auth-label">Текст сторінки
                    <textarea class="auth-input admin-legal-body" name="body_text" rows="18" required>${safeTextarea(page.body_text)}</textarea>
                </label>
                <button type="submit" class="admin-primary-btn">Зберегти</button>
            </form>
        `;

        document.getElementById('admin-legal-back').addEventListener('click', () => {
            loadLegalPages(api);
        });

        document.getElementById('admin-legal-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                await api.apiFetch('/api/admin/legal-pages/' + encodeURIComponent(slug), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: fd.get('title'),
                        lead_text: fd.get('lead_text'),
                        body_text: fd.get('body_text')
                    })
                });
                api.showMessage('Юридичну сторінку збережено');
                if (e.target._formDraftHandle && e.target._formDraftHandle.clear) {
                    e.target._formDraftHandle.clear();
                }
                await loadLegalEditor(api, slug);
            } catch (err) {
                api.showMessage(err.message, true);
            }
        });

        bindAdminDraft(document.getElementById('admin-legal-form'), 'flowersgo_admin_legal_draft:' + slug, {
            notifyMessage: 'Чернетку юридичної сторінки відновлено'
        });
    };

    const loadLegalPages = async (api) => {
        try {
            const data = await api.apiFetch('/api/admin/legal-pages');
            const pages = data.pages || [];
            let rows = '';
            for (let i = 0; i < pages.length; i++) {
                const p = pages[i];
                const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleString('uk-UA') : '—';
                rows +=
                    '<tr><td>' +
                    api.escapeHtml(p.title || '') +
                    '</td><td>' +
                    api.escapeHtml(p.slug || '') +
                    '</td><td>' +
                    api.escapeHtml(updated) +
                    '</td><td><button type="button" class="admin-edit-btn admin-legal-edit" data-slug="' +
                    api.escapeHtml(p.slug || '') +
                    '">Редагувати</button></td></tr>';
            }

            content.innerHTML = `
                <h3>Юридичні сторінки</h3>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead><tr><th>Назва</th><th>Код</th><th>Оновлено</th><th></th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="4">Сторінок немає</td></tr>'}</tbody>
                    </table>
                </div>
            `;

            content.querySelectorAll('.admin-legal-edit').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const slug = btn.getAttribute('data-slug');
                    try {
                        api.setActiveMenu('legal');
                        await loadLegalEditor(api, slug);
                    } catch (err) {
                        api.showMessage(err.message, true);
                    }
                });
            });
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    const loadCouriers = async (api) => {
        if (typeof api.showAdminLoading === 'function') {
            api.showAdminLoading('Завантаження кур\'єрів…');
        } else {
            content.innerHTML = '<p class="admin-panel-loading">Завантаження...</p>';
        }
        try {
            const data = await api.apiFetch('/api/admin/couriers');
            const list = Array.isArray(data.couriers) ? data.couriers : [];
            const summary = data.summary || {};

            if (list.length === 0) {
                content.innerHTML =
                    '<div class="admin-empty-state"><p>Кур\'єрів немає.</p><p class="admin-muted-hint">Признач роль «Кур\'єр» користувачу в розділі Користувачі.</p></div>';
                return;
            }

            const unassigned = Number(summary.unassigned_courier || 0);
            const onShift = Number(summary.on_shift || 0);

            const rows = list
                .map((c) => {
                    const name =
                        [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || '—';
                    const isOnShift = Number(c.courier_on_shift) === 1;
                    const shiftLabel = isOnShift ? 'На зміні' : 'Не на зміні';
                    const shiftClass = isOnShift ? 'admin-status-badge--active' : 'admin-status-badge--archived';
                    const active = Number(c.active_orders || 0);
                    const queue = Number(c.queue_at_warehouse || 0);
                    const delivering = Number(c.delivering_now || 0);
                    const workEmail = c.courier_work_email || '';
                    return `<tr class="admin-courier-row" data-search="${api.escapeHtml(name + ' ' + (c.email || '') + ' ' + workEmail + ' ' + shiftLabel)}">
                        <td>${api.escapeHtml(name)}</td>
                        <td>${api.escapeHtml(c.email || '')}</td>
                        <td>
                            <input type="email" class="auth-input admin-courier-work-email" data-courier-id="${c.id}" value="${api.escapeHtml(workEmail)}" placeholder="courier@shop.ua" />
                        </td>
                        <td><span class="admin-status-badge ${shiftClass}">${shiftLabel}</span></td>
                        <td>${queue}</td>
                        <td>${delivering}</td>
                        <td>${active}</td>
                        <td class="admin-courier-actions">
                            <button type="button" class="admin-secondary-btn admin-courier-shift" data-courier-id="${c.id}" data-on-shift="${isOnShift ? '1' : '0'}">${isOnShift ? 'Зняти зі зміни' : 'На зміну'}</button>
                            <button type="button" class="admin-edit-btn admin-save-work-email" data-courier-id="${c.id}">Email</button>
                        </td>
                    </tr>`;
                })
                .join('');

            content.innerHTML = `
                <div class="admin-couriers-head">
                    <h3>Кур'єри</h3>
                    <div class="admin-couriers-head__actions">
                        <button type="button" class="admin-primary-btn" id="admin-couriers-auto-assign">Авто-призначити готові</button>
                        <button type="button" class="admin-secondary-btn" id="admin-couriers-unassigned">Без кур'єра (${unassigned})</button>
                    </div>
                </div>
                <div class="admin-courier-summary">
                    <span>На зміні: <strong>${onShift}</strong> / ${list.length}</span>
                    <span>Без кур'єра: <strong class="${unassigned > 0 ? 'admin-text-warn' : ''}">${unassigned}</strong></span>
                </div>
                <div class="admin-filters">
                    <label>Пошук <input type="search" id="admin-couriers-search" placeholder="Ім'я, email"></label>
                    <span id="admin-couriers-search-count"></span>
                </div>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Ім'я</th>
                                <th>Особистий email</th>
                                <th>Робочий email</th>
                                <th>Зміна</th>
                                <th>На складі</th>
                                <th>В дорозі</th>
                                <th>Активних</th>
                                <th>Дії</th>
                            </tr>
                        </thead>
                        <tbody>${rows}<tr id="admin-couriers-empty-search" hidden><td colspan="8">Немає збігів</td></tr></tbody>
                    </table>
                </div>
                <p class="admin-muted-hint admin-couriers-hint">«На складі» — замовлення в комплектації/готові. «В дорозі» — статус shipped. Увімкнення зміни запускає автопризначення готових замовлень.</p>`;

            bindTableSearch(
                'admin-couriers-search',
                'admin-couriers-search-count',
                'admin-couriers-empty-search',
                'tr.admin-courier-row',
                (row) => row.getAttribute('data-search') || ''
            );

            content.querySelectorAll('.admin-save-work-email').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const cid = btn.getAttribute('data-courier-id');
                    const input = content.querySelector('.admin-courier-work-email[data-courier-id="' + cid + '"]');
                    const workEmail = input ? input.value.trim() : '';
                    btn.disabled = true;
                    try {
                        const res = await api.apiFetch('/api/admin/couriers/' + cid + '/work-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ work_email: workEmail })
                        });
                        api.showMessage(res.message || 'Збережено');
                    } catch (err) {
                        api.showMessage(err.message, true);
                    } finally {
                        btn.disabled = false;
                    }
                });
            });

            content.querySelectorAll('.admin-courier-shift').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const cid = btn.getAttribute('data-courier-id');
                    const currentlyOn = btn.getAttribute('data-on-shift') === '1';
                    const nextOn = !currentlyOn;
                    const msg = nextOn
                        ? 'Увімкнути зміну для цього кур\'єра? Готові замовлення можуть авто-призначитись.'
                        : 'Зняти кур\'єра зі зміни? Нові авто-призначення для нього не будуть.';
                    if (!window.confirm(msg)) {
                        return;
                    }
                    btn.disabled = true;
                    try {
                        const res = await api.apiFetch('/api/admin/couriers/' + cid + '/shift', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ on_shift: nextOn ? 1 : 0 })
                        });
                        api.showMessage(res.message || 'Зміну оновлено');
                        await loadCouriers(api);
                        if (window.adminNav && typeof window.adminNav.refreshBadges === 'function') {
                            window.adminNav.refreshBadges(api);
                        }
                    } catch (err) {
                        api.showMessage(err.message, true);
                        btn.disabled = false;
                    }
                });
            });

            const autoAssignBtn = document.getElementById('admin-couriers-auto-assign');
            if (autoAssignBtn) {
                autoAssignBtn.addEventListener('click', async () => {
                    if (!window.confirm('Спробувати авто-призначити всі готові замовлення без кур\'єра?')) {
                        return;
                    }
                    autoAssignBtn.disabled = true;
                    try {
                        const res = await api.apiFetch('/api/admin/couriers/auto-assign-ready', { method: 'POST' });
                        api.showMessage(res.message || 'Готово');
                        await loadCouriers(api);
                        if (window.adminNav && typeof window.adminNav.refreshBadges === 'function') {
                            window.adminNav.refreshBadges(api);
                        }
                    } catch (err) {
                        api.showMessage(err.message, true);
                    } finally {
                        autoAssignBtn.disabled = false;
                    }
                });
            }

            const unassignedBtn = document.getElementById('admin-couriers-unassigned');
            if (unassignedBtn) {
                unassignedBtn.addEventListener('click', () => {
                    api.setActiveMenu('ordersAll');
                    loadAllOrders(api, 'unassigned');
                });
            }
        } catch (err) {
            api.showMessage(err.message, true);
        }
    };

    function startExtra() {
        const api = window.adminPanelApi;
        if (!api || !api.apiFetch) {
            setTimeout(startExtra, 50);
            return;
        }

        dashBtn.addEventListener('click', () => {
            api.showMessage('');
            api.setActiveMenu('dashboard');
            loadDashboard(api);
        });

        if (statsBtn) {
            statsBtn.addEventListener('click', () => {
                api.showMessage('');
                if (window.adminStatsPage && typeof window.adminStatsPage.load === 'function') {
                    window.adminStatsPage.load(api);
                }
            });
        }

        if (window.adminNav && typeof window.adminNav.refreshBadges === 'function') {
            window.adminNav.refreshBadges(api);
        }

        if (catsBtn) {
            catsBtn.addEventListener('click', () => {
                api.showMessage('');
                api.setActiveMenu('categories');
                renderCategories(api);
            });
        }

        if (ordersAllBtn) {
            ordersAllBtn.addEventListener('click', () => {
                api.showMessage('');
                api.setActiveMenu('ordersAll');
                loadAllOrders(api);
            });
        }

        if (usersBtn) {
            usersBtn.addEventListener('click', () => {
                api.showMessage('');
                api.setActiveMenu('users');
                loadUsers(api);
            });
        }

        if (couriersBtn) {
            couriersBtn.addEventListener('click', () => {
                api.showMessage('');
                api.setActiveMenu('couriers');
                loadCouriers(api);
            });
        }

        if (deliveryBtn) {
            deliveryBtn.addEventListener('click', () => {
                api.showMessage('');
                api.setActiveMenu('delivery');
                loadDeliverySettings(api);
            });
        }

        if (constructorBtn) {
            constructorBtn.addEventListener('click', () => {
                api.showMessage('');
                api.setActiveMenu('constructor');
                loadConstructorPage(api);
            });
        }

        api.loadConstructorPage = () => {
            api.setActiveMenu('constructor');
            return loadConstructorPage(api);
        };

        api.restoreAdminPanelExtraView = async () => {
            if (typeof window.loadFormDraftView !== 'function') {
                return false;
            }
            const state = window.loadFormDraftView(ADMIN_VIEW_KEY);
            if (!state || !state.view) {
                return false;
            }
            try {
                if (state.view === 'dashboard') {
                    api.setActiveMenu('dashboard');
                    await loadDashboard(api);
                    return true;
                }
                if (state.view === 'statistics' && window.adminStatsPage) {
                    await window.adminStatsPage.load(api);
                    return true;
                }
                if (state.view === 'categories') {
                    api.setActiveMenu('categories');
                    await renderCategories(api);
                    return true;
                }
                if (state.view === 'delivery') {
                    api.setActiveMenu('delivery');
                    await loadDeliverySettings(api);
                    return true;
                }
                if (state.view === 'constructor') {
                    api.setActiveMenu('constructor');
                    await loadConstructorPage(api);
                    return true;
                }
                if (state.view === 'legal') {
                    api.setActiveMenu('legal');
                    await loadLegalPages(api);
                    return true;
                }
                if (state.view === 'legal-edit' && state.slug) {
                    api.setActiveMenu('legal');
                    await loadLegalEditor(api, state.slug);
                    return true;
                }
                if (state.view === 'users') {
                    api.setActiveMenu('users');
                    await loadUsers(api);
                    return true;
                }
                if (state.view === 'couriers') {
                    api.setActiveMenu('couriers');
                    await loadCouriers(api);
                    return true;
                }
                if (state.view === 'orders-all') {
                    api.setActiveMenu('ordersAll');
                    await loadAllOrders(api);
                    return true;
                }
                if (state.view === 'support' && api.loadSupportPanel) {
                    await api.loadSupportPanel(state.chatId || null);
                    return true;
                }
            } catch (err) {
                return false;
            }
            return false;
        };

        api.restoreAdminWorkspace = async () => {
            if (typeof window.loadFormDraftView !== 'function') {
                return false;
            }
            const state = window.loadFormDraftView(ADMIN_VIEW_KEY);
            if (!state || !state.view) {
                return false;
            }

            const panelViews = [
                'products-list',
                'reviews',
                'orders-pending',
                'orders-awaiting',
                'product-create',
                'product-edit',
                'support'
            ];
            if (panelViews.indexOf(state.view) !== -1 && state.view === 'support' && api.loadSupportPanel) {
                return api.loadSupportPanel(state.chatId || null).then(() => true).catch(() => false);
            }
            if (panelViews.indexOf(state.view) !== -1 && api.restoreAdminPanelView) {
                return api.restoreAdminPanelView();
            }
            if (api.restoreAdminPanelExtraView) {
                return api.restoreAdminPanelExtraView();
            }
            return false;
        };

        if (legalBtn) {
            legalBtn.addEventListener('click', () => {
                api.showMessage('');
                api.setActiveMenu('legal');
                loadLegalPages(api);
            });
        }

        (async function () {
            const shell = document.querySelector('.admin-panel-shell');
            const savedMode = typeof window.getAdminSavedMenuMode === 'function'
                ? window.getAdminSavedMenuMode()
                : null;

            if (savedMode) {
                api.setActiveMenu(savedMode, true);
            }

            try {
                const urlParams = new URLSearchParams(window.location.search);
                const supportFromUrl = urlParams.get('support');
                if (supportFromUrl && api.loadSupportPanel) {
                    await api.loadSupportPanel(Number(supportFromUrl));
                    return;
                }
                if (api.restoreAdminWorkspace) {
                    const ok = await api.restoreAdminWorkspace();
                    if (ok) {
                        return;
                    }
                }
                api.setActiveMenu('dashboard');
                await loadDashboard(api);
            } finally {
                if (shell) {
                    shell.classList.remove('admin-panel-shell--booting');
                }
            }
        })();
    }

    window.adminPanelExtra = {
        renderOrderDetail: renderOrderDetail,
        loadAllOrders: loadAllOrders
    };

    startExtra();
})();
