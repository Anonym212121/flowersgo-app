(() => {
    const content = document.getElementById('admin-panel-content');
    const message = document.getElementById('admin-panel-message');
    const showListBtn = document.getElementById('admin-show-list');
    const showCreateBtn = document.getElementById('admin-show-create');
    const showReviewsBtn = document.getElementById('admin-show-reviews');

    if (!content || !message || !showListBtn || !showCreateBtn || !showReviewsBtn) {
        return;
    }

    const setActiveMenu = (mode) => {
        showListBtn.classList.toggle('active', mode === 'list');
        showCreateBtn.classList.toggle('active', mode === 'create');
        showReviewsBtn.classList.toggle('active', mode === 'reviews');
    };

    const showMessage = (text, isError = false) => {
        message.textContent = text || '';
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
            is_active: formData.get('is_active') === '1' ? 1 : 0
        };
    };

    const renderForm = async (product = null) => {
        const isEdit = !!product;
        const productId = product ? product.id : '';
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
                '<p class="admin-form-note">Категорії не завантажені або їх немає в базі. Перезапусти сервер бекенду (Node), перевір підключення до MySQL і таблицю categories.</p>';
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
                <div class="admin-product-photo-block">
                    <label class="admin-photo-label">Фото товару (jpeg, png, webp, gif, до 5 МБ)
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

        backBtn.addEventListener('click', () => {
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
                        await loadProductList();
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
                await loadProductList();
            } catch (err) {
                showMessage(err.message, true);
            }
        });
    };

    const renderProductList = (products) => {
        const rows = products.map((p) => `
            <tr>
                <td>${p.id}</td>
                <td class="admin-table-photo">${
                    p.image_url
                        ? `<img class="admin-table-thumb" src="${escapeHtml(p.image_url)}" alt="">`
                        : '—'
                }</td>
                <td>${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.category_name)}</td>
                <td>${escapeHtml(p.sale_price)}</td>
                <td>${Number(p.is_active) === 1 ? 'Так' : 'Ні'}</td>
                <td><button type="button" class="admin-edit-btn" data-id="${p.id}">Редагувати</button></td>
            </tr>
        `).join('');

        content.innerHTML = `
            <h3>Список товарів</h3>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Фото</th>
                            <th>Назва</th>
                            <th>Категорія</th>
                            <th>Ціна</th>
                            <th>Активний</th>
                            <th>Дія</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="7">Товари відсутні</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        const editButtons = content.querySelectorAll('.admin-edit-btn');
        editButtons.forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    const data = await apiFetch(`/api/admin/products/${id}`);
                    await renderForm(data.product);
                } catch (err) {
                    showMessage(err.message, true);
                }
            });
        });
    };

    const loadProductList = async () => {
        try {
            const data = await apiFetch('/api/admin/products');
            renderProductList(Array.isArray(data.products) ? data.products : []);
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
        content.innerHTML =
            '<p class="admin-panel-placeholder">відгукт</p>';
    });

    setActiveMenu('list');
    loadProductList();
})();
