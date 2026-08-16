function setWishlistStarState(form, active) {
    const btn = form.querySelector('.wishlist-star-btn');
    if (!btn) {
        return;
    }
    btn.textContent = active ? '★' : '☆';
    btn.classList.toggle('wishlist-star-btn--active', active);
    const title = active ? 'Прибрати з обраного' : 'Додати в обране';
    btn.setAttribute('title', title);
    btn.setAttribute('aria-label', title);
    form.setAttribute('action', active ? '/wishlist/remove' : '/wishlist/add');
}

function localWishlistHas(productId) {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0 || !Array.isArray(window.__wishlistProductIds)) {
        return false;
    }
    const ids = window.__wishlistProductIds;
    for (let i = 0; i < ids.length; i += 1) {
        if (Number(ids[i]) === id) {
            return true;
        }
    }
    return false;
}

async function flushWishlistForm(form) {
    if (!(form instanceof HTMLFormElement) || form.dataset.wlBusy === '1') {
        return;
    }

    form.dataset.wlBusy = '1';
    const input = form.querySelector('[name=product_id]');
    const productId = input ? input.value : '';
    const btn = form.querySelector('.wishlist-star-btn');

    try {
        let guard = 0;
        while (guard < 6) {
            guard += 1;
            const wanted = btn ? form.dataset.wlWanted === '1' : false;
            const targetAction = wanted ? '/wishlist/add' : '/wishlist/remove';
            const body = new URLSearchParams(new FormData(form));
            const res = await fetch(targetAction, {
                method: 'POST',
                body,
                credentials: 'include',
                headers: {
                    Accept: 'application/json'
                }
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const msg = data && data.message ? data.message : 'Не вдалося оновити обране';
                if (typeof window.showToast === 'function') {
                    window.showToast(msg, 'error');
                }
                if (btn) {
                    setWishlistStarState(form, localWishlistHas(productId));
                }
                break;
            }

            if (typeof data.in_wishlist === 'boolean') {
                syncWishlistProductId(productId, data.in_wishlist);
            } else if (Array.isArray(data.ids)) {
                window.__wishlistProductIds = data.ids
                    .map((id) => Number(id))
                    .filter((id) => Number.isFinite(id) && id > 0);
            }

            if (typeof window.updateNavWishlistCount === 'function' && data.count != null) {
                window.updateNavWishlistCount(data.count);
            }

            if (!btn) {
                const card = form.closest('.product-card');
                if (card && card.parentElement) {
                    card.remove();
                }
                const grid = document.querySelector('.products-grid');
                if (grid && grid.children.length === 0) {
                    window.location.reload();
                }
                break;
            }

            const stillWanted = form.dataset.wlWanted === '1';
            if (stillWanted === localWishlistHas(productId)) {
                setWishlistStarState(form, stillWanted);
                break;
            }
        }
    } catch (err) {
        if (typeof window.showToast === 'function') {
            window.showToast('Помилка мережі', 'error');
        }
        if (btn) {
            setWishlistStarState(form, localWishlistHas(productId));
        }
    } finally {
        form.dataset.wlBusy = '';
    }
}

document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('wishlist-ajax')) {
        return;
    }

    e.preventDefault();
    const btn = form.querySelector('.wishlist-star-btn');
    const input = form.querySelector('[name=product_id]');
    const productId = input ? input.value : '';

    if (!btn) {
        if (form.dataset.wlBusy === '1') {
            return;
        }
        flushWishlistForm(form);
        return;
    }

    const wantActive = !btn.classList.contains('wishlist-star-btn--active');
    form.dataset.wlWanted = wantActive ? '1' : '0';
    setWishlistStarState(form, wantActive);
    syncWishlistProductId(productId, wantActive);
    if (typeof window.updateNavWishlistCount === 'function') {
        const n = Array.isArray(window.__wishlistProductIds) ? window.__wishlistProductIds.length : 0;
        window.updateNavWishlistCount(n);
    }

    if (form._wlTimer) {
        window.clearTimeout(form._wlTimer);
    }
    form._wlTimer = window.setTimeout(() => {
        form._wlTimer = null;
        flushWishlistForm(form);
    }, 250);
});

function syncWishlistProductId(productId, add) {
    if (!Array.isArray(window.__wishlistProductIds)) {
        window.__wishlistProductIds = [];
    }
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return;
    }
    const idx = window.__wishlistProductIds.indexOf(id);
    if (add && idx === -1) {
        window.__wishlistProductIds.push(id);
    } else if (!add && idx !== -1) {
        window.__wishlistProductIds.splice(idx, 1);
    }
}

function applyWishlistStars(ids) {
    const idSet = new Set(
        (ids || [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
    );

    document.querySelectorAll('.wishlist-form.wishlist-ajax').forEach((form) => {
        const btn = form.querySelector('.wishlist-star-btn');
        const input = form.querySelector('[name=product_id]');
        if (!btn || !input) {
            return;
        }

        const pid = Number(input.value);
        const active = idSet.has(pid);
        btn.textContent = active ? '★' : '☆';
        btn.classList.toggle('wishlist-star-btn--active', active);
        const title = active ? 'Прибрати з обраного' : 'Додати в обране';
        btn.setAttribute('title', title);
        btn.setAttribute('aria-label', title);
        form.setAttribute('action', active ? '/wishlist/remove' : '/wishlist/add');
    });
}

async function refreshWishlistStarsOnPage() {
    if (!document.querySelector('.wishlist-form.wishlist-ajax')) {
        return;
    }

    let ids = Array.isArray(window.__wishlistProductIds) ? window.__wishlistProductIds : [];

    try {
        const res = await fetch('/api/wishlist/ids', {
            credentials: 'include',
            headers: { Accept: 'application/json' }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.ids)) {
            ids = data.ids
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id) && id > 0);
            window.__wishlistProductIds = ids;
        }
    } catch (err) {
    }

    applyWishlistStars(ids);
}

