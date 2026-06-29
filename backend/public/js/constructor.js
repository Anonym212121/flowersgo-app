(function () {
    var cfg = window.constructorConfig;
    var grid = document.getElementById('constructorGrid');
    if (!cfg || !grid) {
        return;
    }

    var summaryList = document.getElementById('constructorSummaryList');
    var stemOut = document.getElementById('constructorStemCount');
    var totalOut = document.getElementById('constructorTotal');
    var hintEl = document.getElementById('constructorHint');
    var addBtn = document.getElementById('constructorAddBtn');
    var clearBtn = document.getElementById('constructorClearBtn');
    var packSel = document.getElementById('constructorPackaging');
    var previewBtn = document.getElementById('constructorPreviewBtn');
    var previewCloseBtn = document.getElementById('constructorPreviewClose');
    var previewFrame = document.getElementById('constructorPreviewFrame');
    var previewImg = document.getElementById('constructorPreviewImg');
    var previewStatus = document.getElementById('constructorPreviewStatus');
    var mobileBar = document.getElementById('constructorMobileBar');
    var mobileTotal = document.getElementById('constructorMobileTotal');
    var mobileStems = document.getElementById('constructorMobileStems');
    var mobileAddBtn = document.getElementById('constructorMobileAddBtn');

    var calcTimer = null;
    var lastOk = false;
    var draftStorageKey = cfg.draftStorageKey || 'flowersgo_constructor_draft';
    var previewStorageKey = cfg.previewStorageKey || draftStorageKey + '_preview';
    var savedPreviewUrl = '';

    function msg(text, ok) {
        if (typeof window.showToast === 'function') {
            window.showToast(text, ok ? 'ok' : 'error');
        }
    }

    function isMultiColorCard(card) {
        if (!card) {
            return false;
        }
        if (card.getAttribute('data-multi-color') === '1') {
            return true;
        }
        var swatches = card.querySelectorAll('.constructor-color-swatch:not(:disabled)');
        return swatches.length > 1;
    }

    function variantStorageKey(raw) {
        if (raw === undefined || raw === null || raw === '') {
            return '_';
        }
        var id = Number(raw);
        if (Number.isFinite(id) && id > 0) {
            return String(id);
        }
        return '_';
    }

    function getVariantQtyMap(card) {
        if (!card._variantQtys) {
            card._variantQtys = {};
        }
        return card._variantQtys;
    }

    function saveCurrentVariantQty(card) {
        var input = card.querySelector('[data-qty-input]');
        if (!input) {
            return;
        }
        var key = variantStorageKey(card.getAttribute('data-variant-id'));
        var val = Math.floor(Number(input.value || 0));
        if (!Number.isFinite(val) || val < 0) {
            val = 0;
        }
        getVariantQtyMap(card)[key] = val;
    }

    function loadVariantQty(card, variantId, stock) {
        var input = card.querySelector('[data-qty-input]');
        if (!input) {
            return;
        }
        var key = variantStorageKey(variantId);
        var map = getVariantQtyMap(card);
        var val = map[key] != null ? Math.floor(Number(map[key])) : 0;
        if (!Number.isFinite(val) || val < 0) {
            val = 0;
        }
        if (val > stock) {
            val = stock;
            map[key] = val;
        }
        input.setAttribute('max', String(stock));
        input.value = String(val);
    }

    function getItems() {
        var items = [];
        var cards = grid.querySelectorAll('.constructor-card');
        for (var i = 0; i < cards.length; i += 1) {
            var card = cards[i];
            var productId = Number(card.getAttribute('data-product-id'));

            if (isMultiColorCard(card)) {
                saveCurrentVariantQty(card);
                var map = getVariantQtyMap(card);
                var keys = Object.keys(map);
                for (var k = 0; k < keys.length; k += 1) {
                    var qty = Math.floor(Number(map[keys[k]]));
                    if (!Number.isFinite(qty) || qty <= 0) {
                        continue;
                    }
                    var item = {
                        product_id: productId,
                        quantity: qty
                    };
                    if (keys[k] !== '_') {
                        item.color_variant_id = Number(keys[k]);
                    }
                    items.push(item);
                }
                continue;
            }

            var input = card.querySelector('[data-qty-input]');
            if (!input) {
                continue;
            }
            var qty = Math.floor(Number(input.value || 0));
            if (qty > 0) {
                var variantRaw = card.getAttribute('data-variant-id');
                var variantId = variantRaw ? Number(variantRaw) : null;
                var item = {
                    product_id: productId,
                    quantity: qty
                };
                if (variantId && Number.isFinite(variantId) && variantId > 0) {
                    item.color_variant_id = variantId;
                }
                items.push(item);
            }
        }
        return items;
    }

    function findCard(productId) {
        return grid.querySelector('.constructor-card[data-product-id="' + String(productId) + '"]');
    }

    function resetAllCards() {
        var cards = grid.querySelectorAll('.constructor-card');
        for (var i = 0; i < cards.length; i += 1) {
            var card = cards[i];
            card._variantQtys = {};
            var input = card.querySelector('[data-qty-input]');
            if (input) {
                input.value = '0';
            }
        }
    }

    function saveDraft() {
        try {
            var items = getItems();
            if (items.length === 0) {
                localStorage.removeItem(draftStorageKey);
                return;
            }
            localStorage.setItem(
                draftStorageKey,
                JSON.stringify({
                    items: items,
                    packaging: packSel ? packSel.value : ''
                })
            );
        } catch (err) {}
    }

    function applyDraftItem(item) {
        var card = findCard(item.product_id);
        if (!card) {
            return;
        }

        var qty = Math.floor(Number(item.quantity));
        if (!Number.isFinite(qty) || qty <= 0) {
            return;
        }

        var variantId = item.color_variant_id != null && item.color_variant_id !== '' ? Number(item.color_variant_id) : null;
        if (variantId && !Number.isFinite(variantId)) {
            variantId = null;
        }

        if (isMultiColorCard(card)) {
            var variantKey = variantStorageKey(variantId);
            var swatch = null;
            if (variantId) {
                swatch = card.querySelector('.constructor-color-swatch[data-variant-id="' + String(variantId) + '"]');
            } else {
                swatch = card.querySelector('.constructor-color-swatch[data-variant-id=""]');
            }
            if (swatch && !swatch.disabled) {
                applyVariant(card, swatch);
            }
            var map = getVariantQtyMap(card);
            var input = card.querySelector('[data-qty-input]');
            var max = Number((input && input.getAttribute('max')) || card.getAttribute('data-stock') || qty);
            if (qty > max) {
                qty = max;
            }
            map[variantKey] = qty;
            if (input) {
                input.value = String(qty);
            }
            return;
        }

        var qtyInput = card.querySelector('[data-qty-input]');
        if (!qtyInput) {
            return;
        }
        var stockMax = Number(qtyInput.getAttribute('max') || card.getAttribute('data-stock') || qty);
        if (qty > stockMax) {
            qty = stockMax;
        }
        qtyInput.value = String(qty);
    }

    function syncCardsAfterDraftLoad() {
        var cards = grid.querySelectorAll('.constructor-card');
        for (var i = 0; i < cards.length; i += 1) {
            var card = cards[i];
            if (!isMultiColorCard(card)) {
                continue;
            }
            var map = getVariantQtyMap(card);
            var keys = Object.keys(map);
            var activeKey = variantStorageKey(card.getAttribute('data-variant-id'));
            if (Math.floor(Number(map[activeKey] || 0)) > 0) {
                continue;
            }
            for (var k = 0; k < keys.length; k += 1) {
                if (Math.floor(Number(map[keys[k]] || 0)) <= 0) {
                    continue;
                }
                var selector =
                    keys[k] === '_'
                        ? '.constructor-color-swatch[data-variant-id=""]'
                        : '.constructor-color-swatch[data-variant-id="' + keys[k] + '"]';
                var swatch = card.querySelector(selector);
                if (swatch && !swatch.disabled) {
                    applyVariant(card, swatch);
                    var input = card.querySelector('[data-qty-input]');
                    if (input) {
                        input.value = String(map[keys[k]]);
                    }
                }
                break;
            }
        }
    }

    function loadDraft() {
        try {
            var raw = localStorage.getItem(draftStorageKey);
            if (!raw) {
                return false;
            }
            var draft = JSON.parse(raw);
            if (!draft || !Array.isArray(draft.items) || draft.items.length === 0) {
                return false;
            }

            resetAllCards();
            for (var i = 0; i < draft.items.length; i += 1) {
                applyDraftItem(draft.items[i]);
            }
            syncCardsAfterDraftLoad();

            if (packSel && draft.packaging) {
                for (var p = 0; p < packSel.options.length; p += 1) {
                    if (String(packSel.options[p].value) === String(draft.packaging)) {
                        packSel.selectedIndex = p;
                        break;
                    }
                }
            }

            return true;
        } catch (err) {
            return false;
        }
    }

    function getCompositionFingerprint() {
        return JSON.stringify({
            items: getItems(),
            packaging: packSel ? packSel.value : ''
        });
    }

    function clearPreviewOnServer() {
        if (!cfg.previewClearUrl) {
            return;
        }
        fetch(cfg.previewClearUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        }).catch(function () {});
    }

    function updateVariantSwatchBadges(card) {
        if (!card || !isMultiColorCard(card)) {
            return;
        }
        saveCurrentVariantQty(card);
        var map = getVariantQtyMap(card);
        var swatches = card.querySelectorAll('.constructor-color-swatch');
        for (var i = 0; i < swatches.length; i += 1) {
            var sw = swatches[i];
            var key = variantStorageKey(sw.getAttribute('data-variant-id'));
            var qty = Math.floor(Number(map[key] || 0));
            var badge = sw.querySelector('.constructor-color-swatch__qty');
            if (qty > 0) {
                sw.classList.add('constructor-color-swatch--has-qty');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'constructor-color-swatch__qty';
                    sw.appendChild(badge);
                }
                badge.textContent = String(qty);
            } else {
                sw.classList.remove('constructor-color-swatch--has-qty');
                if (badge) {
                    badge.remove();
                }
            }
        }
    }

    function updateAllSwatchBadges() {
        var cards = grid.querySelectorAll('.constructor-card');
        for (var i = 0; i < cards.length; i += 1) {
            updateVariantSwatchBadges(cards[i]);
        }
    }

    function updateMobileBar(data) {
        if (!mobileBar) {
            return;
        }
        var stems = data && data.stemTotal != null ? Number(data.stemTotal) : 0;
        var total = data && data.total != null ? Number(data.total) : 0;
        var hasItems = Number.isFinite(stems) && stems > 0;
        mobileBar.hidden = !hasItems;
        if (mobileTotal) {
            mobileTotal.textContent = total.toLocaleString('uk-UA') + ' грн';
        }
        if (mobileStems) {
            mobileStems.textContent = stems + ' квіток';
        }
        if (mobileAddBtn) {
            mobileAddBtn.disabled = !(data && data.ok);
        }
    }

    function clearPreviewStorage() {
        try {
            localStorage.removeItem(previewStorageKey);
        } catch (err) {}
        savedPreviewUrl = '';
    }

    function savePreviewStorage(url, summary) {
        try {
            if (!url) {
                clearPreviewStorage();
                return;
            }
            var cleanUrl = String(url).split('?')[0];
            localStorage.setItem(
                previewStorageKey,
                JSON.stringify({
                    url: cleanUrl,
                    summary: summary || '',
                    fingerprint: getCompositionFingerprint()
                })
            );
            savedPreviewUrl = cleanUrl;
        } catch (err) {}
    }

    function loadPreviewStorage() {
        try {
            var raw = localStorage.getItem(previewStorageKey);
            if (!raw) {
                return false;
            }
            var data = JSON.parse(raw);
            if (!data || !data.url) {
                return false;
            }
            if (data.fingerprint && data.fingerprint !== getCompositionFingerprint()) {
                clearPreviewStorage();
                return false;
            }
            savedPreviewUrl = data.url;
            showPreviewImage(data.url, true);
            if (data.summary) {
                setPreviewHint(data.summary, true);
            }
            return true;
        } catch (err) {
            return false;
        }
    }

    function closePreview() {
        if (previewFrame) {
            previewFrame.hidden = true;
        }
        if (previewImg) {
            previewImg.removeAttribute('src');
        }
        if (previewStatus) {
            previewStatus.textContent = '';
        }
        clearPreviewStorage();
        clearPreviewOnServer();
    }

    function invalidatePreview() {
        if (savedPreviewUrl || (previewFrame && !previewFrame.hidden)) {
            closePreview();
        }
    }

    function updateClearBtn(stemTotal) {
        if (!clearBtn) {
            return;
        }
        var stems = Number(stemTotal);
        if (!Number.isFinite(stems)) {
            stems = 0;
            var items = getItems();
            for (var i = 0; i < items.length; i += 1) {
                stems += Number(items[i].quantity || 0);
            }
        }
        if (stems <= 0) {
            clearBtn.hidden = true;
            clearBtn.disabled = true;
            return;
        }
        clearBtn.hidden = false;
        clearBtn.disabled = false;
    }

    function clearBouquet() {
        resetAllCards();
        if (packSel && packSel.options.length) {
            packSel.selectedIndex = 0;
        }
        clearDraft();
        closePreview();
        clearTimeout(calcTimer);
        renderSummary(null);
        updateClearBtn();
    }

    function removeLineFromBouquet(productId, variantIdRaw) {
        var card = findCard(productId);
        if (!card) {
            saveDraft();
            scheduleCalc();
            return;
        }

        var variantKey = variantStorageKey(variantIdRaw);

        if (isMultiColorCard(card)) {
            var map = getVariantQtyMap(card);
            map[variantKey] = 0;
            var activeKey = variantStorageKey(card.getAttribute('data-variant-id'));
            if (activeKey === variantKey) {
                var input = card.querySelector('[data-qty-input]');
                if (input) {
                    input.value = '0';
                }
            }
        } else {
            var qtyInput = card.querySelector('[data-qty-input]');
            if (qtyInput) {
                qtyInput.value = '0';
            }
            card._variantQtys = {};
        }

        saveDraft();
        scheduleCalc();
        updateClearBtn();
    }

    function clearDraft() {
        try {
            localStorage.removeItem(draftStorageKey);
        } catch (err) {}
    }

    function applyDraftPayload(draft, toastMessage) {
        if (!draft || !Array.isArray(draft.items)) {
            return false;
        }
        resetAllCards();
        for (var i = 0; i < draft.items.length; i += 1) {
            applyDraftItem(draft.items[i]);
        }
        syncCardsAfterDraftLoad();
        if (packSel && draft.packaging != null && draft.packaging !== '') {
            packSel.value = String(draft.packaging);
        } else if (packSel && packSel.options.length) {
            packSel.selectedIndex = 0;
        }
        saveDraft();
        runCalc();
        updateClearBtn();
        if (toastMessage && typeof window.showToast === 'function') {
            window.showToast(toastMessage, 'ok');
        }
        return true;
    }

    window.constructorApplyDraft = applyDraftPayload;

    function loadTemplateFromSlug(slug) {
        if (!slug) {
            return Promise.resolve(false);
        }
        return fetch('/api/constructor/templates/' + encodeURIComponent(slug), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        })
            .then(function (res) {
                return readJsonResponse(res).then(function (data) {
                    if (!res.ok || !data.draft) {
                        throw new Error((data && data.message) || 'Шаблон не знайдено');
                    }
                    return data;
                });
            })
            .then(function (data) {
                var name = data.template && data.template.name ? data.template.name : 'Шаблон';
                applyDraftPayload(data.draft, 'Завантажено: «' + name + '»');
                var flowers = document.querySelector('.constructor-flowers');
                if (flowers && flowers.scrollIntoView) {
                    flowers.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return true;
            })
            .catch(function (err) {
                msg(err.message || 'Не вдалося завантажити шаблон', false);
                return false;
            });
    }

    function readJsonResponse(res) {
        return res.text().then(function (text) {
            if (!text) {
                return {};
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error('Сервер повернув некоректну відповідь');
            }
        });
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function lineLabel(line) {
        var base = line.category_name || line.name || 'Квітка';
        if (line.flower_color) {
            return base + ' (' + line.flower_color + ')';
        }
        return base;
    }

    function applyVariant(card, btn) {
        if (!card || !btn) {
            return;
        }

        if (isMultiColorCard(card)) {
            saveCurrentVariantQty(card);
        }

        var variantId = btn.getAttribute('data-variant-id') || '';
        var price = Number(btn.getAttribute('data-price') || card.getAttribute('data-price') || 0);
        var stock = Number(btn.getAttribute('data-stock') || 0);
        var image = btn.getAttribute('data-image') || '';
        var color = btn.getAttribute('data-color') || '';

        if (variantId) {
            card.setAttribute('data-variant-id', String(variantId));
        } else {
            card.removeAttribute('data-variant-id');
        }
        card.setAttribute('data-price', String(price));
        card.setAttribute('data-stock', String(stock));

        var swatches = card.querySelectorAll('.constructor-color-swatch');
        for (var i = 0; i < swatches.length; i += 1) {
            swatches[i].classList.remove('is-active');
        }
        btn.classList.add('is-active');

        var colorLabel = card.querySelector('.constructor-card__color-label');
        if (colorLabel) {
            colorLabel.textContent = color || 'Обери колір';
        }

        var priceEl = card.querySelector('.constructor-card__price strong');
        if (priceEl) {
            priceEl.textContent = price.toLocaleString('uk-UA') + ' грн / шт';
        }

        var stockEl = card.querySelector('.constructor-card__stock-value');
        if (stockEl) {
            stockEl.textContent = String(stock);
        }

        if (isMultiColorCard(card)) {
            loadVariantQty(card, variantId, stock);
        } else {
            var input = card.querySelector('[data-qty-input]');
            if (input) {
                input.setAttribute('max', String(stock));
                var val = Math.floor(Number(input.value || 0));
                if (val > stock) {
                    val = stock;
                }
                input.value = String(val);
            }
        }

        updateVariantSwatchBadges(card);

        var img = card.querySelector('.constructor-card__image');
        if (img && image) {
            if (img.tagName === 'IMG') {
                img.src = image;
                img.hidden = false;
            }
        } else if (img && img.tagName === 'IMG' && !image) {
            img.removeAttribute('src');
        }
    }

    function renderSummary(data) {
        var lines = data && data.lines ? data.lines : [];
        var hasLines = lines.length > 0;

        if (!data || (!data.ok && !hasLines)) {
            summaryList.innerHTML = '<li class="constructor-summary-empty">Поки нічого не обрано</li>';
            stemOut.textContent = '0';
            totalOut.textContent = '0 грн';
            hintEl.textContent = data && data.message ? data.message : 'Мінімум ' + cfg.minStems + ' квіток';
            addBtn.disabled = true;
            if (previewBtn) {
                previewBtn.disabled = true;
            }
            lastOk = false;
            updateClearBtn(0);
            updateMobileBar(null);
            return;
        }

        var html = '';
        for (var i = 0; i < lines.length; i += 1) {
            var line = lines[i];
            var label = escapeHtml(lineLabel(line));
            var variantAttr = '';
            if (line.color_variant_id != null && line.color_variant_id !== '') {
                variantAttr = ' data-variant-id="' + String(line.color_variant_id) + '"';
            }
            html +=
                '<li class="constructor-summary-item">' +
                '<span class="constructor-summary-item__text">' +
                label +
                ' ×' +
                Number(line.quantity || 0) +
                ' — ' +
                Number(line.line_total || 0).toLocaleString('uk-UA') +
                ' грн</span>' +
                '<button type="button" class="constructor-summary-remove" data-product-id="' +
                String(line.product_id) +
                '"' +
                variantAttr +
                ' aria-label="Прибрати з букета" title="Прибрати">×</button>' +
                '</li>';
        }
        if (Number(data.packagingPrice || 0) > 0) {
            html +=
                '<li class="constructor-summary-item constructor-summary-item--pack">' +
                '<span class="constructor-summary-item__text">Упаковка: ' +
                escapeHtml(data.packagingLabel) +
                ' — ' +
                Number(data.packagingPrice).toLocaleString('uk-UA') +
                ' грн</span></li>';
        }
        summaryList.innerHTML = html || '<li class="constructor-summary-empty">Поки нічого не обрано</li>';
        stemOut.textContent = String(data.stemTotal || 0);
        totalOut.textContent = Number(data.total || 0).toLocaleString('uk-UA') + ' грн';

        if (data.ok) {
            lastOk = true;
            hintEl.textContent = 'Готово — можна додати в кошик';
            addBtn.disabled = false;
            if (previewBtn) {
                previewBtn.disabled = false;
            }
            updateClearBtn(data.stemTotal);
            updateMobileBar(data);
            updateAllSwatchBadges();
            return;
        }

        lastOk = false;
        addBtn.disabled = true;
        if (previewBtn) {
            previewBtn.disabled = true;
        }

        var minHint = Number(data.minStems || cfg.minStems || 5);
        var stemNow = Number(data.stemTotal || 0);
        if (data.reason === 'min_stems' || (data.message && data.message.indexOf('мінімум') !== -1)) {
            hintEl.textContent = 'Додано ' + stemNow + ' з ' + minHint + ' квіток — додайте ще';
        } else {
            hintEl.textContent = data.message || ('Мінімум ' + minHint + ' квіток у букеті');
        }
        updateClearBtn(data.stemTotal);
        updateMobileBar(data);
        updateAllSwatchBadges();
    }

    function buildRequestBody() {
        var items = getItems();
        var body = new URLSearchParams();
        body.set('items', JSON.stringify(items));
        body.set('packaging', packSel ? packSel.value : '');
        return body;
    }

    function fetchCalc(body) {
        return fetch(cfg.calcUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: body.toString()
        }).then(function (res) {
            return readJsonResponse(res).then(function (data) {
                if (!res.ok) {
                    throw new Error(data.message || 'Помилка');
                }
                return data;
            });
        });
    }

    function runCalc() {
        var items = getItems();
        if (items.length === 0) {
            clearDraft();
            renderSummary(null);
            return;
        }

        saveDraft();

        fetchCalc(buildRequestBody())
            .then(function (data) {
                renderSummary(data);
            })
            .catch(function (err) {
                renderSummary({ ok: false, message: err.message || 'Помилка розрахунку' });
            });
    }

    function scheduleCalc() {
        invalidatePreview();
        clearTimeout(calcTimer);
        calcTimer = setTimeout(runCalc, 280);
    }

    function showPreviewImage(url, skipSave) {
        var cleanUrl = String(url || '').split('?')[0];
        if (previewImg && cleanUrl) {
            previewImg.src = cleanUrl + '?t=' + Date.now();
        }
        if (previewFrame) {
            previewFrame.hidden = false;
        }
        if (!skipSave && cleanUrl) {
            savedPreviewUrl = cleanUrl;
        }
    }

    function savePreviewOnServer(previewKey, imageSrc) {
        var body = new URLSearchParams();
        body.set('preview_key', previewKey);
        body.set('image', imageSrc);

        return fetch(cfg.previewSaveUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: body.toString()
        }).then(function (res) {
            return readJsonResponse(res).then(function (data) {
                if (!res.ok || !data.ok) {
                    throw new Error(data.message || 'Помилка збереження');
                }
                return data;
            });
        });
    }

    function setPreviewHint(summary, skipSave) {
        if (!previewStatus || !summary) {
            return;
        }
        previewStatus.textContent = 'Склад: ' + summary + '. Фото лише для наочності.';
        if (!skipSave && savedPreviewUrl) {
            savePreviewStorage(savedPreviewUrl, summary);
        }
    }

    function makePreview(prompt) {
        if (typeof puter === 'undefined' || !puter.ai || typeof puter.ai.txt2img !== 'function') {
            return Promise.reject(new Error('Генерація превʼю тимчасово недоступна'));
        }

        var opts = {
            model: cfg.puterModel || 'gpt-image-1-mini',
            quality: cfg.puterQuality || 'medium'
        };

        return puter.ai.txt2img(prompt, opts).catch(function (err) {
            var text = err && err.message ? String(err.message) : '';
            if (text.indexOf('does not exist') === -1 && text.indexOf('not exist') === -1) {
                throw err;
            }
            return puter.ai.txt2img(prompt, { model: 'gpt-image-1.5', quality: 'low' });
        });
    }

    function runPreview() {
        if (!previewBtn) {
            return;
        }

        clearTimeout(calcTimer);
        previewBtn.disabled = true;
        addBtn.disabled = true;
        if (previewStatus) {
            previewStatus.textContent = 'Рахуємо букет…';
        }

        var body = buildRequestBody();

        fetchCalc(body)
            .then(function (calcData) {
                if (!calcData.ok) {
                    throw new Error(calcData.message || 'Спочатку збери коректний букет');
                }
                renderSummary(calcData);

                if (previewStatus) {
                    previewStatus.textContent = 'Генеруємо фото…';
                }

                return fetch(cfg.previewUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                    },
                    body: body.toString()
                });
            })
            .then(function (res) {
                if (!res) {
                    return null;
                }
                return readJsonResponse(res).then(function (data) {
                    if (!res.ok) {
                        throw new Error(data.message || 'Помилка');
                    }
                    return data;
                });
            })
            .then(function (data) {
                if (!data) {
                    return null;
                }
                if (!data.ok || !data.prompt) {
                    throw new Error(data.message || 'Помилка');
                }

                if (data.cached && data.image_url) {
                    showPreviewImage(data.image_url);
                    setPreviewHint(data.summary);
                    return null;
                }

                return makePreview(data.prompt).then(function (imgEl) {
                    if (!imgEl || !imgEl.src) {
                        throw new Error('Не вдалося згенерувати превʼю');
                    }
                    return savePreviewOnServer(data.preview_key, imgEl.src).then(function (saved) {
                        showPreviewImage(saved.image_url || imgEl.src);
                        setPreviewHint(data.summary);
                    });
                });
            })
            .catch(function (err) {
                if (previewStatus) {
                    previewStatus.textContent = err.message || 'Не вдалося згенерувати превʼю';
                }
                msg(err.message || 'Не вдалося згенерувати превʼю', false);
            })
            .finally(function () {
                previewBtn.disabled = !lastOk;
                addBtn.disabled = !lastOk;
            });
    }

    summaryList.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('.constructor-summary-remove');
        if (!removeBtn) {
            return;
        }
        var productId = Number(removeBtn.getAttribute('data-product-id'));
        var variantRaw = removeBtn.getAttribute('data-variant-id');
        if (!Number.isFinite(productId) || productId <= 0) {
            return;
        }
        removeLineFromBouquet(productId, variantRaw);
    });

    grid.addEventListener('click', function (e) {
        var swatch = e.target.closest('.constructor-color-swatch');
        if (swatch && !swatch.disabled) {
            var colorCard = swatch.closest('.constructor-card');
            applyVariant(colorCard, swatch);
            scheduleCalc();
            return;
        }

        var minus = e.target.closest('[data-qty-minus]');
        var plus = e.target.closest('[data-qty-plus]');
        if (!minus && !plus) {
            return;
        }
        var qtyWrap = e.target.closest('.constructor-qty');
        if (!qtyWrap) {
            return;
        }
        var card = e.target.closest('.constructor-card');
        var input = qtyWrap.querySelector('[data-qty-input]');
        if (!input) {
            return;
        }
        var max = Number(input.getAttribute('max') || 999);
        var val = Math.floor(Number(input.value || 0));
        if (minus) {
            val -= 1;
        } else {
            val += 1;
        }
        if (val < 0) {
            val = 0;
        }
        if (val > max) {
            val = max;
        }
        input.value = String(val);
        if (card && isMultiColorCard(card)) {
            saveCurrentVariantQty(card);
            updateVariantSwatchBadges(card);
        }
        scheduleCalc();
    });

    grid.addEventListener('input', function (e) {
        if (!e.target.matches('[data-qty-input]')) {
            return;
        }
        var input = e.target;
        var max = Number(input.getAttribute('max') || 999);
        var val = Math.floor(Number(input.value || 0));
        if (!Number.isFinite(val) || val < 0) {
            val = 0;
        }
        if (val > max) {
            val = max;
        }
        input.value = String(val);
        var card = input.closest('.constructor-card');
        if (card && isMultiColorCard(card)) {
            saveCurrentVariantQty(card);
            updateVariantSwatchBadges(card);
        }
        scheduleCalc();
    });

    if (packSel) {
        packSel.addEventListener('change', function () {
            saveDraft();
            scheduleCalc();
        });
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', runPreview);
    }

    if (previewCloseBtn) {
        previewCloseBtn.addEventListener('click', closePreview);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearBouquet);
    }

    addBtn.addEventListener('click', function () {
        if (!lastOk) {
            return;
        }
        var items = getItems();
        var body = new URLSearchParams();
        body.set('items', JSON.stringify(items));
        body.set('packaging', packSel ? packSel.value : '');
        if (savedPreviewUrl) {
            body.set('preview_url', savedPreviewUrl);
        }

        addBtn.disabled = true;
        if (mobileAddBtn) {
            mobileAddBtn.disabled = true;
        }

        fetch(cfg.addUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: body.toString()
        })
            .then(function (res) {
                return readJsonResponse(res).then(function (data) {
                    if (!res.ok || !data.ok) {
                        throw new Error(data.message || 'Помилка');
                    }
                    return data;
                });
            })
            .then(function (data) {
                clearDraft();
                closePreview();
                msg(data.message || 'Додано в кошик', true);
                if (typeof window.updateNavCartCount === 'function' && data.count != null) {
                    window.updateNavCartCount(data.count);
                }
                window.location.href = data.redirect || '/cart';
            })
            .catch(function (err) {
                msg(err.message || 'Не вдалося додати', false);
                addBtn.disabled = !lastOk;
                if (mobileAddBtn) {
                    mobileAddBtn.disabled = !lastOk;
                }
            });
    });

    if (mobileAddBtn) {
        mobileAddBtn.addEventListener('click', function () {
            addBtn.click();
        });
    }

    var templateSlug = cfg.templateSlug ? String(cfg.templateSlug).trim() : '';

    if (templateSlug) {
        loadTemplateFromSlug(templateSlug).then(function (loaded) {
            if (!loaded) {
                updateClearBtn();
            }
            loadPreviewStorage();
        });
    } else if (loadDraft()) {
        runCalc();
        if (typeof window.restoreFormProgress === 'function') {
            window.restoreFormProgress({
                restored: true,
                targetEl: document.querySelector('.constructor-aside'),
                message: 'Букет відновлено — продовжуй збір'
            });
        }
        loadPreviewStorage();
    } else {
        updateClearBtn();
        loadPreviewStorage();
    }
})();
