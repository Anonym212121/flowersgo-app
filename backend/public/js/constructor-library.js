(function () {
    var cfg = window.constructorConfig || {};
    var grid = document.getElementById('constructorLibraryGrid');
    var section = document.getElementById('constructorLibrary');

    if (!grid || !section) {
        return;
    }

    var templatesUrl = cfg.templatesUrl || '/api/constructor/templates';

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatPrice(value) {
        var n = Number(value);
        if (!Number.isFinite(n)) {
            return '—';
        }
        return n.toFixed(0) + ' грн';
    }

    function toast(text, ok) {
        if (typeof window.showToast === 'function') {
            window.showToast(text, ok ? 'ok' : 'error');
        }
    }

    function renderTemplates(list) {
        section.hidden = false;

        if (!Array.isArray(list) || list.length === 0) {
            grid.innerHTML =
                '<p class="constructor-library__empty">' +
                'Готових шаблонів поки немає. Адмін може додати їх у розділі «Конструктор» → «Бібліотека готових букетів».' +
                '</p>';
            return;
        }

        var html = '';

        for (var i = 0; i < list.length; i += 1) {
            var t = list[i];
            var preview = t.items_preview && t.items_preview.length
                ? t.items_preview.slice(0, 3).map(function (line) {
                    return escapeHtml(line.label) + ' ×' + line.quantity;
                }).join(', ')
                : '';
            var imgHtml = t.image_url
                ? '<img class="constructor-library-card__img" src="' + escapeHtml(t.image_url) + '" alt="">'
                : '<div class="constructor-library-card__img constructor-library-card__img--placeholder" aria-hidden="true">✿</div>';

            html +=
                '<article class="constructor-library-card">' +
                imgHtml +
                '<div class="constructor-library-card__body">' +
                '<h3 class="constructor-library-card__title">' + escapeHtml(t.name) + '</h3>' +
                (t.description ? '<p class="constructor-library-card__desc">' + escapeHtml(t.description) + '</p>' : '') +
                (preview ? '<p class="constructor-library-card__preview">' + preview + '</p>' : '') +
                '<p class="constructor-library-card__meta">' +
                escapeHtml(String(t.stem_total || 0)) + ' квіток · <strong>' + formatPrice(t.total) + '</strong>' +
                '</p>' +
                (t.available ? '' : '<p class="constructor-library-card__warn">' + escapeHtml(t.unavailable_message || 'Зараз недоступно') + '</p>') +
                '<div class="constructor-library-card__actions">' +
                '<button type="button" class="auth-button auth-button--ghost constructor-library-edit" data-slug="' + escapeHtml(t.slug) + '">Редагувати</button>' +
                '<button type="button" class="auth-button constructor-library-buy"' +
                ' data-slug="' + escapeHtml(t.slug) + '"' +
                (t.available ? '' : ' disabled') +
                '>Купити</button>' +
                '</div></div></article>';
        }

        grid.innerHTML = html;
    }

    function loadTemplateDraft(slug) {
        return fetch('/api/constructor/templates/' + encodeURIComponent(slug), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        }).then(function (res) {
            return res.json().then(function (data) {
                if (!res.ok || !data.draft) {
                    throw new Error((data && data.message) || 'Шаблон не знайдено');
                }
                return data;
            });
        });
    }

    function onEditClick(btn) {
        var slug = btn.getAttribute('data-slug');
        if (!slug) {
            return;
        }
        btn.disabled = true;
        loadTemplateDraft(slug)
            .then(function (data) {
                var name = data.template && data.template.name ? data.template.name : 'Шаблон';
                if (typeof window.constructorApplyDraft === 'function') {
                    window.constructorApplyDraft(data.draft, 'Завантажено: «' + name + '»');
                } else {
                    try {
                        localStorage.setItem(
                            cfg.draftStorageKey || 'flowersgo_constructor_draft',
                            JSON.stringify(data.draft)
                        );
                        window.location.href = '/constructor?template=' + encodeURIComponent(slug);
                        return;
                    } catch (e) {
                        throw new Error('Конструктор ще завантажується — спробуй ще раз');
                    }
                }
                var target = document.querySelector('.constructor-flowers');
                if (target && target.scrollIntoView) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            })
            .catch(function (err) {
                toast(err.message || 'Помилка', false);
            })
            .finally(function () {
                btn.disabled = false;
            });
    }

    function onBuyClick(btn) {
        var slug = btn.getAttribute('data-slug');
        if (!slug) {
            return;
        }
        btn.disabled = true;
        fetch('/constructor/templates/' + encodeURIComponent(slug) + '/add', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: '{}'
        })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (!res.ok || !data.ok) {
                        throw new Error((data && data.message) || 'Помилка');
                    }
                    return data;
                });
            })
            .then(function (data) {
                toast(data.message || 'Додано в кошик', true);
                if (typeof window.updateNavCartCount === 'function' && data.count != null) {
                    window.updateNavCartCount(data.count);
                }
                window.location.href = data.redirect || '/cart';
            })
            .catch(function (err) {
                toast(err.message || 'Не вдалося додати', false);
                btn.disabled = false;
            });
    }

    grid.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.constructor-library-edit');
        if (editBtn) {
            onEditClick(editBtn);
            return;
        }
        var buyBtn = e.target.closest('.constructor-library-buy');
        if (buyBtn) {
            onBuyClick(buyBtn);
        }
    });

    fetch(templatesUrl, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
    })
        .then(function (res) {
            return res.json().then(function (data) {
                if (!res.ok) {
                    throw new Error((data && data.message) || 'Помилка');
                }
                return data;
            });
        })
        .then(function (data) {
            renderTemplates(data.templates || []);
        })
        .catch(function (err) {
            section.hidden = false;
            grid.innerHTML =
                '<p class="constructor-library__empty">Не вдалося завантажити шаблони. Оновіть сторінку.</p>';
            if (typeof console !== 'undefined' && console.error) {
                console.error('constructor-library:', err);
            }
        });
})();