document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('cart-ajax')) {
        return;
    }

    e.preventDefault();
    queueCatalogCartAdd(form);
});

function readNavCartCount() {
    const el = document.getElementById('navCartBadge');
    if (!el || el.hidden) {
        return 0;
    }
    const raw = String(el.textContent || '').trim();
    if (raw === '99+') {
        return 99;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function setNavCartCount(count) {
    if (typeof window.updateNavCartCount === 'function') {
        window.updateNavCartCount(Math.max(0, Number(count) || 0));
    }
}

const catalogCartPending = new Set();
let catalogCartTimer = null;
let catalogCartBusy = false;
let alreadyInCartToastAt = 0;

function cartProductIds() {
    if (!Array.isArray(window.__cartProductIds)) {
        window.__cartProductIds = [];
    }
    return window.__cartProductIds;
}

function cartHasProduct(productId) {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return false;
    }
    const ids = cartProductIds();
    for (let i = 0; i < ids.length; i += 1) {
        if (Number(ids[i]) === id) {
            return true;
        }
    }
    return false;
}

function syncCartProductId(productId, add) {
    const id = Number(productId);
    if (!Number.isFinite(id) || id <= 0) {
        return;
    }
    const ids = cartProductIds();
    let idx = -1;
    for (let i = 0; i < ids.length; i += 1) {
        if (Number(ids[i]) === id) {
            idx = i;
            break;
        }
    }
    if (add && idx === -1) {
        ids.push(id);
    } else if (!add && idx !== -1) {
        ids.splice(idx, 1);
    }
}

function applyCartButtons() {
    document.querySelectorAll('.cart-form.cart-ajax').forEach((form) => {
        const input = form.querySelector('[name="product_id"]');
        const btn = form.querySelector('.cart-icon-btn');
        if (!input || !btn) {
            return;
        }
        const inCart = cartHasProduct(input.value);
        btn.classList.toggle('cart-icon-btn--in-cart', inCart);
        const title = inCart ? 'Уже в кошику' : 'Додати в кошик';
        btn.setAttribute('title', title);
        btn.setAttribute('aria-label', title);
    });
}

function toastAlreadyInCart() {
    const now = Date.now();
    if (now - alreadyInCartToastAt < 1600) {
        return;
    }
    alreadyInCartToastAt = now;
    if (typeof window.showToast === 'function') {
        window.showToast('Товар уже в кошику. Кількість можна змінити в кошику', 'info');
    }
}

function queueCatalogCartAdd(form) {
    const pidInput = form.querySelector('[name="product_id"]');
    const pid = Number(pidInput && pidInput.value);
    if (!Number.isFinite(pid) || pid <= 0) {
        return;
    }

    if (cartHasProduct(pid) || catalogCartPending.has(pid)) {
        applyCartButtons();
        toastAlreadyInCart();
        return;
    }

    catalogCartPending.add(pid);
    syncCartProductId(pid, true);
    applyCartButtons();
    setNavCartCount(readNavCartCount() + 1);

    const cartBtn = form.querySelector('.cart-icon-btn');
    if (cartBtn) {
        cartBtn.classList.add('cart-icon-btn--added');
        window.setTimeout(function () {
            cartBtn.classList.remove('cart-icon-btn--added');
        }, 650);
    }

    if (catalogCartTimer) {
        window.clearTimeout(catalogCartTimer);
    }
    catalogCartTimer = window.setTimeout(flushCatalogCartAdds, 250);
}

async function flushCatalogCartAdds() {
    catalogCartTimer = null;
    if (catalogCartBusy) {
        return;
    }
    catalogCartBusy = true;
    try {
        while (catalogCartPending.size > 0) {
            const pid = catalogCartPending.values().next().value;
            catalogCartPending.delete(pid);

            const body = new URLSearchParams();
            body.set('product_id', String(pid));
            body.set('quantity', '1');
            try {
                const res = await fetch('/cart/add', {
                    method: 'POST',
                    body,
                    credentials: 'include',
                    headers: { Accept: 'application/json' }
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.ok) {
                    syncCartProductId(pid, false);
                    applyCartButtons();
                    setNavCartCount(readNavCartCount() - 1);
                    const msg = data && data.message ? data.message : 'Не вдалося оновити кошик';
                    if (typeof window.showToast === 'function') {
                        window.showToast(msg, 'error');
                    }
                    continue;
                }
                if (Array.isArray(data.product_ids)) {
                    window.__cartProductIds = data.product_ids
                        .map((id) => Number(id))
                        .filter((id) => Number.isFinite(id) && id > 0);
                    applyCartButtons();
                }
                if (data.count != null) {
                    setNavCartCount(data.count);
                }
                if (data.already) {
                    toastAlreadyInCart();
                }
            } catch (err) {
                syncCartProductId(pid, false);
                applyCartButtons();
                setNavCartCount(readNavCartCount() - 1);
                if (typeof window.showToast === 'function') {
                    window.showToast('Помилка мережі', 'error');
                }
            }
        }
    } finally {
        catalogCartBusy = false;
        if (catalogCartPending.size > 0) {
            flushCatalogCartAdds();
        }
    }
}

function cartPagePost(action, body) {
    return fetch(action, {
        method: 'POST',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: new URLSearchParams(body)
    }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            throw new Error(data.message || 'Помилка');
        }
        return data;
    });
}

