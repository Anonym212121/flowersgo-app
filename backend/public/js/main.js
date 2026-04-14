document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('wishlist-ajax')) {
        return;
    }

    e.preventDefault();

    const action = form.getAttribute('action') || '';
    const body = new URLSearchParams(new FormData(form));

    try {
        const res = await fetch(action, {
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
            window.alert(msg);
            return;
        }

        if (action.includes('/wishlist/add')) {
            const btn = form.querySelector('.wishlist-star-btn');
            if (btn) {
                btn.textContent = '★';
                btn.classList.add('wishlist-star-btn--active');
                btn.setAttribute('title', 'У обраному');
                btn.setAttribute('aria-label', 'У обраному');
            }
        }

        if (action.includes('/wishlist/remove')) {
            const card = form.closest('.product-card');
            if (card && card.parentElement) {
                card.remove();
            }

            const grid = document.querySelector('.products-grid');
            if (grid && grid.children.length === 0) {
                window.location.reload();
            }
        }
    } catch (err) {
        window.alert('Помилка мережі');
    }
});

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildCatalogProductsHtml(products) {
    if (!products || products.length === 0) {
        return '<p>Товари не знайдено.</p>';
    }

    const cards = products.map((product) => {
        const basePrice = Number(product.base_price || 0);
        const salePrice = Number(product.sale_price || 0);
        const hasDiscount = basePrice > 0 && salePrice > 0 && salePrice < basePrice;
        const discountPercent = hasDiscount
            ? Math.round(((basePrice - salePrice) / basePrice) * 100)
            : 0;
        const nameEsc = escapeHtml(product.name);
        const unitEsc = escapeHtml(product.unit_type || 'шт');
        const imgBlock = product.image_url
            ? `<img src="${escapeHtml(product.image_url)}" alt="${nameEsc}" class="product-image" />`
            : '<div class="product-image product-image--placeholder">Немає фото</div>';
        const discountBadge =
            discountPercent > 0
                ? `<span class="discount-badge">${discountPercent}%</span>`
                : '';
        const oldPriceBlock = hasDiscount
            ? `<span class="old-price">${basePrice.toLocaleString('uk-UA')} грн</span>`
            : '';
        const stockQty = Number(product.stock_quantity);
        const stockText =
            stockQty > 0
                ? `В наявності: ${stockQty} ${unitEsc}`
                : 'Немає в наявності';

        return `<article class="product-card">
                        <a href="/product/${product.id}" class="product-card-link">
                        <div class="product-image-wrap">
                            ${discountBadge}
                            ${imgBlock}
                        </div>

                        <h4 class="product-title">${nameEsc}</h4>

                        <p class="product-price">
                            ${oldPriceBlock}
                            <strong>${salePrice.toLocaleString('uk-UA')} грн</strong>
                        </p>

                        <p class="product-stock">
                            ${stockText}
                        </p>
                        </a>

                        <div class="product-card-actions">
                            <form method="post" action="/wishlist/add" class="wishlist-form wishlist-ajax">
                                <input type="hidden" name="product_id" value="${product.id}" />
                                <button class="wishlist-star-btn" type="submit" title="Додати в обране" aria-label="Додати в обране">☆</button>
                            </form>
                            <button class="product-order-btn" type="button">Замовити</button>
                        </div>
                    </article>`;
    });

    return `<div class="products-grid">${cards.join('')}</div>`;
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

function updateCategoryNavActive(categoryId) {
    const navLinks = document.querySelectorAll('.catalog-sidebar .catalog-category-nav');
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

async function loadCatalogProducts(categoryId, q) {
    const root = document.getElementById('catalog-products-root');
    if (!root) {
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

    try {
        const res = await fetch(url, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg =
                data && data.message ? data.message : 'Не вдалося оновити товари';
            window.alert(msg);
            return false;
        }
        const products = data.products || [];
        root.innerHTML = buildCatalogProductsHtml(products);
        syncSearchFormCategory(categoryId);
        updateCategoryNavActive(categoryId);
        return true;
    } catch (err) {
        window.alert('Помилка мережі');
        return false;
    }
}

document.addEventListener('click', (e) => {
    const a = e.target.closest('a.catalog-category-nav');
    if (!a || !a.closest('.catalog-sidebar')) {
        return;
    }
    if (!document.querySelector('.catalog-layout') || !document.getElementById('catalog-products-root')) {
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

    const raw = a.getAttribute('data-category-id');
    const categoryId = raw === null || raw === '' ? null : Number(raw);
    const qInput = document.getElementById('catalog-q');
    const q = qInput && qInput.value ? String(qInput.value).trim() : '';
    const nextUrl = buildCatalogUrl(categoryId, q);

    loadCatalogProducts(categoryId, q).then((ok) => {
        if (ok) {
            window.history.pushState({ catalogNav: true, categoryId, q }, '', nextUrl);
        }
    });
});

window.addEventListener('popstate', () => {
    if (!document.getElementById('catalog-products-root')) {
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
    loadCatalogProducts(categoryId, q);
});
