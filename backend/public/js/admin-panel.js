(() => {
    const content = document.getElementById('admin-panel-content');
    const message = document.getElementById('admin-panel-message');
    const showListBtn = document.getElementById('admin-show-list');
    const showCreateBtn = document.getElementById('admin-show-create');
    const showReviewsBtn = document.getElementById('admin-show-reviews');
    const showOrdersBtn = document.getElementById('admin-show-orders-pending');
    const showOrdersAwaitingBtn = document.getElementById('admin-show-orders-awaiting-payment');

    if (!content || !message || !showListBtn || !showCreateBtn || !showReviewsBtn || !showOrdersBtn) {
        return;
    }

    const ADMIN_VIEW_KEY = 'flowersgo_admin_view';

    const saveAdminView = (state) => {
        if (typeof window.saveFormDraftView === 'function') {
            window.saveFormDraftView(ADMIN_VIEW_KEY, state);
        }
    };

    window.adminPanelApi = {};

    const adminMenuViews = {
        dashboard: { view: 'dashboard' },
        statistics: { view: 'statistics' },
        list: { view: 'products-list' },
        categories: { view: 'categories' },
        reviews: { view: 'reviews' },
        orders: { view: 'orders-pending' },
        'orders-awaiting': { view: 'orders-awaiting' },
        ordersAll: { view: 'orders-all' },
        users: { view: 'users' },
        couriers: { view: 'couriers' },
        delivery: { view: 'delivery' },
        constructor: { view: 'constructor' },
        legal: { view: 'legal' },
        support: { view: 'support' }
    };

    const setActiveMenu = (mode, skipSave) => {
        if (window.adminNav && typeof window.adminNav.highlight === 'function') {
            window.adminNav.highlight(mode);
        } else {
            showListBtn.classList.toggle('active', mode === 'list');
            showCreateBtn.classList.toggle('active', mode === 'create');
            showReviewsBtn.classList.toggle('active', mode === 'reviews');
            showOrdersBtn.classList.toggle('active', mode === 'orders');
            if (showOrdersAwaitingBtn) {
                showOrdersAwaitingBtn.classList.toggle('active', mode === 'orders-awaiting');
            }
        }

        if (!skipSave && adminMenuViews[mode]) {
            saveAdminView(adminMenuViews[mode]);
        }

        if (window.adminNav && typeof window.adminNav.refreshBadges === 'function') {
            window.adminNav.refreshBadges(window.adminPanelApi);
        }
    };

    const showMessage = (text, isError = false) => {
        message.textContent = '';
        if (!text) {
            return;
        }
        if (typeof window.showToast === 'function') {
            window.showToast(text, isError ? 'error' : 'ok');
            return;
        }
        message.textContent = text;
        message.style.color = isError ? '#b00020' : '#1f7a39';
    };

    const escapeHtml = (value) => {
        return String(value == null ? '' : value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    };

    const showAdminLoading = (text) => {
        content.innerHTML =
            '<div class="admin-panel-loading"><p>' +
            escapeHtml(text || 'Завантаження…') +
            '</p></div>';
    };

    const openProductEdit = async (productId) => {
        const id = Number(productId);
        if (!Number.isFinite(id) || id <= 0) {
            return;
        }
        showMessage('');
        showAdminLoading('Завантаження товару…');
        try {
            const data = await apiFetch(`/api/admin/products/${id}`);
            setActiveMenu('create');
            await renderForm(data.product);
        } catch (err) {
            showMessage(err.message, true);
            setActiveMenu('list');
            await loadProductList();
        }
    };

    const apiFetch = async (url, options = {}) => {
        const res = await fetch(url, {
            credentials: 'include',
            ...options
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data && data.message ? data.message : 'Помилка запиту';
            throw new Error(msg);
        }
        return data;
    };

    const uploadProductPhoto = async (productId, file) => {
        const id = Number(productId);
        if (!Number.isFinite(id) || id <= 0 || !file) {
            return null;
        }
        const body = new FormData();
        body.append('image', file);
        body.append('product_id', String(id));
        const res = await fetch('/products/upload-image', {
            method: 'POST',
            credentials: 'include',
            body
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data && data.message ? data.message : 'Помилка завантаження фото';
            throw new Error(msg);
        }
        return data.image_url || null;
    };

    const uploadCategoryPhoto = async (categoryId, file) => {
        const id = Number(categoryId);
        if (!Number.isFinite(id) || id <= 0 || !file) {
            return null;
        }
        const body = new FormData();
        body.append('image', file);
        body.append('category_id', String(id));
        const res = await fetch('/categories/upload-image', {
            method: 'POST',
            credentials: 'include',
            body
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || 'Помилка завантаження фото');
        }
        return data.image_url || null;
    };

    const categoryOptionLabel = (list, cat) => {
        if (cat.parent_id == null) {
            return cat.name;
        }
        const parent = list.find((x) => Number(x.id) === Number(cat.parent_id));
        if (parent && parent.name) {
            return `${parent.name} — ${cat.name}`;
        }
        return cat.name;
    };

    const discountPresets = [5, 10, 25, 50, 90];

    const inferDiscountUi = (product) => {
        if (!product) {
            return { hasDiscount: false, radioValue: '10', customPercent: '' };
        }
        const b = Number(product.base_price);
        const s = Number(product.sale_price);
        if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(s)) {
            return { hasDiscount: false, radioValue: '10', customPercent: '' };
        }
        if (s >= b - 0.005) {
            return { hasDiscount: false, radioValue: '10', customPercent: '' };
        }
        const pctRaw = ((b - s) / b) * 100;
        const pct = Math.round(pctRaw * 100) / 100;
        for (let i = 0; i < discountPresets.length; i += 1) {
            const p = discountPresets[i];
            if (Math.abs(pct - p) < 0.06) {
                return { hasDiscount: true, radioValue: String(p), customPercent: '' };
            }
        }
        return { hasDiscount: true, radioValue: 'custom', customPercent: String(pct) };
    };

    const getDiscountPercentFromForm = (form) => {
        const hasDiscount = form.querySelector('#admin-has-discount')?.checked;
        if (!hasDiscount) {
            return 0;
        }
        const checked = form.querySelector('input[name="discount_pct"]:checked');
        if (!checked) {
            return 10;
        }
        if (checked.value === 'custom') {
            return Number(form.querySelector('#admin-discount-custom')?.value);
        }
        return Number(checked.value);
    };

    const computeSalePrice = (base, percent) => {
        if (!Number.isFinite(base) || base < 0) {
            return null;
        }
        if (!Number.isFinite(percent) || percent <= 0) {
            return Math.round(base * 100) / 100;
        }
        let p = percent;
        if (p > 100) {
            p = 100;
        }
        const raw = base * (1 - p / 100);
        return Math.round(raw * 100) / 100;
    };

    const updatePricePreview = (form) => {
        const el = form.querySelector('#admin-price-preview');
        if (!el) {
            return;
        }
        const base = Number(form.querySelector('[name="base_price"]')?.value);
        const hasDisc = form.querySelector('#admin-has-discount')?.checked;
        const pctRadio = form.querySelector('input[name="discount_pct"]:checked');
        if (hasDisc && pctRadio && pctRadio.value === 'custom') {
            const raw = form.querySelector('#admin-discount-custom')?.value;
            const c = Number(raw);
            if (raw === '' || !Number.isFinite(c) || c <= 0) {
                el.textContent = 'Підсумкова ціна: введи свій відсоток (1–100)';
                return;
            }
        }
        const pct = getDiscountPercentFromForm(form);
        const sale = computeSalePrice(base, hasDisc ? pct : 0);
        if (sale == null || !Number.isFinite(base)) {
            el.textContent = 'Підсумкова ціна: —';
            return;
        }
        if (!hasDisc || !Number.isFinite(pct) || pct <= 0) {
            el.textContent = `Підсумкова ціна: ${sale.toFixed(2)} грн (без знижки)`;
        } else {
            el.textContent = `Підсумкова ціна: ${sale.toFixed(2)} грн (знижка ${pct}%)`;
        }
    };

    const buildProductPayload = (form) => {
        const formData = new FormData(form);
        const base = Number(formData.get('base_price'));
        const hasDiscount = form.querySelector('#admin-has-discount')?.checked;
        let percent = 0;
        if (hasDiscount) {
            percent = getDiscountPercentFromForm(form);
        }
        const saleNum = computeSalePrice(base, hasDiscount ? percent : 0);
        return {
            category_id: formData.get('category_id'),
            name: formData.get('name'),
            description: formData.get('description'),
            base_price: formData.get('base_price'),
            sale_price: saleNum != null && Number.isFinite(saleNum) ? String(saleNum) : '0',
            stock_quantity: formData.get('stock_quantity'),
            unit_type: formData.get('unit_type'),
            is_active: formData.get('is_active') === '1' ? 1 : 0,
            is_constructor: formData.get('is_constructor') === '1' ? 1 : 0
        };
    };

    const renderForm = async (product = null, options = {}) => {
        const returnTo = options.returnTo === 'constructor' ? 'constructor' : 'products';
        const isEdit = !!(product && product.id);
        const productId = isEdit ? product.id : '';

        saveAdminView({
            view: isEdit ? 'product-edit' : 'product-create',
            productId: productId || ''
        });

        const selectedCategoryId = product && product.category_id != null ? String(product.category_id) : '';

        let categories = [];
        try {
            const catData = await apiFetch('/api/admin/categories');
            categories = Array.isArray(catData.categories) ? catData.categories : [];
        } catch (err) {
            showMessage(err.message, true);
        }

        let categoryField = '';
        if (categories.length === 0) {
            categoryField =
                '<p class="admin-form-note">Категорії не завантажені.</p>';
        } else {
            const options = categories
                .map((c) => {
                    const value = String(c.id);
                    const selected = value === selectedCategoryId ? ' selected' : '';
                    const label = categoryOptionLabel(categories, c);
                    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
                })
                .join('');
            const placeholderSelected = selectedCategoryId === '' ? ' selected' : '';
            categoryField = `
                <label>Категорія
                    <select name="category_id" required>
                        <option value="" disabled${placeholderSelected}>Оберіть категорію</option>
                        ${options}
                    </select>
                </label>`;
        }

        const discUi = inferDiscountUi(product);
        const showConstructorColors = product && Number(product.is_constructor) === 1;
        const presetRadios = discountPresets
            .map((p) => {
                const sel =
                    discUi.hasDiscount && discUi.radioValue === String(p) ? ' checked' : '';
                return `<label class="admin-discount-pct-label"><input type="radio" name="discount_pct" value="${p}"${sel}> ${p}%</label>`;
            })
            .join('');
        const customRadioChecked =
            discUi.hasDiscount && discUi.radioValue === 'custom' ? ' checked' : '';

        content.innerHTML = `
            <h3>${isEdit ? 'Редагування товару' : 'Додавання товару'}</h3>
            <form id="admin-product-form" class="admin-form">
                ${categoryField}
                <label>Назва <input name="name" type="text" required value="${escapeHtml(product ? product.name : '')}"></label>
                <label>Опис<textarea name="description" rows="4">${escapeHtml(product ? product.description : '')}</textarea></label>
                <label>Базова ціна <input name="base_price" id="admin-base-price" type="number" step="0.01" min="0" required value="${escapeHtml(product ? product.base_price : '')}"></label>
                <div class="admin-discount-block">
                    <label class="admin-discount-check-label">
                        <input type="checkbox" name="has_discount" value="1" id="admin-has-discount" ${discUi.hasDiscount ? 'checked' : ''}>
                        Знижка
                    </label>
                    <div id="admin-discount-fields" class="admin-discount-fields" ${discUi.hasDiscount ? '' : 'hidden'}>
                        <div class="admin-discount-pct-row">
                            ${presetRadios}
                            <label class="admin-discount-pct-label">
                                <input type="radio" name="discount_pct" value="custom"${customRadioChecked}> Свій %
                            </label>
                            <input name="discount_pct_custom" id="admin-discount-custom" type="number" min="0" max="100" step="0.01" placeholder="1–100" value="${escapeHtml(discUi.customPercent)}">
                        </div>
                    </div>
                    <p class="admin-price-preview" id="admin-price-preview"></p>
                </div>
                <label>Кількість на складі <input name="stock_quantity" type="number" min="0" required value="${escapeHtml(product ? product.stock_quantity : '0')}"></label>
                <label>Одиниця <input name="unit_type" type="text" value="${escapeHtml(product && product.unit_type ? product.unit_type : 'шт')}"></label>
                <label>Активний
                    <select name="is_active">
                        <option value="1" ${product && Number(product.is_active) === 0 ? '' : 'selected'}>Так</option>
                        <option value="0" ${product && Number(product.is_active) === 0 ? 'selected' : ''}>Ні</option>
                    </select>
                </label>
                <label>Для конструктора
                    <select name="is_constructor" id="admin-is-constructor">
                        <option value="0" ${product && Number(product.is_constructor) === 1 ? '' : 'selected'}>Ні</option>
                        <option value="1" ${product && Number(product.is_constructor) === 1 ? 'selected' : ''}>Так</option>
                    </select>
                </label>
                <div id="admin-constructor-color-fields" class="admin-constructor-color-fields"${showConstructorColors ? '' : ' hidden'}>
                    <p class="admin-photo-hint">Кольори та фото кожного кольору додаються у вкладці «Конструктор» → кнопка «Кольори» біля квітки.</p>
                </div>
                <div class="admin-product-photo-block">
                    <label class="admin-photo-label">Фото
                        <input type="file" id="admin-product-image" accept="image/jpeg,image/png,image/gif,image/webp">
                    </label>
                    <p class="admin-photo-hint">${
                        product && product.image_url
                    }</p>
                    <img id="admin-product-image-preview" class="admin-product-thumb" alt="Фото товару"${
                        product && product.image_url
                            ? ` src="${escapeHtml(product.image_url)}"`
                            : ' hidden'
                    }>
                </div>
                <div class="admin-form-actions">
                    <button type="submit" class="admin-primary-btn">${isEdit ? 'Зберегти зміни' : 'Створити товар'}</button>
                    <button type="button" id="admin-back-to-list" class="admin-secondary-btn">Повернутися до списку</button>
                </div>
            </form>
        `;

        const form = document.getElementById('admin-product-form');
        const backBtn = document.getElementById('admin-back-to-list');
        if (!form || !backBtn) {
            return;
        }
        const discountCheck = form.querySelector('#admin-has-discount');
        const discountFields = form.querySelector('#admin-discount-fields');
        const constructorSelect = form.querySelector('#admin-is-constructor');
        const constructorColorFields = form.querySelector('#admin-constructor-color-fields');

        const syncConstructorColorFields = () => {
            if (!constructorColorFields || !constructorSelect) {
                return;
            }
            if (constructorSelect.value === '1') {
                constructorColorFields.removeAttribute('hidden');
            } else {
                constructorColorFields.setAttribute('hidden', '');
            }
        };

        syncConstructorColorFields();
        if (constructorSelect) {
            constructorSelect.addEventListener('change', syncConstructorColorFields);
        }

        const syncDiscountVisibility = () => {
            if (!discountFields || !discountCheck) {
                return;
            }
            if (discountCheck.checked) {
                discountFields.removeAttribute('hidden');
                const any = form.querySelector('input[name="discount_pct"]:checked');
                if (!any) {
                    const ten = form.querySelector('input[name="discount_pct"][value="10"]');
                    if (ten) {
                        ten.checked = true;
                    }
                }
            } else {
                discountFields.setAttribute('hidden', '');
            }
            updatePricePreview(form);
        };

        syncDiscountVisibility();
        if (discountCheck) {
            discountCheck.addEventListener('change', syncDiscountVisibility);
        }

        form.addEventListener('input', (e) => {
            if (
                e.target.matches(
                    '#admin-base-price, #admin-discount-custom, input[name="discount_pct"]'
                )
            ) {
                updatePricePreview(form);
            }
        });
        form.addEventListener('change', (e) => {
            if (
                e.target.matches('#admin-has-discount, input[name="discount_pct"]')
            ) {
                updatePricePreview(form);
            }
        });
        updatePricePreview(form);

        if (typeof window.bindFormDraft === 'function') {
            window.bindFormDraft(form, {
                key: 'flowersgo_admin_product_draft:' + (productId || 'new'),
                notifyMessage: 'Чернетку товару відновлено',
                onRestore: function () {
                    syncDiscountVisibility();
                    syncConstructorColorFields();
                    updatePricePreview(form);
                }
            });
        }

        backBtn.addEventListener('click', () => {
            if (returnTo === 'constructor' && window.adminPanelApi.loadConstructorPage) {
                window.adminPanelApi.loadConstructorPage();
                return;
            }
            loadProductList();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (categories.length === 0) {
                showMessage('Додайте категорії', true);
                return;
            }
            if (discountCheck && discountCheck.checked) {
                const checkedPct = form.querySelector('input[name="discount_pct"]:checked');
                if (checkedPct && checkedPct.value === 'custom') {
                    const customEl = form.querySelector('#admin-discount-custom');
                    const c = customEl ? Number(customEl.value) : NaN;
                    if (!Number.isFinite(c) || c <= 0 || c > 100) {
                        showMessage('Для свого відсотка введи число від 1 до 100', true);
                        return;
                    }
                }
            }
            const payload = buildProductPayload(form);
            const fileInput = form.querySelector('#admin-product-image');
            const photoFile = fileInput && fileInput.files && fileInput.files[0];
            try {
                let targetId = productId;
                if (isEdit) {
                    await apiFetch(`/api/admin/products/${productId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    const data = await apiFetch('/api/admin/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    targetId =
                        data.product && data.product.id != null
                            ? data.product.id
                            : null;
                }

                if (photoFile && targetId) {
                    try {
                        await uploadProductPhoto(targetId, photoFile);
                    } catch (upErr) {
                        const baseMsg = isEdit ? 'Товар оновлено.' : 'Товар створено.';
                        showMessage(
                            `${baseMsg} Фото не збережено: ${upErr.message}`,
                            true
                        );
                        if (returnTo === 'constructor' && window.adminPanelApi.loadConstructorPage) {
                            await window.adminPanelApi.loadConstructorPage();
                        } else {
                            await loadProductList();
                        }
                        return;
                    }
                }
                if (photoFile && targetId) {
                    showMessage(
                        isEdit
                            ? 'Товар і фото оновлено'
                            : 'Товар і фото збережено'
                    );
                } else {
                    showMessage(isEdit ? 'Товар оновлено' : 'Товар створено');
                }
                if (form._formDraftHandle && typeof form._formDraftHandle.clear === 'function') {
                    form._formDraftHandle.clear();
                }
                if (returnTo === 'constructor' && window.adminPanelApi.loadConstructorPage) {
                    await window.adminPanelApi.loadConstructorPage();
                } else {
                    await loadProductList();
                }
            } catch (err) {
                showMessage(err.message, true);
            }
        });
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

    const productListState = {
        status: 'all',
        category_id: '',
        type: 'all',
        stock: 'all',
        sort: 'id_desc',
        q: ''
    };

    const getSelectedProductIds = () => {
        const checked = content.querySelectorAll('.admin-product-check:checked');
        const ids = [];
        checked.forEach((input) => {
            const id = Number(input.value);
            if (Number.isFinite(id) && id > 0) {
                ids.push(id);
            }
        });
        return ids;
    };

    const syncProductBulkBar = () => {
        const bar = document.getElementById('admin-product-bulk-bar');
        const countEl = document.getElementById('admin-product-bulk-count');
        if (!bar || !countEl) {
            return;
        }
        const ids = getSelectedProductIds();
        countEl.textContent = String(ids.length);
        bar.hidden = ids.length === 0;
    };

    const buildProductListQuery = () => {
        const params = new URLSearchParams();
        if (productListState.status && productListState.status !== 'all') {
            params.set('status', productListState.status);
        }
        if (productListState.category_id) {
            params.set('category_id', productListState.category_id);
        }
        if (productListState.type && productListState.type !== 'all') {
            params.set('type', productListState.type);
        }
        if (productListState.stock && productListState.stock !== 'all') {
            params.set('stock', productListState.stock);
        }
        if (productListState.sort) {
            params.set('sort', productListState.sort);
        }
        if (productListState.q) {
            params.set('q', productListState.q);
        }
        const query = params.toString();
        return query ? `?${query}` : '';
    };

    const renderProductStatusBadge = (product) => {
        if (Number(product.is_active) === 1) {
            return '<span class="admin-status-badge admin-status-badge--active">Активний</span>';
        }
        return '<span class="admin-status-badge admin-status-badge--archived">В архіві</span>';
    };

    const renderProductStockCell = (product) => {
        if (Number(product.is_constructor) === 1) {
            return '<span class="admin-muted-hint">У «Кольорах»</span>';
        }
        const stock = Number(product.stock_quantity || 0);
        const lowClass = stock > 0 && stock <= 5 ? ' admin-stock-low' : '';
        return `
            <div class="admin-stock-cell${lowClass}">
                <input type="number" min="0" class="admin-stock-input auth-input" value="${stock}" data-id="${product.id}" aria-label="Склад">
                <button type="button" class="admin-stock-save admin-secondary-btn" data-id="${product.id}">OK</button>
            </div>
        `;
    };

    const renderProductActions = (product) => {
        const isActive = Number(product.is_active) === 1;
        const toggleLabel = isActive ? 'Приховати' : 'Увімкнути';
        const toggleClass = isActive ? 'admin-product-hide' : 'admin-product-show';
        return `
            <div class="admin-row-actions">
                <a class="admin-link-btn" href="/product/${product.id}" target="_blank" rel="noopener">На сайті</a>
                <button type="button" class="admin-edit-btn" data-id="${product.id}">Редагувати</button>
                <button type="button" class="admin-secondary-btn admin-product-duplicate" data-id="${product.id}">Копія</button>
                <button type="button" class="admin-secondary-btn ${toggleClass}" data-id="${product.id}" data-active="${isActive ? '1' : '0'}">${toggleLabel}</button>
                <button type="button" class="admin-secondary-btn admin-product-delete" data-id="${product.id}">В архів</button>
            </div>
        `;
    };

    const bindProductListEvents = (categories) => {
        bindTableSearch(
            'admin-product-search',
            'admin-product-search-count',
            'admin-product-empty-search',
            'tr.admin-product-row',
            (row) => {
                const name = row.getAttribute('data-name') || '';
                const category = row.getAttribute('data-category') || '';
                const id = row.getAttribute('data-id') || '';
                const slug = row.getAttribute('data-slug') || '';
                return `${name} ${category} ${id} ${slug}`;
            }
        );

        const searchInput = document.getElementById('admin-product-search');
        if (searchInput) {
            searchInput.value = productListState.q;
            searchInput.addEventListener('change', () => {
                productListState.q = searchInput.value.trim();
                loadProductList();
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    productListState.q = searchInput.value.trim();
                    loadProductList();
                }
            });
        }

        const statusFilter = document.getElementById('admin-product-filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                productListState.status = statusFilter.value;
                loadProductList();
            });
        }

        const categoryFilter = document.getElementById('admin-product-filter-category');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                productListState.category_id = categoryFilter.value;
                loadProductList();
            });
        }

        const typeFilter = document.getElementById('admin-product-filter-type');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                productListState.type = typeFilter.value;
                loadProductList();
            });
        }

        const stockFilter = document.getElementById('admin-product-filter-stock');
        if (stockFilter) {
            stockFilter.addEventListener('change', () => {
                productListState.stock = stockFilter.value;
                loadProductList();
            });
        }

        const sortFilter = document.getElementById('admin-product-filter-sort');
        if (sortFilter) {
            sortFilter.addEventListener('change', () => {
                productListState.sort = sortFilter.value;
                loadProductList();
            });
        }

        const checkAll = document.getElementById('admin-product-check-all');
        if (checkAll) {
            checkAll.addEventListener('change', () => {
                const rows = content.querySelectorAll('.admin-product-check');
                rows.forEach((input) => {
                    input.checked = checkAll.checked;
                });
                syncProductBulkBar();
            });
        }

        content.querySelectorAll('.admin-product-check').forEach((input) => {
            input.addEventListener('change', syncProductBulkBar);
        });

        const runBulk = async (action) => {
            const ids = getSelectedProductIds();
            if (ids.length === 0) {
                showMessage('Обери товари', true);
                return;
            }
            let confirmText = '';
            if (action === 'activate') {
                confirmText = `Увімкнути ${ids.length} товар(ів)?`;
            } else {
                confirmText = `Приховати ${ids.length} товар(ів)?`;
            }
            if (!window.confirm(confirmText)) {
                return;
            }
            try {
                const data = await apiFetch('/api/admin/products/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, ids })
                });
                showMessage(data.message || 'Готово');
                await loadProductList();
            } catch (err) {
                showMessage(err.message, true);
            }
        };

        const bulkActivate = document.getElementById('admin-product-bulk-activate');
        const bulkArchive = document.getElementById('admin-product-bulk-archive');
        if (bulkActivate) {
            bulkActivate.addEventListener('click', () => runBulk('activate'));
        }
        if (bulkArchive) {
            bulkArchive.addEventListener('click', () => runBulk('archive'));
        }

        content.querySelectorAll('.admin-edit-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    const data = await apiFetch(`/api/admin/products/${id}`);
                    setActiveMenu('create');
                    await renderForm(data.product);
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-product-duplicate').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Створити копію товару? Копія буде неактивною.')) {
                    return;
                }
                try {
                    const data = await apiFetch(`/api/admin/products/${id}/duplicate`, { method: 'POST' });
                    showMessage(data.message || 'Копію створено');
                    setActiveMenu('create');
                    if (data.product) {
                        await renderForm(data.product);
                    } else {
                        await loadProductList();
                    }
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-product-hide, .admin-product-show').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const nextActive = btn.classList.contains('admin-product-show') ? 1 : 0;
                try {
                    const data = await apiFetch(`/api/admin/products/${id}/toggle-active`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active: nextActive })
                    });
                    showMessage(data.message || 'Статус змінено');
                    await loadProductList();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-product-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Прибрати товар з каталогу?')) {
                    return;
                }
                try {
                    await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
                    showMessage('Товар прибрано');
                    await loadProductList();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-stock-save').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const input = content.querySelector(`.admin-stock-input[data-id="${id}"]`);
                if (!input) {
                    return;
                }
                const stock = Number(input.value);
                try {
                    const data = await apiFetch(`/api/admin/products/${id}/stock`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stock_quantity: stock })
                    });
                    showMessage(data.message || 'Склад оновлено');
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });
    };

    const renderProductList = (products, categories) => {
        const categoryOptions = (categories || [])
            .map((cat) => {
                const selected = String(productListState.category_id) === String(cat.id) ? ' selected' : '';
                return `<option value="${cat.id}"${selected}>${escapeHtml(cat.name)}</option>`;
            })
            .join('');

        const rows = products
            .map((p) => {
                const typeLabel =
                    Number(p.is_constructor) === 1
                        ? '<span class="admin-type-badge admin-type-badge--constructor">Конструктор</span>'
                        : '<span class="admin-type-badge">Каталог</span>';
                return `
            <tr class="admin-product-row" data-name="${escapeHtml(p.name)}" data-category="${escapeHtml(p.category_name || '')}" data-id="${p.id}" data-slug="${escapeHtml(p.slug || '')}">
                <td><input type="checkbox" class="admin-product-check" value="${p.id}" aria-label="Обрати товар ${p.id}"></td>
                <td>${p.id}</td>
                <td class="admin-table-photo">${
                    p.image_url
                        ? `<img class="admin-table-thumb" src="${escapeHtml(p.image_url)}" alt="">`
                        : '—'
                }</td>
                <td>${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.category_name || '')}</td>
                <td>${typeLabel}</td>
                <td>${Number(p.sale_price || 0).toLocaleString('uk-UA')} грн</td>
                <td>${renderProductStockCell(p)}</td>
                <td>${renderProductStatusBadge(p)}</td>
                <td>${renderProductActions(p)}</td>
            </tr>
        `;
            })
            .join('');

        content.innerHTML = `
            <div class="admin-products-head">
                <h3>Список товарів</h3>
                <div class="admin-products-head__actions">
                    <button type="button" id="admin-product-add" class="admin-primary-btn">+ Новий товар</button>
                    <button type="button" id="admin-product-refresh" class="admin-secondary-btn">Оновити</button>
                </div>
            </div>
            <div class="admin-filters admin-product-filters">
                <label>Статус
                    <select id="admin-product-filter-status">
                        <option value="all"${productListState.status === 'all' ? ' selected' : ''}>Усі</option>
                        <option value="active"${productListState.status === 'active' ? ' selected' : ''}>Активні</option>
                        <option value="archived"${productListState.status === 'archived' ? ' selected' : ''}>В архіві</option>
                    </select>
                </label>
                <label>Категорія
                    <select id="admin-product-filter-category">
                        <option value="">Усі</option>
                        ${categoryOptions}
                    </select>
                </label>
                <label>Тип
                    <select id="admin-product-filter-type">
                        <option value="all"${productListState.type === 'all' ? ' selected' : ''}>Усі</option>
                        <option value="catalog"${productListState.type === 'catalog' ? ' selected' : ''}>Каталог</option>
                        <option value="constructor"${productListState.type === 'constructor' ? ' selected' : ''}>Конструктор</option>
                    </select>
                </label>
                <label>Склад
                    <select id="admin-product-filter-stock">
                        <option value="all"${productListState.stock === 'all' ? ' selected' : ''}>Усі</option>
                        <option value="low"${productListState.stock === 'low' ? ' selected' : ''}>Мало (≤5)</option>
                        <option value="out"${productListState.stock === 'out' ? ' selected' : ''}>Немає на складі</option>
                    </select>
                </label>
                <label>Сортування
                    <select id="admin-product-filter-sort">
                        <option value="id_desc"${productListState.sort === 'id_desc' ? ' selected' : ''}>Новіші</option>
                        <option value="id_asc"${productListState.sort === 'id_asc' ? ' selected' : ''}>Старіші</option>
                        <option value="name_asc"${productListState.sort === 'name_asc' ? ' selected' : ''}>Назва А→Я</option>
                        <option value="name_desc"${productListState.sort === 'name_desc' ? ' selected' : ''}>Назва Я→А</option>
                        <option value="price_asc"${productListState.sort === 'price_asc' ? ' selected' : ''}>Ціна ↑</option>
                        <option value="price_desc"${productListState.sort === 'price_desc' ? ' selected' : ''}>Ціна ↓</option>
                        <option value="stock_asc"${productListState.sort === 'stock_asc' ? ' selected' : ''}>Склад ↑</option>
                        <option value="stock_desc"${productListState.sort === 'stock_desc' ? ' selected' : ''}>Склад ↓</option>
                    </select>
                </label>
                <label>Пошук <input type="search" id="admin-product-search" placeholder="Назва, категорія, ID, slug"></label>
                <span id="admin-product-search-count"></span>
            </div>
            <div id="admin-product-bulk-bar" class="admin-bulk-bar" hidden>
                <span>Обрано: <strong id="admin-product-bulk-count">0</strong></span>
                <button type="button" id="admin-product-bulk-activate" class="admin-primary-btn">Увімкнути</button>
                <button type="button" id="admin-product-bulk-archive" class="admin-secondary-btn">Приховати</button>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table admin-product-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="admin-product-check-all" aria-label="Обрати всі"></th>
                            <th>ID</th>
                            <th>Фото</th>
                            <th>Назва</th>
                            <th>Категорія</th>
                            <th>Тип</th>
                            <th>Ціна</th>
                            <th>Склад</th>
                            <th>Статус</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        <tr id="admin-product-empty-search" hidden><td colspan="10">Немає збігів</td></tr>
                        ${!rows ? `<tr><td colspan="10">
                            <div class="admin-empty-state">
                                <p>Товарів за цими фільтрами немає.</p>
                                <button type="button" class="admin-primary-btn" id="admin-product-empty-add">+ Додати товар</button>
                            </div>
                        </td></tr>` : ''}
                    </tbody>
                </table>
            </div>
            <p class="admin-table-meta">Показано: ${products.length}</p>
        `;

        bindProductListEvents(categories);

        const refreshBtn = document.getElementById('admin-product-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => loadProductList());
        }

        const addBtn = document.getElementById('admin-product-add');
        if (addBtn && showCreateBtn) {
            addBtn.addEventListener('click', () => showCreateBtn.click());
        }

        const emptyAddBtn = document.getElementById('admin-product-empty-add');
        if (emptyAddBtn && showCreateBtn) {
            emptyAddBtn.addEventListener('click', () => showCreateBtn.click());
        }
    };

    const loadProductList = async () => {
        try {
            const [productsData, categoriesData] = await Promise.all([
                apiFetch(`/api/admin/products${buildProductListQuery()}`),
                apiFetch('/api/admin/categories')
            ]);
            const products = Array.isArray(productsData.products) ? productsData.products : [];
            const categories = Array.isArray(categoriesData.categories) ? categoriesData.categories : [];
            renderProductList(products, categories);
        } catch (err) {
            showMessage(err.message, true);
        }
    };
    const formatReviewDate = (rev) => {
        const raw = rev.createdAt || rev.createdat;
           if (!raw) {
            return '—';
        }
     try {
            return new Date(raw).toLocaleString('uk-UA');
        } catch (e) {
            return '—';
        }
    };
const renderReviewStars = (rating) => {
        const value = Number(rating);
        if (!Number.isFinite(value) || value < 1 || value > 5) {
            return '—';
        }
        let html = '<span class="star-rating star-rating--sm">';
        for (let star = 1; star <= 5; star += 1) {
            const cls = star <= value ? 'star-icon--on' : 'star-icon--off';
            html += `<span class="star-icon ${cls}">★</span>`;
        }
        html += ` <span class="admin-review-rating-num">${value}/5</span></span>`;
        return html;
    };

const renderChangeRequestsList = (requests, onlyTable) => {
        if (!Array.isArray(requests) || requests.length === 0) {
            if (onlyTable) {
                return '';
            }
            return '<p class="admin-panel-placeholder">Немає запитів на зміну або видалення.</p>';
        }

        const rows = requests
            .map((row) => {
                const author =
                    `${escapeHtml(row.first_name || '')} ${escapeHtml(row.last_name || '')}`.trim() || '—';
                const typeLabel = row.request_type === 'delete' ? 'Видалення' : 'Редагування';
                const oldRating = renderReviewStars(row.rating);
                const newRating =
                    row.request_type === 'edit' ? renderReviewStars(row.new_rating) : '—';
                const oldText = escapeHtml(String(row.comment || '').slice(0, 120));
                const newText =
                    row.request_type === 'edit'
                        ? escapeHtml(String(row.new_comment || '').slice(0, 120))
                        : '—';

                return `
            <tr class="admin-review-row" data-search="${escapeHtml(String(row.product_name || '') + ' ' + author + ' ' + String(row.comment || '') + ' ' + String(row.new_comment || '') + ' ' + row.request_id)}">
                <td>${row.request_id}</td>
                <td>${typeLabel}</td>
                <td>${escapeHtml(row.product_name || '—')}</td>
                <td>${author}</td>
                <td>${oldRating}<br />${oldText}</td>
                <td>${newRating}<br />${newText}</td>
                <td>${escapeHtml(formatReviewDate({ createdAt: row.request_at }))}</td>
                <td class="admin-review-actions-cell">
                    ${
                        row.request_type === 'delete'
                            ? `<button type="button" class="admin-primary-btn admin-request-approve-delete" data-id="${row.request_id}">Видалити</button>`
                            : `<button type="button" class="admin-primary-btn admin-request-approve-edit" data-id="${row.request_id}">Застосувати</button>`
                    }
                    <button type="button" class="admin-secondary-btn admin-request-reject" data-id="${row.request_id}">Відхилити</button>
                </td>
            </tr>`;
            })
            .join('');

        const headBlock = onlyTable
            ? '<h3>Запити на зміну відгуків</h3>'
            : `<h3>Запити на зміну відгуків</h3>
            <div class="admin-filters">
                <label>Пошук <input type="search" id="admin-reviews-search" placeholder="Товар, автор, текст"></label>
                <span id="admin-reviews-search-count"></span>
            </div>`;

        return `
            ${headBlock}
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Тип</th>
                            <th>Товар</th>
                            <th>Користувач</th>
                            <th>Було</th>
                            <th>Запит</th>
                            <th>Дата</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>${rows}${onlyTable ? '' : '<tr id="admin-reviews-empty-search" hidden><td colspan="8">Немає збігів</td></tr>'}</tbody>
                </table>
            </div>
        `;
    };

    const bindReviewsSearch = () => {
        bindTableSearch(
            'admin-reviews-search',
            'admin-reviews-search-count',
            'admin-reviews-empty-search',
            'tr.admin-review-row',
            (row) => row.getAttribute('data-search') || ''
        );
    };

    const bindChangeRequestActions = () => {
        content.querySelectorAll('.admin-request-approve-edit').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    await apiFetch(`/api/admin/review-requests/${id}/approve-edit`, { method: 'POST' });
                    showMessage('Відгук оновлено');
                    await loadPendingReviews();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-request-approve-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Видалити відгук за запитом користувача?')) {
                    return;
                }
                try {
                    await apiFetch(`/api/admin/review-requests/${id}/approve-delete`, { method: 'POST' });
                    showMessage('Відгук видалено');
                    await loadPendingReviews();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-request-reject').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    await apiFetch(`/api/admin/review-requests/${id}/reject`, { method: 'POST' });
                    showMessage('Запит відхилено');
                    await loadPendingReviews();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });
    };

const renderPendingReviewsList = (reviews, requests) => {
        const reqList = Array.isArray(requests) ? requests : [];
        const revList = Array.isArray(reviews) ? reviews : [];

        if (revList.length === 0 && reqList.length === 0) {
            content.innerHTML =
                '<h3>Відгуки на модерацію</h3><p class="admin-panel-placeholder">Немає відгуків, що очікують рішення.</p>';
            return;
        }

        if (revList.length === 0) {
            content.innerHTML = renderChangeRequestsList(reqList);
            bindChangeRequestActions();
            bindReviewsSearch();
            return;
        }

        const rows = reviews
            .map((r) => {
                const author =
                    `${escapeHtml(r.first_name || '')} ${escapeHtml(r.last_name || '')}`.trim() ||
                    '—';
            const rating = renderReviewStars(r.rating);
                   const fullComment = String(r.comment || '');
                const commentPreview = escapeHtml(fullComment.slice(0, 200));
                const tail = fullComment.length > 200 ? '…' : '';

                return `
            <tr class="admin-review-row" data-search="${escapeHtml(String(r.product_name || '') + ' ' + author + ' ' + fullComment + ' ' + r.id)}">
                <td>${r.id}</td>
                <td>${escapeHtml(r.product_name || '—')}</td>
                <td>${author}</td>
                <td>${rating}</td>
                <td>${escapeHtml(formatReviewDate(r))}</td>
                <td class="admin-review-comment-cell">${commentPreview}${tail}</td>
                <td class="admin-review-actions-cell">
                    <button type="button" class="admin-primary-btn admin-review-approve" data-id="${r.id}">Схвалити</button>
                    <button type="button" class="admin-secondary-btn admin-review-delete" data-id="${r.id}">Видалити</button>
                </td>
            </tr>`;
            })
            .join('');

        content.innerHTML = `
            <h3>Відгуки на модерацію</h3>
            <div class="admin-filters">
                <label>Пошук <input type="search" id="admin-reviews-search" placeholder="Товар, автор, текст"></label>
                <span id="admin-reviews-search-count"></span>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Товар</th>
                            <th>Автор</th>
                            <th>Оцінка</th>
                            <th>Дата</th>
                            <th>Текст</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>${rows}<tr id="admin-reviews-empty-search" hidden><td colspan="7">Немає збігів</td></tr></tbody>
                </table>
            </div>
            ${renderChangeRequestsList(reqList, true)}
        `;

        bindReviewsSearch();

    content.querySelectorAll('.admin-review-approve').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Схвалити цей відгук і показати на сайті?')) {
                    return;
                }
            try {
                    await apiFetch(`/api/admin/reviews/${id}/approve`, { method: 'POST' });
                    showMessage('Відгук схвалено');
                    await loadPendingReviews();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-review-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Видалити цей відгук назавжди?')) {
                    return;
                }
                   try {
                  await apiFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
                    showMessage('Відгук видалено');
                       await loadPendingReviews();
                } catch (err) {
                    showMessage(err.message, true);
            }
            });
        });

        bindChangeRequestActions();
    };

    const loadPendingReviews = async () => {
        try {
     const data = await apiFetch('/api/admin/reviews');
            renderPendingReviewsList(
                Array.isArray(data.reviews) ? data.reviews : [],
                Array.isArray(data.requests) ? data.requests : []
            );
     } catch (err) {
               showMessage(err.message, true);
        }
    };

    const formatOrderDate = (order) => {
        const raw = order.createdAt || order.createdat;
        if (!raw) {
            return '—';
        }
        try {
            return new Date(raw).toLocaleString('uk-UA');
        } catch (e) {
            return '—';
        }
    };

    const formatDeliveryWhen = (order) => {
        if (order.delivery_display) {
            return order.delivery_display;
        }

        const raw = order.delivery_date;
        if (!raw) {
            return '—';
        }

        const text = String(raw).trim();
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
        let dateText = '';
        if (iso) {
            dateText = iso[3] + '.' + iso[2] + '.' + iso[1];
        }

        const slot = order.delivery_timeslot ? String(order.delivery_timeslot).slice(0, 5) : '';
        if (dateText && slot) {
            return dateText + ', ' + slot;
        }
        if (dateText) {
            return dateText;
        }
        return '—';
    };

    const paymentLabel = (status) => {
        if (status === 'paid') {
            return 'Оплачено';
        }
        if (status === 'cod') {
            return 'Оплата при отриманні';
        }
        return 'Не оплачено';
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

    const paymentInfoHtml = (order) => {
        const label = escapeHtml(paymentLabel(order.payment_status));
        const paidAt = formatLiqpayPaidAt(order);
        if (!paidAt) {
            return label;
        }
        return `${label}<br /><span class="warehouse-orders-email">LiqPay: ${escapeHtml(paidAt)}</span>`;
    };

    const openOrderDetail = async (orderId) => {
        if (window.adminPanelExtra && window.adminPanelExtra.renderOrderDetail) {
            await window.adminPanelExtra.renderOrderDetail(window.adminPanelApi, orderId, 'moderation');
        }
    };

    const renderPendingOrdersList = (orders) => {
        if (!Array.isArray(orders) || orders.length === 0) {
            content.innerHTML =
                '<h3>Замовлення на модерацію</h3><p class="admin-panel-placeholder">Немає нових замовлень.</p>';
            return;
        }

        const rows = orders
            .map((o) => {
                let customer =
                    `${escapeHtml(o.first_name || '')} ${escapeHtml(o.last_name || '')}`.trim();
                if (!customer && o.receiver_name) {
                    customer = escapeHtml(o.receiver_name) + ' <span class="warehouse-orders-email">(гість)</span>';
                }
                if (!customer) {
                    customer = '—';
                }
                const products = escapeHtml(o.products_summary || '—');
                const address = escapeHtml(String(o.delivery_address || '').slice(0, 120));
                const total = Number(o.total_price || 0).toLocaleString('uk-UA');
                let methodText = '—';
                if (o.delivery_method === 'standard') {
                    methodText = 'Стандарт';
                } else if (o.delivery_method === 'exact') {
                    methodText = 'Точний час';
                } else if (o.delivery_method === 'express') {
                    methodText = 'Експрес';
                } else if (o.delivery_method === 'pickup') {
                    methodText = 'Самовивіз';
                }
                methodText = escapeHtml(methodText);
                const cancelMark = o.cancel_request_at
                    ? '<br /><span class="warehouse-orders-email">⚠ Запит на скасування</span>'
                    : '';
                const cancelNote = o.cancel_request_note
                    ? '<br /><span class="warehouse-orders-email">' + escapeHtml(String(o.cancel_request_note).slice(0, 80)) + '</span>'
                    : '';

                let actionCell = '';
                if (o.cancel_request_at) {
                    actionCell = `
                    <button type="button" class="admin-primary-btn admin-order-cancel-approve" data-id="${o.id}">Скасувати</button>
                    <button type="button" class="admin-secondary-btn admin-order-cancel-reject" data-id="${o.id}">Залишити</button>`;
                } else {
                    actionCell = `
                    <button type="button" class="admin-secondary-btn admin-order-detail-btn" data-id="${o.id}">Деталі</button>
                    <button type="button" class="admin-primary-btn admin-order-approve" data-id="${o.id}">На склад</button>
                    <button type="button" class="admin-secondary-btn admin-order-reject" data-id="${o.id}">Відхилити</button>`;
                }

                const searchText = escapeHtml(
                    String(o.id) +
                        ' ' +
                        String(o.first_name || '') +
                        ' ' +
                        String(o.last_name || '') +
                        ' ' +
                        String(o.receiver_name || '') +
                        ' ' +
                        String(o.customer_email || '') +
                        ' ' +
                        String(o.products_summary || '') +
                        ' ' +
                        String(o.delivery_address || '')
                );

                return `
            <tr class="admin-order-row" data-search="${searchText}">
                <td>${o.id}</td>
                <td>${escapeHtml(formatOrderDate(o))}</td>
                <td>${customer}<br /><span class="warehouse-orders-email">${escapeHtml(o.customer_email || '')}</span>${cancelMark}${cancelNote}</td>
                <td>${products}</td>
                <td>${total} грн<br />${paymentInfoHtml(o)}<br /><span class="warehouse-orders-email">${methodText}</span></td>
                <td>${escapeHtml(formatDeliveryWhen(o))}</td>
                <td class="admin-review-comment-cell">${address}</td>
                <td class="admin-review-actions-cell">${actionCell}</td>
            </tr>`;
            })
            .join('');

        content.innerHTML = `
            <h3>Замовлення на модерацію</h3>
            <div class="admin-filters">
                <label>Пошук <input type="search" id="admin-pending-orders-search" placeholder="№, клієнт, email, адреса"></label>
                <span id="admin-pending-orders-search-count"></span>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Створено</th>
                            <th>Клієнт</th>
                            <th>Товари</th>
                            <th>Сума</th>
                            <th>Доставка</th>
                            <th>Адреса</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>${rows}<tr id="admin-pending-orders-empty-search" hidden><td colspan="8">Немає збігів</td></tr></tbody>
                </table>
            </div>
        `;

        bindTableSearch(
            'admin-pending-orders-search',
            'admin-pending-orders-search-count',
            'admin-pending-orders-empty-search',
            'tr.admin-order-row',
            (row) => row.getAttribute('data-search') || ''
        );

        content.querySelectorAll('.admin-order-detail-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (id) {
                    try {
                        await openOrderDetail(Number(id));
                    } catch (err) {
                        showMessage(err.message, true);
                    }
                }
            });
        });

        content.querySelectorAll('.admin-order-approve').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Підтвердити замовлення і відправити на склад?')) {
                    return;
                }
                try {
                    await apiFetch(`/api/admin/orders/${id}/approve`, { method: 'POST' });
                    showMessage('Замовлення відправлено на склад');
                    await loadPendingOrders();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-order-reject').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Відхилити це замовлення? На склад воно не потрапить.')) {
                    return;
                }
                try {
                    await apiFetch(`/api/admin/orders/${id}/reject`, { method: 'POST' });
                    showMessage('Замовлення відхилено');
                    await loadPendingOrders();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-order-cancel-approve').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Підтвердити скасування? Для оплачених замовлень буде запит на повернення LiqPay.')) {
                    return;
                }
                try {
                    const data = await apiFetch(`/api/admin/orders/${id}/cancel/approve`, { method: 'POST' });
                    showMessage(data.message || 'Замовлення скасовано');
                    await loadPendingOrders();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });

        content.querySelectorAll('.admin-order-cancel-reject').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    const data = await apiFetch(`/api/admin/orders/${id}/cancel/reject`, { method: 'POST' });
                    showMessage(data.message || 'Запит відхилено');
                    await loadPendingOrders();
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });
    };

    const loadPendingOrders = async () => {
        try {
            const data = await apiFetch('/api/admin/orders');
            renderPendingOrdersList(Array.isArray(data.orders) ? data.orders : []);
        } catch (err) {
            showMessage(err.message, true);
        }
    };

    const renderAwaitingPaymentList = (orders) => {
        if (!Array.isArray(orders) || orders.length === 0) {
            content.innerHTML = `
                <h3>Очікують оплату</h3>
                <div class="admin-empty-state">
                    <p>Немає замовлень, що чекають на оплату.</p>
                    <button type="button" class="admin-secondary-btn" id="admin-awaiting-go-all">Усі замовлення</button>
                </div>`;
            const goAll = document.getElementById('admin-awaiting-go-all');
            if (goAll && window.adminPanelExtra && window.adminPanelExtra.loadAllOrders) {
                goAll.addEventListener('click', () => {
                    setActiveMenu('ordersAll');
                    window.adminPanelExtra.loadAllOrders(window.adminPanelApi);
                });
            }
            return;
        }

        const rows = orders
            .map((o) => {
                const customer =
                    `${escapeHtml(o.first_name || '')} ${escapeHtml(o.last_name || '')}`.trim() || '—';
                const total = Number(o.total_price || 0).toLocaleString('uk-UA');
                const deadline = o.payment_deadline_at
                    ? escapeHtml(String(o.payment_deadline_at).slice(0, 16).replace('T', ' '))
                    : '—';
                return `
            <tr>
                <td>${o.id}</td>
                <td>${customer}<br /><span class="warehouse-orders-email">${escapeHtml(o.customer_email || '')}</span></td>
                <td>${total} грн</td>
                <td>${deadline}</td>
                <td><button type="button" class="admin-edit-btn admin-awaiting-open" data-id="${o.id}">Деталі</button></td>
            </tr>`;
            })
            .join('');

        content.innerHTML = `
            <h3>Очікують оплату</h3>
            <p class="admin-panel-placeholder">Ці замовлення ще не оплачені. Після 10 хвилин скасовуються автоматично.</p>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>№</th><th>Клієнт</th><th>Сума</th><th>Дедлайн оплати</th><th></th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        content.querySelectorAll('.admin-awaiting-open').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (window.adminPanelExtra && window.adminPanelExtra.renderOrderDetail) {
                    await window.adminPanelExtra.renderOrderDetail(window.adminPanelApi, id, 'awaiting');
                }
            });
        });
    };

    const loadAwaitingPaymentOrders = async () => {
        try {
            const data = await apiFetch('/api/admin/orders/awaiting-payment');
            renderAwaitingPaymentList(Array.isArray(data.orders) ? data.orders : []);
        } catch (err) {
            showMessage(err.message, true);
        }
    };

    showListBtn.addEventListener('click', () => {
        showMessage('');
        setActiveMenu('list');
        loadProductList();
    });

    showCreateBtn.addEventListener('click', async () => {
        showMessage('');
        setActiveMenu('create');
        try {
            await renderForm(null);
        } catch (err) {
            showMessage(err.message, true);
        }
    });

    showReviewsBtn.addEventListener('click', () => {
        showMessage('');
        setActiveMenu('reviews');
        loadPendingReviews();
    });

    showOrdersBtn.addEventListener('click', () => {
        showMessage('');
        setActiveMenu('orders');
        loadPendingOrders();
    });

    if (showOrdersAwaitingBtn) {
        showOrdersAwaitingBtn.addEventListener('click', () => {
            showMessage('');
            setActiveMenu('orders-awaiting');
            loadAwaitingPaymentOrders();
        });
    }

    window.adminPanelApi.setProductStockFilter = (stock) => {
        productListState.stock = stock || 'all';
    };

    window.adminPanelApi.saveAdminView = saveAdminView;
    window.adminPanelApi.setActiveMenu = setActiveMenu;
    window.adminPanelApi.showMessage = showMessage;
    window.adminPanelApi.showAdminLoading = showAdminLoading;
    window.adminPanelApi.openProductEdit = openProductEdit;
    window.adminPanelApi.escapeHtml = escapeHtml;
    window.adminPanelApi.apiFetch = apiFetch;
    window.adminPanelApi.uploadCategoryPhoto = uploadCategoryPhoto;
    window.adminPanelApi.loadProductList = loadProductList;
    window.adminPanelApi.renderForm = renderForm;
    window.adminPanelApi.loadPendingReviews = loadPendingReviews;
    window.adminPanelApi.loadPendingOrders = loadPendingOrders;
    window.adminPanelApi.loadAwaitingPaymentOrders = loadAwaitingPaymentOrders;

    window.adminPanelApi.restoreAdminPanelView = async () => {
        if (typeof window.loadFormDraftView !== 'function') {
            return false;
        }
        const state = window.loadFormDraftView(ADMIN_VIEW_KEY);
        if (!state || !state.view) {
            return false;
        }
        try {
            if (state.view === 'products-list') {
                setActiveMenu('list');
                await loadProductList();
                return true;
            }
            if (state.view === 'reviews') {
                setActiveMenu('reviews');
                await loadPendingReviews();
                return true;
            }
            if (state.view === 'orders-pending') {
                setActiveMenu('orders');
                await loadPendingOrders();
                return true;
            }
            if (state.view === 'orders-awaiting') {
                setActiveMenu('orders-awaiting');
                await loadAwaitingPaymentOrders();
                return true;
            }
            if (state.view === 'product-create') {
                setActiveMenu('create');
                await renderForm(null);
                return true;
            }
            if (state.view === 'product-edit' && state.productId) {
                const data = await apiFetch('/api/admin/products/' + state.productId);
                setActiveMenu('create');
                await renderForm(data.product);
                return true;
            }
        } catch (err) {
            return false;
        }
        return false;
    };
})();