function refreshCartGrandTotal() {
    const table = document.getElementById('cartTable');
    const totalOut = document.getElementById('cartGrandTotal');
    if (!table || !totalOut) {
        return;
    }
    let sum = 0;
    table.querySelectorAll('tbody tr[data-product-id]').forEach((row) => {
        if (row.hidden || row.dataset.removed === '1') {
            return;
        }
        const unit = Number(row.dataset.unitPrice || 0);
        const input = row.querySelector('.cart-qty-input');
        const qty = Number(input && input.value ? input.value : 0);
        if (Number.isFinite(unit) && Number.isFinite(qty) && qty > 0) {
            sum += unit * qty;
            const lineOut = row.querySelector('.cart-line-total');
            if (lineOut) {
                lineOut.textContent = (unit * qty).toLocaleString('uk-UA') + ' грн';
            }
        }
    });
    totalOut.textContent = sum.toLocaleString('uk-UA') + ' грн';
}

let cartPageBusy = false;
const cartPageQueue = [];

function enqueueCartPageTask(task) {
    cartPageQueue.push(task);
    runCartPageQueue();
}

async function runCartPageQueue() {
    if (cartPageBusy) {
        return;
    }
    cartPageBusy = true;
    try {
        while (cartPageQueue.length > 0) {
            const task = cartPageQueue.shift();
            await task();
        }
    } finally {
        cartPageBusy = false;
        if (cartPageQueue.length > 0) {
            runCartPageQueue();
        }
    }
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.cart-remove-btn');
    if (!btn) {
        return;
    }
    const row = btn.closest('tr[data-product-id]');
    const table = document.getElementById('cartTable');
    if (!row || !table || row.dataset.removed === '1') {
        return;
    }

    const qtyInput = row.querySelector('.cart-qty-input');
    const qty = Math.max(1, Math.floor(Number(qtyInput && qtyInput.value) || 1));
    row.dataset.removed = '1';
    row.hidden = true;
    btn.disabled = true;
    refreshCartGrandTotal();
    setNavCartCount(readNavCartCount() - qty);

    const pid = Number(row.dataset.productId);
    const variantRaw = row.dataset.colorVariantId || '';
    const body = { product_id: pid };
    if (variantRaw) {
        body.color_variant_id = variantRaw;
    }

    enqueueCartPageTask(async () => {
        try {
            const data = await cartPagePost('/cart/remove', body);
            row.remove();
            const leftover = table.querySelector('tbody tr[data-product-id="' + pid + '"]');
            if (!leftover) {
                syncCartProductId(pid, false);
            }
            if (data.count != null) {
                setNavCartCount(data.count);
            }
            if (!table.querySelector('tbody tr[data-product-id]')) {
                window.location.reload();
            }
        } catch (err) {
            row.dataset.removed = '';
            row.hidden = false;
            btn.disabled = false;
            setNavCartCount(readNavCartCount() + qty);
            refreshCartGrandTotal();
            if (typeof window.showToast === 'function') {
                window.showToast(err.message || 'Не вдалося видалити товар', 'error');
            }
        }
    });
});

document.addEventListener('change', (e) => {
    const input = e.target.closest('#cartTable .cart-qty-input');
    if (!input) {
        return;
    }
    const row = input.closest('tr[data-product-id]');
    if (!row || row.dataset.removed === '1') {
        return;
    }

    let qty = Math.floor(Number(input.value || 1));
    if (!Number.isFinite(qty) || qty < 1) {
        qty = 1;
    }
    input.value = String(qty);
    refreshCartGrandTotal();

    if (row._qtyTimer) {
        window.clearTimeout(row._qtyTimer);
    }
    row._qtyTimer = window.setTimeout(() => {
        row._qtyTimer = null;
        const latest = Math.max(1, Math.floor(Number(input.value || 1)));
        const pid = Number(row.dataset.productId);
        const variantRaw = row.dataset.colorVariantId || '';
        const updateBody = { product_id: pid, quantity: latest };
        if (variantRaw) {
            updateBody.color_variant_id = variantRaw;
        }
        enqueueCartPageTask(async () => {
            if (row.dataset.removed === '1') {
                return;
            }
            try {
                const data = await cartPagePost('/cart/update', updateBody);
                if (data.count != null) {
                    setNavCartCount(data.count);
                }
            } catch (err) {
                if (typeof window.showToast === 'function') {
                    window.showToast(err.message || 'Не вдалося оновити кількість', 'error');
                }
            }
        });
    }, 280);
});

document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) {
        return;
    }
    const action = form.getAttribute('action') || '';
    if (action !== '/cart/clear' && !action.endsWith('/cart/clear')) {
        return;
    }
    if (form.dataset.busy === '1') {
        e.preventDefault();
        return;
    }
    form.dataset.busy = '1';
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
    }
});

document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('catalog-search')) {
        return;
    }

    const input = form.querySelector('#catalog-q') || form.querySelector('input[name="q"]');
    if (!input) {
        return;
    }

    const value = String(input.value || '').trim();
    if (!value) {
        e.preventDefault();
        input.value = '';
        input.setCustomValidity('Заповни поле');
        input.reportValidity();
        return;
    }

    input.setCustomValidity('');
});

