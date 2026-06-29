(() => {
    const buildStemOptions = (stems) => {
        const list = Array.isArray(stems) ? stems : [];
        return list
            .map((stem) => {
                const label = stem.category_name || stem.name || 'Квітка';
                return `<option value="${stem.id}">${label}</option>`;
            })
            .join('');
    };

    const buildPackagingOptions = (options, selectedId) => {
        const list = Array.isArray(options) ? options : [];
        return list
            .map((opt) => {
                const sel = Number(selectedId) === Number(opt.id) ? ' selected' : '';
                const price = Number(opt.price || 0);
                const priceText = price > 0 ? ` (+${price} грн)` : '';
                return `<option value="${opt.id}"${sel}>${opt.label || opt.name}${priceText}</option>`;
            })
            .join('');
    };

    const variantOptionsForStem = (stems, productId, selectedVariantId) => {
        const list = Array.isArray(stems) ? stems : [];
        const stem = list.find((row) => Number(row.id) === Number(productId));
        const variants = stem && Array.isArray(stem.variants) ? stem.variants : [];
        if (variants.length === 0) {
            return '<option value="">—</option>';
        }
        return variants
            .map((v) => {
                const sel = Number(selectedVariantId) === Number(v.id) ? ' selected' : '';
                return `<option value="${v.id}"${sel}>${v.flower_color || 'Колір'}</option>`;
            })
            .join('');
    };

    const renderItemRow = (api, stems, item, index) => {
        const productId = item ? item.product_id : '';
        const variantId = item && item.color_variant_id ? item.color_variant_id : '';
        const qty = item && item.quantity ? item.quantity : 1;
        return `
            <div class="admin-template-item-row" data-index="${index}">
                <label>Квітка
                    <select class="admin-template-item-product" required>
                        <option value="">Обери…</option>
                        ${buildStemOptions(stems)}
                    </select>
                </label>
                <label>Колір
                    <select class="admin-template-item-color">
                        ${variantOptionsForStem(stems, productId, variantId)}
                    </select>
                </label>
                <label>К-сть
                    <input class="admin-template-item-qty" type="number" min="1" max="999" value="${qty}" required>
                </label>
                <button type="button" class="admin-secondary-btn admin-template-item-remove">×</button>
            </div>
        `;
    };

    const collectItemsFromForm = (form) => {
        const rows = form.querySelectorAll('.admin-template-item-row');
        const items = [];
        rows.forEach((row) => {
            const productSel = row.querySelector('.admin-template-item-product');
            const colorSel = row.querySelector('.admin-template-item-color');
            const qtyInput = row.querySelector('.admin-template-item-qty');
            const product_id = Number(productSel && productSel.value);
            const quantity = Math.floor(Number(qtyInput && qtyInput.value));
            let color_variant_id = null;
            if (colorSel && colorSel.value) {
                const vid = Number(colorSel.value);
                if (Number.isFinite(vid) && vid > 0) {
                    color_variant_id = vid;
                }
            }
            if (!Number.isFinite(product_id) || product_id <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
                return;
            }
            items.push({ product_id, color_variant_id, quantity });
        });
        return items;
    };

    const bindItemRows = (form, stems) => {
        const refreshColorSelect = (row) => {
            const productSel = row.querySelector('.admin-template-item-product');
            const colorSel = row.querySelector('.admin-template-item-color');
            if (!productSel || !colorSel) {
                return;
            }
            const prev = colorSel.value;
            colorSel.innerHTML = variantOptionsForStem(stems, productSel.value, prev);
        };

        form.querySelectorAll('.admin-template-item-row').forEach((row) => {
            const productSel = row.querySelector('.admin-template-item-product');
            if (productSel) {
                productSel.addEventListener('change', () => refreshColorSelect(row));
            }
            const removeBtn = row.querySelector('.admin-template-item-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    row.remove();
                });
            }
        });
    };

    const setItemRowValues = (form, items) => {
        const rows = form.querySelectorAll('.admin-template-item-row');
        rows.forEach((row, idx) => {
            const item = items[idx];
            if (!item) {
                return;
            }
            const productSel = row.querySelector('.admin-template-item-product');
            const colorSel = row.querySelector('.admin-template-item-color');
            const qtyInput = row.querySelector('.admin-template-item-qty');
            if (productSel) {
                productSel.value = String(item.product_id);
            }
            if (colorSel) {
                colorSel.innerHTML = variantOptionsForStem(
                    window.__adminTemplateStems || [],
                    item.product_id,
                    item.color_variant_id
                );
                if (item.color_variant_id) {
                    colorSel.value = String(item.color_variant_id);
                }
            }
            if (qtyInput) {
                qtyInput.value = String(item.quantity || 1);
            }
        });
    };

    const renderTemplatesList = (api, templates) => {
        const rows = (templates || [])
            .map((t) => {
                const totalText = t.total != null ? `${Number(t.total).toFixed(0)} грн` : '—';
                return `
                    <tr>
                        <td>${t.id}</td>
                        <td>${api.escapeHtml(t.name)}</td>
                        <td>${Number(t.items_count || 0)}</td>
                        <td>${Number(t.stem_total || 0)}</td>
                        <td>${totalText}</td>
                        <td>${Number(t.is_active) === 1 ? 'Так' : 'Ні'}</td>
                        <td>
                            <button type="button" class="admin-edit-btn admin-template-edit" data-id="${t.id}">Редагувати</button>
                            <button type="button" class="admin-secondary-btn admin-template-toggle" data-id="${t.id}" data-active="${Number(t.is_active) === 1 ? '1' : '0'}">${Number(t.is_active) === 1 ? 'Вимкнути' : 'Увімкнути'}</button>
                            <button type="button" class="admin-secondary-btn admin-template-delete" data-id="${t.id}">Видалити</button>
                        </td>
                    </tr>
                `;
            })
            .join('');

        return `
            <div class="admin-bouquet-templates">
                <div class="admin-bouquet-templates__head">
                    <h4>Бібліотека готових букетів</h4>
                    <button type="button" id="admin-template-add" class="admin-primary-btn">Додати шаблон</button>
                </div>
                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Назва</th>
                                <th>Позицій</th>
                                <th>Квіток</th>
                                <th>Ціна</th>
                                <th>Активний</th>
                                <th>Дія</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="7">Шаблонів ще немає</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
    };

    const renderEditor = (api, data, templateId) => {
        const template = data.template || {};
        const items = Array.isArray(data.items) ? data.items : [];
        const packagingOptions = data.packaging_options || [];
        const stems = data.constructor_stems || [];
        window.__adminTemplateStems = stems;

        const itemRows = items.length
            ? items.map((item, idx) => renderItemRow(api, stems, item, idx)).join('')
            : renderItemRow(api, stems, null, 0);

        return `
            <div class="admin-template-editor">
                <div class="admin-template-editor__head">
                    <h4>${templateId ? 'Редагування шаблону' : 'Новий шаблон'}</h4>
                    <button type="button" id="admin-template-editor-back" class="admin-secondary-btn">← До списку</button>
                </div>
                <form id="admin-template-form" class="admin-form">
                    <label>Назва <input name="name" type="text" maxlength="200" required value="${api.escapeHtml(template.name || '')}"></label>
                    <label>Опис <textarea name="description" rows="3" maxlength="2000">${api.escapeHtml(template.description || '')}</textarea></label>
                    <label>URL фото (необовʼязково) <input name="image_url" type="text" maxlength="255" value="${api.escapeHtml(template.image_url || '')}"></label>
                    <label>Упаковка
                        <select name="packaging_product_id">
                            <option value="">Стандарт</option>
                            ${buildPackagingOptions(packagingOptions, template.packaging_product_id)}
                        </select>
                    </label>
                    <label>Порядок <input name="sort_order" type="number" value="${Number(template.sort_order || 0)}"></label>
                    <label>Активний
                        <select name="is_active">
                            <option value="1" ${Number(template.is_active) === 0 ? '' : 'selected'}>Так</option>
                            <option value="0" ${Number(template.is_active) === 0 ? 'selected' : ''}>Ні</option>
                        </select>
                    </label>
                    <fieldset class="admin-template-items-fieldset">
                        <legend>Склад букета</legend>
                        <div id="admin-template-items">${itemRows}</div>
                        <button type="button" id="admin-template-add-item" class="admin-secondary-btn">+ Додати квітку</button>
                    </fieldset>
                    <button type="submit" class="admin-primary-btn">Зберегти шаблон</button>
                </form>
            </div>
        `;
    };

    const loadTemplatesList = async (api, root) => {
        const data = await api.apiFetch('/api/admin/bouquet-templates');
        root.innerHTML = renderTemplatesList(api, data.templates || []);
        bindTemplatesList(api, root, loadTemplatesList);
    };

    const openEditor = async (api, root, templateId) => {
        let data;
        if (templateId) {
            data = await api.apiFetch('/api/admin/bouquet-templates/' + templateId);
        } else {
            data = await api.apiFetch('/api/admin/bouquet-templates/form-data');
            data.template = { is_active: 1, sort_order: 0 };
            data.items = [{ product_id: '', quantity: 11 }];
        }

        root.innerHTML = renderEditor(api, data, templateId);
        const form = document.getElementById('admin-template-form');
        const stems = data.constructor_stems || [];
        window.__adminTemplateStems = stems;

        if (templateId && data.items) {
            setItemRowValues(form, data.items);
        }

        bindItemRows(form, stems);

        document.getElementById('admin-template-editor-back').addEventListener('click', () => {
            loadTemplatesList(api, root);
        });

        document.getElementById('admin-template-add-item').addEventListener('click', () => {
            const wrap = document.getElementById('admin-template-items');
            const idx = wrap.querySelectorAll('.admin-template-item-row').length;
            wrap.insertAdjacentHTML('beforeend', renderItemRow(api, stems, null, idx));
            bindItemRows(form, stems);
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const body = {};
            fd.forEach((val, key) => {
                body[key] = val;
            });
            body.items = collectItemsFromForm(form);
            if (body.items.length === 0) {
                api.showMessage('Додай хоча б одну квітку', true);
                return;
            }
            try {
                if (templateId) {
                    await api.apiFetch('/api/admin/bouquet-templates/' + templateId, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    api.showMessage('Шаблон збережено');
                } else {
                    await api.apiFetch('/api/admin/bouquet-templates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    api.showMessage('Шаблон створено');
                }
                await loadTemplatesList(api, root);
            } catch (err) {
                api.showMessage(err.message, true);
            }
        });
    };

    const bindTemplatesList = (api, root, reloadFn) => {
        const addBtn = root.querySelector('#admin-template-add');
        if (addBtn) {
            addBtn.addEventListener('click', () => openEditor(api, root, null));
        }

        root.querySelectorAll('.admin-template-edit').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                openEditor(api, root, id);
            });
        });

        root.querySelectorAll('.admin-template-toggle').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const active = btn.getAttribute('data-active') === '1';
                try {
                    await api.apiFetch('/api/admin/bouquet-templates/' + id + '/toggle-active', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active: active ? 0 : 1 })
                    });
                    api.showMessage(active ? 'Шаблон вимкнено' : 'Шаблон увімкнено');
                    await reloadFn(api, root);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        });

        root.querySelectorAll('.admin-template-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!window.confirm('Видалити цей шаблон?')) {
                    return;
                }
                try {
                    await api.apiFetch('/api/admin/bouquet-templates/' + id, { method: 'DELETE' });
                    api.showMessage('Шаблон видалено');
                    await reloadFn(api, root);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        });
    };

    window.loadBouquetTemplatesAdminSection = async (api, root) => {
        if (!root) {
            return;
        }
        try {
            await loadTemplatesList(api, root);
        } catch (err) {
            root.innerHTML = '<p class="admin-note">' + (err.message || 'Помилка') + '</p>';
        }
    };
})();
