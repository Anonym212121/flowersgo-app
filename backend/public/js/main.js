document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('wishlist-ajax')) {
        return;
    }

    e.preventDefault();

    const action = form.getAttribute('action') || '';
    // FormData з fetch дає multipart — Express (urlencoded) не читає req.body.
    // URLSearchParams надсилає application/x-www-form-urlencoded, як звичайна форма.
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