document.addEventListener('input', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) {
        return;
    }
    if (input.id !== 'catalog-q' && input.name !== 'q') {
        return;
    }
    if (!input.closest('.catalog-search')) {
        return;
    }
    input.setCustomValidity('');
});

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildProductCardHtml(product, showHitBadge) {
    const basePrice = Number(product.base_price || 0);
    const salePrice = Number(product.sale_price || 0);
    const hasDiscount = basePrice > 0 && salePrice > 0 && salePrice < basePrice;
    const discountPercent = hasDiscount
        ? Math.round(((basePrice - salePrice) / basePrice) * 100)
        : 0;
    const nameEsc = escapeHtml(product.name);
    const unitEsc = escapeHtml(product.unit_type || 'шт');
    const imgInner = product.image_url
        ? `<img src="${escapeHtml(product.image_url)}" alt="${nameEsc}" class="product-image" />`
        : '<div class="product-image product-image--placeholder">Немає фото</div>';
    const imgBlock =
        `<a href="/product/${product.id}" class="product-card-image-link" tabindex="-1">${imgInner}</a>` +
        (product.image_url
            ? `<button type="button" class="product-preview-btn" data-preview-src="${escapeHtml(product.image_url)}" data-preview-alt="${nameEsc}" title="Переглянути фото" aria-label="Переглянути фото ${nameEsc}">
                <svg class="product-preview-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
                </svg>
            </button>`
            : '');
    const discountBadge =
        discountPercent > 0
            ? `<span class="discount-badge">${discountPercent}%</span>`
            : '';
    const hitBadge = showHitBadge ? '<span class="hit-badge">Хіт продажів</span>' : '';
    const oldPriceBlock = hasDiscount
        ? `<span class="old-price">${basePrice.toLocaleString('uk-UA')} грн</span>`
        : '';
    const stockQty = Number(product.stock_quantity);
    const stockText =
        stockQty > 0
            ? `В наявності: ${stockQty} ${unitEsc}`
            : 'Немає в наявності';
    const cardRating = Number(product.average_rating);
    let ratingBlock = '';
    if (Number.isFinite(cardRating) && cardRating > 0) {
        let stars = '';
        for (let star = 1; star <= 5; star += 1) {
            const on = star <= Math.round(cardRating) ? 'star-icon--on' : 'star-icon--off';
            stars += `<span class="star-icon ${on}">★</span>`;
        }
        ratingBlock = `<p class="product-card-rating">
                <span class="star-rating star-rating--sm" title="Середня оцінка ${cardRating.toFixed(1)} з 5">${stars}</span>
                <strong>${cardRating.toFixed(1)}</strong>
            </p>`;
    }

    const orderBtn =
        stockQty > 0
            ? `<a class="product-order-btn" href="/checkout?product_id=${product.id}">Замовити</a>`
            : `<button class="product-order-btn" type="button" disabled>Замовити</button>`;
    const wlIds = Array.isArray(window.__wishlistProductIds) ? window.__wishlistProductIds : [];
    const cardProductId = Number(product.id);
    const inCart = cartHasProduct(cardProductId);
    const cartTitle = inCart ? 'Уже в кошику' : 'Додати в кошик';
    const cartBtn =
        stockQty > 0
            ? `<form method="post" action="/cart/add" class="cart-form cart-ajax">
                        <input type="hidden" name="product_id" value="${product.id}" />
                        <input type="hidden" name="quantity" value="1" />
                        <button class="cart-icon-btn${inCart ? ' cart-icon-btn--in-cart' : ''}" type="submit" title="${cartTitle}" aria-label="${cartTitle}">🛒</button>
                   </form>`
            : `<button class="cart-icon-btn" type="button" disabled title="Немає в наявності" aria-label="Немає в наявності">🛒</button>`;
    const inWishlist = wlIds.some((id) => Number(id) === cardProductId);
    const wishlistAction = inWishlist ? '/wishlist/remove' : '/wishlist/add';
    const wishlistStarClass = inWishlist ? ' wishlist-star-btn--active' : '';
    const wishlistStarChar = inWishlist ? '★' : '☆';
    const wishlistTitle = inWishlist ? 'Прибрати з обраного' : 'Додати в обране';

    return `<article class="product-card">
                        <div class="product-image-wrap">
                            ${discountBadge}
                            ${hitBadge}
                            ${imgBlock}
                        </div>
                        <a href="/product/${product.id}" class="product-card-link">
                        <h4 class="product-title">${nameEsc}</h4>

                        ${ratingBlock}

                        <p class="product-price">
                            ${oldPriceBlock}
                            <strong>${salePrice.toLocaleString('uk-UA')} грн</strong>
                        </p>

                        <p class="product-stock">
                            ${stockText}
                        </p>
                        </a>

                        <div class="product-card-actions">
                            <form method="post" action="${wishlistAction}" class="wishlist-form wishlist-ajax">
                                <input type="hidden" name="product_id" value="${product.id}" />
                                <button class="wishlist-star-btn${wishlistStarClass}" type="submit" title="${wishlistTitle}" aria-label="${wishlistTitle}">${wishlistStarChar}</button>
                            </form>
                            ${cartBtn}
                            ${orderBtn}
                        </div>
                    </article>`;
}

function buildCatalogHitHtml(hitProducts) {
    const hits = hitProducts || [];
    if (hits.length === 0) {
        return '';
    }
    const hitCards = hits.map((product) => buildProductCardHtml(product, true));
    return `<section class="catalog-hit-section">
            <h2 class="catalog-section-title">Хіт продажів</h2>
            <div class="products-grid">${hitCards.join('')}</div>
        </section>`;
}

function buildCatalogSectionHtml(section) {
    if (!section || !Array.isArray(section.products) || section.products.length === 0) {
        return '';
    }
    const title = escapeHtml(section.title || '');
    const cards = section.products.map((product) => buildProductCardHtml(product, false));
    let link = '';
    if (section.categoryId) {
        link = `<a href="/?category_id=${section.categoryId}" class="catalog-section-link catalog-category-nav" data-category-id="${section.categoryId}">Переглянути всі</a>`;
    }
    return `<section class="catalog-section-panel">
            <div class="catalog-section-head">
                <h2 class="catalog-section-title">${title}</h2>
                ${link}
            </div>
            <div class="products-grid products-grid--wide">${cards.join('')}</div>
        </section>`;
}

function buildCatalogSectionsHtml(homeSections) {
    const sections = homeSections || [];
    if (sections.length === 0) {
        return '';
    }
    return sections.map((section) => buildCatalogSectionHtml(section)).join('');
}

