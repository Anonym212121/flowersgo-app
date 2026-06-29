(function () {
    const btn = document.getElementById('navNotifyBtn');
    const panel = document.getElementById('navNotifyPanel');
    const badge = document.getElementById('navNotifyBadge');
    const listEl = document.getElementById('navNotifyList');
    const emptyEl = document.getElementById('navNotifyEmpty');
    const readAllBtn = document.getElementById('navNotifyReadAll');
    const settingsEl = document.getElementById('navNotifySettings');
    const pagerEl = document.getElementById('navNotifyPager');
    const pagerInfoEl = document.getElementById('navNotifyPagerInfo');
    const pagerMoreBtn = document.getElementById('navNotifyMore');
    const pagerAllBtn = document.getElementById('navNotifyAll');

    if (!btn || !panel || !listEl) {
        return;
    }

    let lastCount = 0;
    let panelOpen = false;
    const PAGE_SIZE = 15;
    let loadedCount = 0;
    let totalCount = 0;
    let loadingList = false;

    const formatTime = (raw) => {
        if (!raw) {
            return '';
        }
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
            return '';
        }
        return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const appendItems = (items) => {
        if (!items || items.length === 0) {
            return;
        }
        if (emptyEl) {
            emptyEl.hidden = true;
        }

        for (const row of items) {
            const li = document.createElement('li');
            li.className = 'nav-notify__item' + (Number(row.is_read) === 1 ? ' nav-notify__item--read' : '');
            li.dataset.id = String(row.id);

            const link = document.createElement('a');
            link.className = 'nav-notify__link';
            link.href = row.link_url || '#';
            link.textContent = row.title || 'Сповіщення';

            const body = document.createElement('span');
            body.className = 'nav-notify__body';
            body.textContent = row.body || '';

            const time = document.createElement('span');
            time.className = 'nav-notify__time';
            time.textContent = formatTime(row.createdAt);

            link.appendChild(body);
            link.appendChild(time);
            li.appendChild(link);
            listEl.appendChild(li);
        }
    };

    const updatePagerUi = () => {
        if (!pagerEl) {
            return;
        }
        if (totalCount <= PAGE_SIZE) {
            pagerEl.hidden = true;
            return;
        }
        pagerEl.hidden = false;
        if (pagerInfoEl) {
            pagerInfoEl.textContent = 'Показано ' + loadedCount + ' з ' + totalCount;
        }
        if (pagerMoreBtn) {
            pagerMoreBtn.hidden = loadedCount >= totalCount;
        }
        if (pagerAllBtn) {
            pagerAllBtn.hidden = loadedCount >= totalCount;
        }
    };

    const renderList = (items) => {
        listEl.innerHTML = '';
        loadedCount = 0;
        if (!items || items.length === 0) {
            if (emptyEl) {
                emptyEl.hidden = false;
            }
            updatePagerUi();
            return;
        }
        appendItems(items);
        loadedCount = items.length;
        updatePagerUi();
    };

    const updateBadge = (count) => {
        if (!badge) {
            return;
        }
        const n = Number(count) || 0;
        if (n > 0) {
            badge.hidden = false;
            badge.textContent = n > 99 ? '99+' : String(n);
        } else {
            badge.hidden = true;
        }
    };

    const loadList = async (reset) => {
        if (loadingList) {
            return;
        }
        loadingList = true;
        try {
            const offset = reset ? 0 : loadedCount;
            const res = await fetch('/api/notifications?limit=' + PAGE_SIZE + '&offset=' + offset, {
                credentials: 'same-origin'
            });
            if (!res.ok) {
                return;
            }
            const data = await res.json();
            const rows = Array.isArray(data.notifications) ? data.notifications : [];
            totalCount = Number(data.total) || rows.length;

            if (reset) {
                renderList(rows);
            } else {
                appendItems(rows);
                loadedCount += rows.length;
                updatePagerUi();
            }
        } catch (err) {
        } finally {
            loadingList = false;
        }
    };

    const loadCount = async () => {
        try {
            const res = await fetch('/api/notifications/unread-count', { credentials: 'same-origin' });
            if (!res.ok) {
                return;
            }
            const data = await res.json();
            const count = Number(data.count) || 0;

            if (count > lastCount) {
                let meta = {
                    title: 'FlowersGo',
                    body: 'Нове сповіщення на сайті',
                    link: window.location.pathname
                };
                try {
                    const listRes = await fetch('/api/notifications?limit=1&offset=0', { credentials: 'same-origin' });
                    if (listRes.ok) {
                        const listData = await listRes.json();
                        const rows = Array.isArray(listData.notifications) ? listData.notifications : [];
                        const newest = rows.find((row) => Number(row.is_read) === 0) || rows[0];
                        if (newest) {
                            meta.title = newest.title || meta.title;
                            meta.body = newest.body || meta.body;
                            meta.link = newest.link_url || meta.link;
                        }
                    }
                } catch (e) {
                }
                if (window.SiteAlerts && typeof window.SiteAlerts.onCountIncrease === 'function') {
                    window.SiteAlerts.onCountIncrease('notifications', count, meta);
                }
            } else if (window.SiteAlerts && typeof window.SiteAlerts.setInitialCount === 'function') {
                window.SiteAlerts.setInitialCount('notifications', count);
            }

            lastCount = count;
            updateBadge(count);
        } catch (err) {
        }
    };

    const refreshNotifications = async () => {
        await loadCount();
        if (panelOpen && !panel.hidden) {
            await loadList(true);
        }
    };

    const markRead = async (id) => {
        try {
            await fetch('/api/notifications/' + id + '/read', {
                method: 'POST',
                credentials: 'same-origin'
            });
        } catch (err) {
        }
    };

    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const open = panel.hidden;
        panel.hidden = !open;
        panelOpen = open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            if (settingsEl && typeof window.renderAlertSettingsBtn === 'function') {
                window.renderAlertSettingsBtn(settingsEl);
            }
            await loadList(true);
            if (window.SiteAlerts && typeof window.SiteAlerts.requestPushPermission === 'function') {
                await window.SiteAlerts.requestPushPermission();
            }
        }
    });

    listEl.addEventListener('click', async (e) => {
        const item = e.target.closest('.nav-notify__item');
        if (!item || !item.dataset.id) {
            return;
        }
        await markRead(item.dataset.id);
        item.classList.add('nav-notify__item--read');
        await loadCount();
    });

    if (readAllBtn) {
        readAllBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('/api/notifications/read-all', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
            } catch (err) {
            }
            await loadList(true);
            await loadCount();
        });
    }

    if (pagerMoreBtn) {
        pagerMoreBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await loadList(false);
        });
    }

    if (pagerAllBtn) {
        pagerAllBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (loadingList || loadedCount >= totalCount) {
                return;
            }
            loadingList = true;
            try {
                const res = await fetch('/api/notifications?limit=100&offset=' + loadedCount, {
                    credentials: 'same-origin'
                });
                if (!res.ok) {
                    return;
                }
                const data = await res.json();
                const rows = Array.isArray(data.notifications) ? data.notifications : [];
                totalCount = Number(data.total) || totalCount;
                appendItems(rows);
                loadedCount += rows.length;
                updatePagerUi();
            } catch (err) {
            } finally {
                loadingList = false;
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!panel.hidden && !e.target.closest('#navNotify')) {
            panel.hidden = true;
            panelOpen = false;
            btn.setAttribute('aria-expanded', 'false');
        }
    });

    (async function init() {
        try {
            const res = await fetch('/api/notifications/unread-count', { credentials: 'same-origin' });
            if (res.ok) {
                const data = await res.json();
                lastCount = Number(data.count) || 0;
                if (window.SiteAlerts && typeof window.SiteAlerts.setInitialCount === 'function') {
                    window.SiteAlerts.setInitialCount('notifications', lastCount);
                }
                updateBadge(lastCount);
            }
        } catch (err) {
        }

        if (window.SiteNotifyAuto && typeof window.SiteNotifyAuto.register === 'function') {
            window.SiteNotifyAuto.register('notifications', refreshNotifications);
        } else {
            setInterval(refreshNotifications, 8000);
        }
    })();
})();
