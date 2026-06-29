(function () {
    const DEFAULT_PAGE_SIZE = 15;
    const HIDDEN_CLASS = 'list-pager-item--hidden';

    const parseSize = (raw) => {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) {
            return n;
        }
        return DEFAULT_PAGE_SIZE;
    };

    const mount = (root, options) => {
        if (!root) {
            return null;
        }

        if (root._listPager && !options) {
            root._listPager.refresh();
            return root._listPager;
        }

        if (root._listPager && root._listPager.destroy) {
            root._listPager.destroy();
        }

        const opts = options || {};
        const pageSize = parseSize(
            opts.pageSize != null ? opts.pageSize : root.getAttribute('data-list-pager-size')
        );
        const itemSelector =
            opts.itemSelector || root.getAttribute('data-list-pager-item') || ':scope > *';
        const filterFn = typeof opts.filter === 'function' ? opts.filter : null;
        const controlsInside = opts.controlsInside !== false;

        let visibleLimit = pageSize;
        let allShown = false;

        const controls = document.createElement('div');
        controls.className = 'list-pager-controls';
        controls.hidden = true;

        const info = document.createElement('span');
        info.className = 'list-pager-info';

        const actions = document.createElement('div');
        actions.className = 'list-pager-actions';

        const btnMore = document.createElement('button');
        btnMore.type = 'button';
        btnMore.className = 'list-pager-more auth-button';
        btnMore.textContent = 'Показати ще';

        const btnAll = document.createElement('button');
        btnAll.type = 'button';
        btnAll.className = 'list-pager-all admin-secondary-btn';
        btnAll.textContent = 'Показати всі';

        actions.appendChild(btnMore);
        actions.appendChild(btnAll);
        controls.appendChild(info);
        controls.appendChild(actions);

        if (controlsInside) {
            root.appendChild(controls);
        } else {
            root.insertAdjacentElement('afterend', controls);
        }

        const getItems = () => {
            let items = Array.from(root.querySelectorAll(itemSelector));
            if (filterFn) {
                items = items.filter(filterFn);
            }
            return items;
        };

        const updateUI = () => {
            const items = getItems();
            const total = items.length;

            if (total <= pageSize) {
                items.forEach((el) => el.classList.remove(HIDDEN_CLASS));
                controls.hidden = true;
                return;
            }

            controls.hidden = false;
            const limit = allShown ? total : visibleLimit;

            items.forEach((el, idx) => {
                if (idx < limit) {
                    el.classList.remove(HIDDEN_CLASS);
                } else {
                    el.classList.add(HIDDEN_CLASS);
                }
            });

            const shown = Math.min(limit, total);
            if (allShown || shown >= total) {
                info.textContent = 'Усі ' + total;
                btnMore.hidden = true;
                btnAll.hidden = true;
            } else {
                info.textContent = 'Показано ' + shown + ' з ' + total;
                btnMore.hidden = false;
                btnAll.hidden = false;
            }
        };

        btnMore.addEventListener('click', () => {
            visibleLimit += pageSize;
            updateUI();
        });

        btnAll.addEventListener('click', () => {
            allShown = true;
            updateUI();
        });

        const instance = {
            refresh: () => {
                allShown = false;
                visibleLimit = pageSize;
                updateUI();
            },
            showAll: () => {
                allShown = true;
                updateUI();
            },
            destroy: () => {
                getItems().forEach((el) => el.classList.remove(HIDDEN_CLASS));
                controls.remove();
                delete root._listPager;
            }
        };

        root._listPager = instance;
        updateUI();
        return instance;
    };

    const initAll = () => {
        document.querySelectorAll('[data-list-pager]').forEach((el) => {
            mount(el);
        });
    };

    window.ListPager = {
        mount: mount,
        initAll: initAll
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