function hasFeaturedCatalogBlocks(hitProducts, homeSections) {
    const hits = hitProducts || [];
    const sections = homeSections || [];
    return hits.length > 0 || sections.length > 0;
}

function buildCatalogAllHtml(products, hitProducts, homeSections) {
    const list = products || [];
    const featured = hasFeaturedCatalogBlocks(hitProducts, homeSections);

    if (!featured && list.length === 0) {
        return '<p class="catalog-empty">Товари не знайдено.</p>';
    }
    if (list.length === 0) {
        return '';
    }

    const cards = list.map((product) => buildProductCardHtml(product, false));
    const title = featured ? '<h2 class="catalog-section-title">Усі товари</h2>' : '';
    return `${title}<div class="products-grid products-grid--wide">${cards.join('')}</div>`;
}

function isCatalogHomeMode(categoryId, q) {
    const hasCat =
        categoryId !== null &&
        categoryId !== undefined &&
        Number.isFinite(Number(categoryId)) &&
        Number(categoryId) > 0;
    const hasQ = typeof q === 'string' && q.trim().length > 0;
    return !hasCat && !hasQ;
}

function buildCatalogCategoryHtml(products) {
    const list = products || [];
    if (list.length === 0) {
        return '<p class="catalog-empty">Товари не знайдено.</p>';
    }
    const cards = list.map((product) => buildProductCardHtml(product, false));
    return `<div class="products-grid">${cards.join('')}</div>`;
}

function updateCatalogHeroFromNav(categoryId, q) {
    const titleEl = document.querySelector('.catalog-hero__title');
    const leadEl = document.querySelector('.catalog-hero__lead');
    if (!titleEl || !leadEl) {
        return;
    }

    const searchText = typeof q === 'string' ? q.trim() : '';

    if (isCatalogHomeMode(categoryId, searchText)) {
        titleEl.textContent = 'Обери свіжий букет';
        leadEl.textContent = 'Свіжі квіти та букети - доставимо у зручний для тебе час';
        return;
    }

    if (searchText) {
        titleEl.textContent = 'Результати пошуку';
        leadEl.textContent = 'Знайдені товари за вашим запитом';
        return;
    }

    let activeLink = null;
    if (categoryId !== null && categoryId !== undefined) {
        activeLink = document.querySelector(
            '.catalog-sidebar .catalog-category-nav[data-category-id="' + String(categoryId) + '"]'
        );
    }
    if (!activeLink) {
        activeLink = document.querySelector('.catalog-sidebar .catalog-category-nav.active');
    }
    if (!activeLink) {
        return;
    }

    const labelNode = activeLink.querySelector('.category-parent-label');
    let label = labelNode ? labelNode.textContent.trim() : activeLink.textContent.trim();
    label = label.replace('›', '').trim();
    titleEl.textContent = label || 'Каталог';
    leadEl.textContent = 'Замов онлайн - зберемо букет перед відправкою';
}

function applyCatalogProductsHtml(products, hitProducts, homeSections, categoryId, q) {
    const layout = document.querySelector('.catalog-layout');
    const hitRoot = document.getElementById('catalog-hit-root');
    const sectionsRoot = document.getElementById('catalog-sections-root');
    const allRoot = document.getElementById('catalog-all-root');
    const categoryRoot = document.getElementById('catalog-category-root');
    if (!hitRoot && !sectionsRoot && !allRoot && !categoryRoot) {
        return false;
    }

    const searchText = typeof q === 'string' ? q.trim() : '';
    const isHome = isCatalogHomeMode(categoryId, searchText);

    if (layout) {
        layout.classList.toggle('catalog-layout--home', isHome);
        layout.classList.toggle('catalog-layout--filtered', !isHome);
    }

    if (isHome) {
        const sections = homeSections || [];
        const featured = hasFeaturedCatalogBlocks(hitProducts, sections);

        if (hitRoot) {
            hitRoot.innerHTML = buildCatalogHitHtml(hitProducts);
        }
        if (sectionsRoot) {
            sectionsRoot.innerHTML = buildCatalogSectionsHtml(sections);
            sectionsRoot.classList.toggle('catalog-sections-stack--empty', sections.length === 0);
        }
        if (allRoot) {
            allRoot.innerHTML = buildCatalogAllHtml(products, hitProducts, sections);
            const list = products || [];
            const showPanel = list.length > 0 || (!featured && list.length === 0);
            allRoot.classList.toggle('catalog-all-panel--empty', !showPanel);
        }
        if (categoryRoot) {
            categoryRoot.innerHTML = '';
        }
        updateCatalogHeroFromNav(null, '');
    } else {
        if (hitRoot) {
            hitRoot.innerHTML = '';
        }
        if (sectionsRoot) {
            sectionsRoot.innerHTML = '';
            sectionsRoot.classList.add('catalog-sections-stack--empty');
        }
        if (allRoot) {
            allRoot.innerHTML = '';
            allRoot.classList.add('catalog-all-panel--empty');
        }
        if (categoryRoot) {
            categoryRoot.innerHTML = buildCatalogCategoryHtml(products);
        }
        updateCatalogHeroFromNav(categoryId, searchText);
    }

    return true;
}

function buildCatalogProductsHtml(products, hitProducts, homeSections) {
    return buildCatalogHitHtml(hitProducts)
        + buildCatalogSectionsHtml(homeSections)
        + buildCatalogAllHtml(products, hitProducts, homeSections);
}

function syncSearchFormCategory(categoryId) {
    const form = document.querySelector('.catalog-layout .catalog-search');
    if (!form) {
        return;
    }
    let hidden = form.querySelector('input[name="category_id"]');
    if (categoryId) {
        if (!hidden) {
            hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = 'category_id';
            form.insertBefore(hidden, form.firstChild);
        }
        hidden.value = String(categoryId);
    } else if (hidden) {
        hidden.remove();
    }
}

