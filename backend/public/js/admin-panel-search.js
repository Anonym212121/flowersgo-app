(() => {
    const root = document.getElementById('adminGlobalSearch');
    const input = document.getElementById('admin-global-search-input');
    const results = document.getElementById('admin-global-search-results');

    if (!root || !input || !results) {
        return;
    }

    let searchTimer = null;
    let searchBusy = false;
    let lastQuery = '';

    const closeResults = () => {
        results.hidden = true;
        results.innerHTML = '';
        input.setAttribute('aria-expanded', 'false');
    };

    const roleLabel = (name) => {
        if (name === 'admin') return 'Адмін';
        if (name === 'warehouse_worker') return 'Склад';
        if (name === 'courier') return "Кур'єр";
        return 'Клієнт';
    };

    const openHit = (api, type, id, extra) => {
        closeResults();
        input.blur();
        api.showMessage('');
        if (type === 'order') {
            api.setActiveMenu('ordersAll');
            if (window.adminPanelExtra && typeof window.adminPanelExtra.renderOrderDetail === 'function') {
                window.adminPanelExtra.renderOrderDetail(api, id, 'ordersAll').catch((err) => {
                    api.showMessage(err.message, true);
                });
            }
            return;
        }
        if (type === 'product') {
            if (typeof api.openProductEdit === 'function') {
                api.openProductEdit(id);
            }
            return;
        }
        if (type === 'user') {
            api.setActiveMenu('users');
            if (window.adminPanelExtra && typeof window.adminPanelExtra.loadUsers === 'function') {
                window.adminPanelExtra.loadUsers(api, extra || '');
            }
        }
    };

    const renderResults = (api, data, q) => {
        const orders = data.orders || [];
        const products = data.products || [];
        const users = data.users || [];
        const parts = [];

        const addGroup = (title, items, type, lineFn) => {
            if (items.length === 0) {
                return;
            }
            parts.push('<p class="admin-global-search__group">' + api.escapeHtml(title) + '</p>');
            items.forEach((item) => {
                parts.push(
                    '<button type="button" class="admin-global-search__item" data-type="' +
                        type +
                        '" data-id="' +
                        item.id +
                        '" data-extra="' +
                        api.escapeHtml(item.extra || '') +
                        '">' +
                        lineFn(item) +
                        '</button>'
                );
            });
        };

        addGroup('Замовлення', orders, 'order', (o) => {
            const name = ((o.first_name || '') + ' ' + (o.last_name || '')).trim() || o.receiver_name || 'Гість';
            const status = o.status_label || o.status_name || '';
            return (
                '<strong>№' +
                o.id +
                '</strong><span>' +
                api.escapeHtml(name) +
                (status ? ' · ' + api.escapeHtml(status) : '') +
                '</span>'
            );
        });

        addGroup('Товари', products, 'product', (p) => {
            return (
                '<strong>' +
                api.escapeHtml(p.name || '') +
                '</strong><span>ID ' +
                p.id +
                (p.category_name ? ' · ' + api.escapeHtml(p.category_name) : '') +
                '</span>'
            );
        });

        addGroup('Користувачі', users.map((u) => {
            return Object.assign({}, u, { extra: u.email || u.phone || '' });
        }), 'user', (u) => {
            const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.email || '';
            return (
                '<strong>' +
                api.escapeHtml(name) +
                '</strong><span>' +
                api.escapeHtml(u.email || '') +
                ' · ' +
                api.escapeHtml(roleLabel(u.role_name)) +
                '</span>'
            );
        });

        if (parts.length === 0) {
            results.innerHTML = '<p class="admin-global-search__empty">Нічого не знайдено за «' + api.escapeHtml(q) + '»</p>';
        } else {
            results.innerHTML = parts.join('');
        }
        results.hidden = false;
        input.setAttribute('aria-expanded', 'true');

        results.querySelectorAll('.admin-global-search__item').forEach((btn) => {
            btn.addEventListener('click', () => {
                openHit(
                    api,
                    btn.getAttribute('data-type'),
                    btn.getAttribute('data-id'),
                    btn.getAttribute('data-extra')
                );
            });
        });
    };

    const runSearch = async (api) => {
        const q = input.value.trim();
        lastQuery = q;
        if (q.length < 2 && !/^\d+$/.test(q)) {
            closeResults();
            return;
        }
        if (searchBusy) {
            return;
        }
        searchBusy = true;
        try {
            const data = await api.apiFetch('/api/admin/search?q=' + encodeURIComponent(q));
            if (input.value.trim() !== q) {
                return;
            }
            renderResults(api, data, q);
        } catch (err) {
            api.showMessage(err.message, true);
        } finally {
            searchBusy = false;
            const now = input.value.trim();
            if (now !== lastQuery && (now.length >= 2 || /^\d+$/.test(now))) {
                runSearch(api);
            }
        }
    };

    const start = () => {
        const api = window.adminPanelApi;
        if (!api || !api.apiFetch) {
            setTimeout(start, 50);
            return;
        }

        input.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                runSearch(api);
            }, 280);
        });

        input.addEventListener('focus', () => {
            if (!results.hidden && results.innerHTML) {
                results.hidden = false;
            }
        });

        document.addEventListener('click', (e) => {
            if (!root.contains(e.target)) {
                closeResults();
            }
        });

        document.addEventListener('keydown', (e) => {
            const key = e.key;
            if ((e.ctrlKey || e.metaKey) && (key === 'k' || key === 'K')) {
                e.preventDefault();
                input.focus();
                input.select();
                return;
            }
            if (key === 'Escape' && document.activeElement === input) {
                closeResults();
                input.blur();
                return;
            }
            if (key === 'Enter' && document.activeElement === input && !results.hidden) {
                const first = results.querySelector('.admin-global-search__item');
                if (first) {
                    e.preventDefault();
                    first.click();
                }
            }
        });
    };

    start();
})();