function closePhoneCategoriesPanel() {
    const panel = document.getElementById('catalog-categories-phone-panel');
    const btn = document.getElementById('catalog-categories-phone-btn');
    if (!panel) {
        return;
    }
    panel.hidden = true;
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('catalog-categories-phone-open');
}

function initPhoneCategoriesPanel() {
    const btn = document.getElementById('catalog-categories-phone-btn');
    const panel = document.getElementById('catalog-categories-phone-panel');
    if (!btn || !panel) {
        return;
    }
    if (btn.dataset.bound === '1') {
        return;
    }
    btn.dataset.bound = '1';

    btn.addEventListener('click', function () {
        const open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            document.body.classList.add('catalog-categories-phone-open');
        } else {
            document.body.classList.remove('catalog-categories-phone-open');
        }
    });

    panel.querySelectorAll('[data-phone-categories-close]').forEach(function (el) {
        el.addEventListener('click', closePhoneCategoriesPanel);
    });
}

function updateCategoryNavActive(categoryId) {
    const navLinks = document.querySelectorAll(
        '.catalog-sidebar .catalog-category-nav, .catalog-categories-phone .catalog-category-nav'
    );
    navLinks.forEach((a) => {
        const raw = a.getAttribute('data-category-id');
        const isAll = raw === null || raw === '';
        const idNum = isAll ? null : Number(raw);
        const match =
            categoryId === null || categoryId === undefined
                ? isAll
                : !isAll && Number(categoryId) === idNum;
        a.classList.toggle('active', match);
    });

    const labelEl = document.getElementById('catalog-categories-phone-current');
    const activeLink = document.querySelector('.catalog-categories-phone .catalog-category-nav.active');
    if (labelEl && activeLink) {
        labelEl.textContent = activeLink.textContent.trim();
    }
}

function buildCatalogUrl(categoryId, q) {
    const params = new URLSearchParams();
    if (categoryId) {
        params.set('category_id', String(categoryId));
    }
    if (q) {
        params.set('q', q);
    }
    const s = params.toString();
    return s ? `/?${s}` : '/';
}

let catalogAbort = null;
let catalogReqId = 0;

async function loadCatalogProducts(categoryId, q) {
    const hitRoot = document.getElementById('catalog-hit-root');
    const sectionsRoot = document.getElementById('catalog-sections-root');
    const allRoot = document.getElementById('catalog-all-root');
    if (!hitRoot && !sectionsRoot && !allRoot) {
        return false;
    }

    const params = new URLSearchParams();
    if (categoryId) {
        params.set('category_id', String(categoryId));
    }
    if (q) {
        params.set('q', q);
    }
    const qs = params.toString();
    const url = '/api/catalog/products' + (qs ? `?${qs}` : '');

    catalogReqId += 1;
    const reqId = catalogReqId;
    if (catalogAbort) {
        catalogAbort.abort();
    }
    catalogAbort = new AbortController();

    try {
        const res = await fetch(url, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: catalogAbort.signal
        });
        if (reqId !== catalogReqId) {
            return false;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg =
                data && data.message ? data.message : 'Не вдалося оновити товари';
            if (typeof window.showToast === 'function') {
                window.showToast(msg, 'error');
            }
            return false;
        }
        const products = data.products || [];
        const hitProducts = data.hitProducts || [];
        const homeSections = data.homeSections || [];
        applyCatalogProductsHtml(products, hitProducts, homeSections, categoryId, q);
        syncSearchFormCategory(categoryId);
        updateCategoryNavActive(categoryId);
        applyWishlistStars(window.__wishlistProductIds);
        applyCartButtons();
        return true;
    } catch (err) {
        if (err && err.name === 'AbortError') {
            return false;
        }
        if (typeof window.showToast === 'function') {
            window.showToast('Помилка мережі', 'error');
        }
        return false;
    }
}

document.addEventListener('click', (e) => {
    const a = e.target.closest('a.catalog-category-nav');
    if (!a) {
        return;
    }
    if (!a.closest('.catalog-sidebar') && !a.closest('.catalog-categories-phone')) {
        return;
    }
    if (!document.querySelector('.catalog-layout') || !document.getElementById('catalog-category-root')) {
        return;
    }
    if (e.defaultPrevented) {
        return;
    }
    if (e.button !== 0) {
        return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
    }

    e.preventDefault();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    const raw = a.getAttribute('data-category-id');
    const categoryId = raw === null || raw === '' ? null : Number(raw);
    const qInput = document.getElementById('catalog-q');
    const q = qInput && qInput.value ? String(qInput.value).trim() : '';
    const nextUrl = buildCatalogUrl(categoryId, q);

    loadCatalogProducts(categoryId, q).then((ok) => {
        if (ok) {
            window.history.pushState({ catalogNav: true, categoryId, q }, '', nextUrl);
            if (a.closest('.catalog-categories-phone')) {
                closePhoneCategoriesPanel();
            }
        }
    });
});

function isNavPathActive(href, path) {
    if (!href || href === '#' || href === '/logout') {
        return false;
    }
    if (href === '/') {
        return path === '/' || path.startsWith('/product');
    }
    return path === href || path.startsWith(href + '/');
}

function updateHeaderNavActive(path) {
    const links = document.querySelectorAll('#headerNav a[href]');
    links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href === '/logout') {
            return;
        }
        const active = isNavPathActive(href, path);
        if (link.classList.contains('nav__link') && !link.classList.contains('nav__link--muted')) {
            link.classList.toggle('nav__link--highlight', active);
        }
        if (link.classList.contains('nav__btn')) {
            link.classList.toggle('nav__btn--active', active);
        }
    });
}

function syncCatalogPageFromUrl() {
    const allRoot = document.getElementById('catalog-all-root');
    if (!allRoot) {
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const rawCat = params.get('category_id');
    let categoryId = null;
    if (rawCat !== null && rawCat !== '') {
        const n = Number(rawCat);
        if (Number.isFinite(n) && n > 0) {
            categoryId = n;
        }
    }
    const qRaw = params.get('q');
    const q = qRaw ? String(qRaw).trim() : '';
    const qInput = document.getElementById('catalog-q');
    if (qInput) {
        qInput.value = q;
    }
    syncSearchFormCategory(categoryId);
    updateCategoryNavActive(categoryId);
}

function closeProductPreview() {
    const modal = document.getElementById('productPreviewModal');
    const img = document.getElementById('productPreviewImg');
    if (modal) {
        modal.hidden = true;
    }
    if (img) {
        img.removeAttribute('src');
        img.alt = '';
    }
    document.body.style.overflow = '';
}

function blurCategoryFlyout() {
    const focused = document.activeElement;
    if (
        focused &&
        typeof focused.blur === 'function' &&
        focused.closest &&
        focused.closest('.category-parent--flyout')
    ) {
        focused.blur();
    }
}

function removePuterLeftovers() {
    const path = window.location.pathname || '';
    if (path.indexOf('/constructor') === 0) {
        return;
    }
    document.querySelectorAll('iframe').forEach((el) => {
        const src = String(el.getAttribute('src') || el.src || '');
        if (src.indexOf('puter.com') !== -1 || src.indexOf('puter.site') !== -1) {
            el.remove();
        }
    });
}

function stripUnknownFullOverlays() {
    const keepIds = {
        'page-main': true,
        'site-header': true,
        'toastStack': true,
        'scroll-to-top': true,
        'productPreviewModal': true,
        'support-widget': true,
        'navSettings': true,
        'navNotify': true
    };
    const kids = document.body.children;
    for (let i = kids.length - 1; i >= 0; i -= 1) {
        const el = kids[i];
        if (!(el instanceof HTMLElement)) {
            continue;
        }
        if (el.tagName === 'HEADER' || el.tagName === 'MAIN' || el.tagName === 'FOOTER' || el.tagName === 'SCRIPT') {
            continue;
        }
        if (el.id && keepIds[el.id]) {
            continue;
        }
        if (el.classList.contains('skip-link')) {
            continue;
        }
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'absolute') {
            continue;
        }
        const wide = el.offsetWidth >= window.innerWidth - 24;
        const tall = el.offsetHeight >= window.innerHeight - 24;
        if (!wide || !tall) {
            continue;
        }
        el.remove();
    }
}

function unlockPageUi() {
    document.body.classList.remove(
        'reviews-modal-open',
        'catalog-categories-phone-open',
        'constructor-confirm-open'
    );
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    closeProductPreview();
    closePhoneCategoriesPanel();
    blurCategoryFlyout();
    removePuterLeftovers();
    stripUnknownFullOverlays();

    const settingsPanel = document.getElementById('navSettingsPanel');
    const settingsBtn = document.getElementById('navSettingsBtn');
    if (settingsPanel) {
        settingsPanel.hidden = true;
    }
    if (settingsBtn) {
        settingsBtn.setAttribute('aria-expanded', 'false');
    }
    const notifyPanel = document.getElementById('navNotifyPanel');
    const notifyBtn = document.getElementById('navNotifyBtn');
    if (notifyPanel) {
        notifyPanel.hidden = true;
    }
    if (notifyBtn) {
        notifyBtn.setAttribute('aria-expanded', 'false');
    }

    const reviews = document.getElementById('reviews-modal');
    if (reviews) {
        reviews.hidden = true;
        reviews.setAttribute('aria-hidden', 'true');
    }
    const evenModal = document.getElementById('constructorEvenConfirm');
    if (evenModal) {
        evenModal.hidden = true;
        evenModal.setAttribute('aria-hidden', 'true');
    }

    const main = document.getElementById('page-main');
    if (main) {
        main.classList.remove('page-main--loading');
    }
}

function initScrollToTop() {
    const btn = document.getElementById('scroll-to-top');
    if (!btn || btn.dataset.bound === '1') {
        return;
    }
    btn.dataset.bound = '1';

    const showAfter = 280;

    const updateScrollTopBtn = () => {
        const visible = window.scrollY > showAfter;
        btn.hidden = !visible;
        btn.classList.toggle('scroll-to-top--visible', visible);
    };

    let scrollTimer = null;
    window.addEventListener('scroll', () => {
        if (scrollTimer) {
            return;
        }
        scrollTimer = window.setTimeout(() => {
            scrollTimer = null;
            updateScrollTopBtn();
        }, 80);
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    updateScrollTopBtn();
}

function onPageReady() {
    unlockPageUi();
    updateHeaderNavActive(window.location.pathname);
    syncCatalogPageFromUrl();
    initPhoneCategoriesPanel();
    initScrollToTop();
    refreshWishlistStarsOnPage();
    applyCartButtons();

    const nav = document.getElementById('headerNav');
    if (nav) {
        nav.classList.remove('nav--open');
    }
    const burger = document.getElementById('headerBurger');
    if (burger) {
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Відкрити меню');
    }

    const main = document.getElementById('page-main');
    if (main) {
        main.classList.remove('page-main--loading');
    }
}

const FULL_RELOAD_PATHS = ['/logout', '/checkout', '/login', '/register'];

function shouldUseFullReload(pathname) {
    if (FULL_RELOAD_PATHS.includes(pathname)) {
        return true;
    }
    if (pathname.startsWith('/payment')) {
        return true;
    }
    return false;
}

function executeScripts(root) {
    if (!root) {
        return;
    }
    const scripts = root.querySelectorAll('script');
    scripts.forEach((oldScript) => {
        const src = oldScript.getAttribute('src') || '';
        if (src.indexOf('js.puter.com') !== -1 && typeof window.puter !== 'undefined') {
            oldScript.remove();
            return;
        }
        const newScript = document.createElement('script');
        for (const attr of oldScript.attributes) {
            newScript.setAttribute(attr.name, attr.value);
        }
        newScript.textContent = oldScript.textContent;
        oldScript.replaceWith(newScript);
    });
}

let softNavBusy = false;
let softNavAbort = null;

async function softNavigate(url, pushState) {
    if (softNavBusy) {
        window.location.href = url;
        return;
    }
    const main = document.getElementById('page-main');
    if (!main) {
        window.location.href = url;
        return;
    }

    softNavBusy = true;
    unlockPageUi();
    main.classList.add('page-main--loading');

    if (softNavAbort) {
        softNavAbort.abort();
    }
    softNavAbort = new AbortController();
    const thisAbort = softNavAbort;

    const navTimeout = window.setTimeout(() => {
        thisAbort.abort();
        unlockPageUi();
    }, 8000);

    try {
        const res = await fetch(url, {
            credentials: 'same-origin',
            headers: { Accept: 'text/html' },
            signal: thisAbort.signal
        });
        if (!res.ok) {
            window.location.href = url;
            return;
        }

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newMain = doc.getElementById('page-main');
        if (!newMain) {
            window.location.href = url;
            return;
        }

        const newTitle = doc.querySelector('title');
        if (newTitle && newTitle.textContent) {
            document.title = newTitle.textContent.trim();
        }

        main.innerHTML = newMain.innerHTML;
        executeScripts(main);

        if (pushState) {
            history.pushState({ softNav: true }, '', url);
        }

        onPageReady();
        window.scrollTo(0, 0);
    } catch (err) {
        if (err && err.name === 'AbortError') {
            window.location.href = url;
            return;
        }
        window.location.href = url;
    } finally {
        window.clearTimeout(navTimeout);
        if (softNavAbort === thisAbort) {
            softNavAbort = null;
        }
        softNavBusy = false;
        main.classList.remove('page-main--loading');
    }
}

document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) {
        return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
    }

    const link = e.target.closest('a[href]');
    if (!link) {
        return;
    }
    if (link.dataset.softNav === 'false') {
        return;
    }

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
    }

    let targetUrl;
    try {
        targetUrl = new URL(href, window.location.href);
    } catch (err) {
        return;
    }

    if (targetUrl.origin !== window.location.origin) {
        return;
    }
    if (shouldUseFullReload(targetUrl.pathname)) {
        return;
    }

    const next = targetUrl.pathname + targetUrl.search + targetUrl.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (next === current) {
        return;
    }

    e.preventDefault();
    softNavigate(next, true);
});

document.addEventListener('DOMContentLoaded', onPageReady);

(function initHeaderMenu() {
    const burger = document.getElementById('headerBurger');
    const nav = document.getElementById('headerNav');
    if (!burger || !nav) {
        return;
    }

    const closeMenu = () => {
        nav.classList.remove('nav--open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Відкрити меню');
    };

    burger.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('nav--open');
        burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        burger.setAttribute('aria-label', isOpen ? 'Закрити меню' : 'Відкрити меню');
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !nav.classList.contains('nav--open')) {
            return;
        }
        closeMenu();
        burger.focus();
    });

    nav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', (event) => {
        if (!nav.classList.contains('nav--open')) {
            return;
        }
        const target = event.target;
        if (target instanceof Node && !nav.contains(target) && !burger.contains(target)) {
            closeMenu();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 860) {
            closeMenu();
        }
    });
})();

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.catalogNav && document.getElementById('catalog-category-root')) {
        const params = new URLSearchParams(window.location.search);
        const rawCat = params.get('category_id');
        let categoryId = null;
        if (rawCat !== null && rawCat !== '') {
            const n = Number(rawCat);
            if (Number.isFinite(n) && n > 0) {
                categoryId = n;
            }
        }
        const qRaw = params.get('q');
        const q = qRaw ? String(qRaw).trim() : '';
        const qInput = document.getElementById('catalog-q');
        if (qInput) {
            qInput.value = q;
        }
        loadCatalogProducts(categoryId, q);
        return;
    }

    const path = window.location.pathname || '/';
    if (shouldUseFullReload(path)) {
        window.location.reload();
        return;
    }

    softNavigate(window.location.pathname + window.location.search, false);
});

(function initProductPreview() {
    const modal = document.getElementById('productPreviewModal');
    const img = document.getElementById('productPreviewImg');
    const closeBtn = document.getElementById('productPreviewClose');
    if (!modal || !img) {
        return;
    }

    const openPreview = (src, alt) => {
        const url = typeof src === 'string' ? src.trim() : '';
        if (!url) {
            return;
        }
        img.src = url;
        img.alt = typeof alt === 'string' ? alt : '';
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    };

    document.addEventListener('click', (event) => {
        const btn = event.target.closest('.product-preview-btn');
        if (btn) {
            event.preventDefault();
            event.stopPropagation();
            openPreview(btn.getAttribute('data-preview-src'), btn.getAttribute('data-preview-alt'));
            return;
        }
        if (event.target === modal || (event.target.closest && event.target.closest('#productPreviewModal'))) {
            closeProductPreview();
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closeProductPreview);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) {
            closeProductPreview();
        }
    });
})();

document.addEventListener('click', (event) => {
    if (event.target.closest('.category-parent--flyout')) {
        return;
    }
    blurCategoryFlyout();
});
