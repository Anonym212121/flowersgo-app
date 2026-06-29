(() => {
    const root = document.getElementById('support-widget');
    const fab = document.getElementById('support-fab');
    const fabBadge = document.getElementById('support-fab-badge');
    const panel = document.getElementById('support-panel');
    const panelBody = document.getElementById('support-panel-body');
    const panelTitle = document.getElementById('support-panel-title');
    const btnBack = document.getElementById('support-back');
    const btnMinimize = document.getElementById('support-minimize');
    const btnClose = document.getElementById('support-close');

    if (!root || !fab || !panel || !panelBody) {
        return;
    }

    const isLoggedIn = root.getAttribute('data-logged-in') === '1';
    const POLL_MS = 8000;

    let screen = 'menu';
    let phones = [];
    let welcomeMessage = 'Вітаємо в службі підтримки FlowersGo! Опишіть, будь ласка, чим можемо допомогити — оператор незабаром підключиться до чату.';
    let panelInitialized = false;
    let chat = null;
    let messages = [];
    let lastMessageId = 0;
    let sending = false;
    let isArchive = false;
    let hasClosedChats = false;
    let hasActiveChat = false;
    let chatPollActive = false;

    const setChatPanelMode = (enabled) => {
        if (enabled) {
            panel.classList.add('support-panel--chat');
        } else {
            panel.classList.remove('support-panel--chat');
        }
    };

    const getWelcomeVirtualMessage = () => ({
        id: 'welcome-local',
        sender_type: 'system',
        body: welcomeMessage
    });

    const refreshArchiveFlag = async () => {
        try {
            const data = await apiFetch('/api/support/archive');
            const count = Number(data.count);
            if (Number.isFinite(count)) {
                hasClosedChats = count > 0;
            } else {
                hasClosedChats = Array.isArray(data.chats) && data.chats.length > 0;
            }
        } catch (e) {
            hasClosedChats = false;
        }
    };

    const syncActiveFlag = () => {
        hasActiveChat = !!(chat && !isArchive && chat.status !== 'closed');
    };

    const updateFabBadge = (count) => {
        if (!fabBadge) {
            return;
        }
        const n = Number(count) || 0;
        if (n > 0) {
            fabBadge.hidden = false;
            fabBadge.textContent = n > 99 ? '99+' : String(n);
        } else {
            fabBadge.hidden = true;
        }
    };

    const isViewingActiveChat = () => {
        return screen === 'chat' && !isArchive && chat && chat.status !== 'closed' &&
            panel.classList.contains('support-panel--open');
    };

    const markChatRead = async () => {
        if (!chat || isArchive || chat.status === 'closed') {
            updateFabBadge(0);
            return;
        }
        try {
            await apiFetch('/api/support/read', {
                method: 'POST',
                body: JSON.stringify({ chat_id: chat.id })
            });
            updateFabBadge(0);
            if (window.SiteAlerts && typeof window.SiteAlerts.setInitialCount === 'function') {
                window.SiteAlerts.setInitialCount('support', 0);
            }
        } catch (e) {
        }
    };

    const pollUnread = async () => {
        try {
            const data = await apiFetch('/api/support/unread-count');
            const count = Number(data.unread_count) || 0;
            if (isViewingActiveChat()) {
                await markChatRead();
                return;
            }
            if (window.SiteAlerts && typeof window.SiteAlerts.onCountIncrease === 'function') {
                window.SiteAlerts.onCountIncrease('support', count, {
                    title: 'Підтримка FlowersGo',
                    body: 'Нове повідомлення в чаті підтримки',
                    link: null
                });
            }
            updateFabBadge(count);
        } catch (e) {
        }
    };

    const startUnreadPoll = () => {
        pollUnread();
    };

    const refreshSupport = async () => {
        await pollUnread();
        if (chatPollActive && chat && !isArchive && chat.status !== 'closed') {
            await pollOnce();
        }
    };

    const escapeHtml = (value) => {
        return String(value == null ? '' : value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    };

    const apiFetch = async (url, options) => {
        const res = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data && data.message ? data.message : 'Помилка запиту';
            throw new Error(msg);
        }
        return data;
    };

    const stopPoll = () => {
        chatPollActive = false;
    };

    const formatTime = (iso) => {
        if (!iso) {
            return '';
        }
        try {
            const d = new Date(iso);
            return d.toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    const mergeMessages = (incoming) => {
        if (!Array.isArray(incoming) || incoming.length === 0) {
            return;
        }
        for (let i = 0; i < incoming.length; i += 1) {
            const m = incoming[i];
            if (!m || !m.id) {
                continue;
            }
            const exists = messages.some((x) => x.id === m.id);
            if (!exists) {
                messages.push(m);
            }
            if (m.id > lastMessageId) {
                lastMessageId = m.id;
            }
        }
    };

    const renderMessagesHtml = () => {
        if (messages.length === 0) {
            return '<p class="support-note">Повідомлень поки немає.</p>';
        }
        return messages.map((m) => renderOneMessageHtml(m)).join('');
    };

    const renderOneMessageHtml = (m) => {
        if (!m) {
            return '';
        }
        let cls = 'support-msg--client';
        let meta = '';
        if (m.sender_type === 'admin') {
            cls = 'support-msg--admin';
            meta = m.sender_label ? '<span class="support-msg__meta">' + escapeHtml(m.sender_label) + '</span>' : '';
        } else if (m.sender_type === 'system') {
            cls = 'support-msg--system';
        }
        return (
            '<div class="support-msg ' + cls + '" data-msg-id="' + m.id + '">' +
            meta +
            escapeHtml(m.body) +
            '</div>'
        );
    };

    const appendMessagesToBox = (incoming) => {
        const box = document.getElementById('support-messages');
        if (!box || !Array.isArray(incoming) || incoming.length === 0) {
            return;
        }

        if (messages.length === 0 && box.querySelector('.support-note')) {
            box.innerHTML = '';
        }

        incoming.forEach((m) => {
            if (!m || !m.id) {
                return;
            }
            if (box.querySelector('[data-msg-id="' + m.id + '"]')) {
                return;
            }
            box.insertAdjacentHTML('beforeend', renderOneMessageHtml(m));
        });
        scrollMessagesDown();
    };

    const updateStatusLine = () => {
        const statusEl = panelBody.querySelector('.support-chat-status');
        if (statusEl) {
            statusEl.textContent = chatStatusText();
        }
    };

    const scrollMessagesDown = () => {
        const box = panelBody.querySelector('.support-messages');
        if (box) {
            box.scrollTop = box.scrollHeight;
        }
    };

    const chatStatusText = () => {
        if (!chat) {
            return '';
        }
        if (chat.status === 'open') {
            return 'Очікуємо оператора…';
        }
        if (chat.status === 'assigned') {
            const name = chat.admin_name || 'Оператор';
            return 'Оператор: ' + name;
        }
        if (chat.status === 'closed') {
            return 'Діалог завершено. Переписку можна лише читати.';
        }
        return '';
    };

    const bindSendForm = () => {
        const form = document.getElementById('support-send-form');
        if (!form) {
            return;
        }
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (sending || !chat || chat.status === 'closed') {
                return;
            }
            const input = document.getElementById('support-message-input');
            const text = input && input.value ? input.value.trim() : '';
            if (!text) {
                return;
            }
            sending = true;
            try {
                const data = await apiFetch('/api/support/message', {
                    method: 'POST',
                    body: JSON.stringify({ chat_id: chat.id, message: text })
                });
                if (data.message) {
                    mergeMessages([data.message]);
                    appendMessagesToBox([data.message]);
                }
                if (input) {
                    input.value = '';
                }
            } catch (err) {
                if (typeof window.showToast === 'function') {
                    window.showToast(err.message, 'error');
                }
            } finally {
                sending = false;
            }
        });
    };

    const renderChatScreen = () => {
        const closed = chat && chat.status === 'closed';
        const canSend = chat && !closed && !isArchive;
        const statusClass = (closed || isArchive) ? ' support-chat-status--archive' : '';
        const msgClass = (closed || isArchive) ? ' support-messages--readonly' : '';

        setChatPanelMode(true);

        panelBody.innerHTML =
            '<p class="support-chat-status' + statusClass + '">' + escapeHtml(chatStatusText()) + '</p>' +
            '<div class="support-messages' + msgClass + '" id="support-messages">' + renderMessagesHtml() + '</div>' +
            (closed || isArchive
                ? '<button type="button" class="support-menu__btn" id="support-new-chat">Новий чат</button>'
                : (
                    '<form class="support-compose" id="support-send-form">' +
                    '<input type="text" id="support-message-input" maxlength="2000" placeholder="Ваше повідомлення" autocomplete="off">' +
                    '<button type="submit"' + (canSend ? '' : ' disabled') + '>Надіслати</button>' +
                    '</form>'
                ));

        scrollMessagesDown();

        if (closed || isArchive) {
            const newBtn = document.getElementById('support-new-chat');
            if (newBtn) {
                newBtn.addEventListener('click', () => {
                    chat = null;
                    messages = [];
                    lastMessageId = 0;
                    isArchive = false;
                    syncActiveFlag();
                    stopPoll();
                    showNewChatCompose();
                });
            }
            return;
        }

        bindSendForm();
        markChatRead();
    };

    const showMenu = () => {
        screen = 'menu';
        panelTitle.textContent = 'Підтримка';
        btnBack.hidden = true;
        setChatPanelMode(false);

        const chatBtnLabel = hasActiveChat ? 'Мій чат' : 'Новий чат';
        let menuHtml =
            '<div class="support-menu">' +
            '<button type="button" class="support-menu__btn" id="support-go-chat">' + chatBtnLabel + '</button>' +
            '<button type="button" class="support-menu__btn" id="support-go-phones">Телефони</button>';

        if (hasClosedChats) {
            menuHtml += '<button type="button" class="support-menu__btn support-menu__btn--archive" id="support-go-archive">Архів чатів</button>';
        }

        menuHtml += '<div id="support-alert-settings" class="support-alert-settings"></div></div>';
        panelBody.innerHTML = menuHtml;

        if (typeof window.renderAlertSettingsBtn === 'function') {
            window.renderAlertSettingsBtn(document.getElementById('support-alert-settings'));
        }

        document.getElementById('support-go-chat').addEventListener('click', () => {
            openChatFlow();
        });
        document.getElementById('support-go-phones').addEventListener('click', () => {
            showPhones();
        });

        const archiveBtn = document.getElementById('support-go-archive');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', () => {
                showArchiveList();
            });
        }
    };

    const showArchiveList = async () => {
        screen = 'archive-list';
        panelTitle.textContent = 'Архів чатів';
        btnBack.hidden = false;
        setChatPanelMode(false);
        panelBody.innerHTML = '<p class="support-note">Завантаження…</p>';

        try {
            const data = await apiFetch('/api/support/archive');
            const items = Array.isArray(data.chats) ? data.chats : [];

            if (items.length === 0) {
                hasClosedChats = false;
                panelBody.innerHTML = '<p class="support-note">Архів порожній.</p>';
                return;
            }

            hasClosedChats = true;
            panelBody.innerHTML =
                '<ul class="support-archive-list">' +
                items.map((item) => {
                    const dateText = formatTime(item.closed_at);
                    return (
                        '<li class="support-archive-list__item">' +
                        '<button type="button" class="support-archive-list__btn" data-archive-id="' + item.id + '">' +
                        '<span class="support-archive-list__title">Чат №' + item.id + '</span>' +
                        '<span class="support-archive-list__date">' + escapeHtml(dateText || '—') + '</span>' +
                        '<span class="support-archive-list__preview">' + escapeHtml((item.preview || '').slice(0, 80)) + '</span>' +
                        '</button></li>'
                    );
                }).join('') +
                '</ul>';

            panelBody.querySelectorAll('[data-archive-id]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.getAttribute('data-archive-id'));
                    openArchiveChat(id);
                });
            });

            const archiveList = panelBody.querySelector('.support-archive-list');
            if (archiveList && window.ListPager) {
                window.ListPager.mount(archiveList, { itemSelector: '.support-archive-list__item' });
            }
        } catch (err) {
            panelBody.innerHTML = '<p class="support-error">' + escapeHtml(err.message) + '</p>';
        }
    };

    const openArchiveChat = async (chatId) => {
        try {
            const data = await apiFetch('/api/support/archive/' + chatId);
            loadChatFromServer(data);
        } catch (err) {
            if (typeof window.showToast === 'function') {
                window.showToast(err.message, 'error');
            }
        }
    };

    const showPhones = () => {
        screen = 'phones';
        panelTitle.textContent = 'Телефони';
        btnBack.hidden = false;
        setChatPanelMode(false);

        let listHtml = '';
        if (phones.length === 0) {
            listHtml = '<p class="support-note">Телефони не налаштовані.</p>';
        } else {
            listHtml = '<ul class="support-phones">' + phones.map((p) => {
                const tel = String(p.number).replace(/[^\d+]/g, '');
                return (
                    '<li class="support-phones__item">' +
                    '<a href="tel:' + escapeHtml(tel) + '">' +
                    '<span class="support-phones__label">' + escapeHtml(p.label) + '</span>' +
                    escapeHtml(p.number) +
                    '</a></li>'
                );
            }).join('') + '</ul>';
        }

        panelBody.innerHTML = listHtml;
    };

    const showNewChatCompose = () => {
        screen = 'new-chat';
        panelTitle.textContent = 'Новий чат';
        btnBack.hidden = false;
        setChatPanelMode(true);

        const welcome = getWelcomeVirtualMessage();
        const guestHtml = !isLoggedIn
            ? (
                '<div class="support-guest-fields">' +
                '<input type="text" id="support-guest-name" placeholder="Ваше ім\'я" maxlength="120" required autocomplete="name">' +
                '<input type="email" id="support-guest-email" placeholder="Email" maxlength="190" autocomplete="email">' +
                '<input type="tel" id="support-guest-phone" placeholder="Телефон" maxlength="40" autocomplete="tel">' +
                '</div>' +
                '<p class="support-note support-note--inline">Вкажіть email або телефон для зв\'язку.</p>'
            )
            : '';

        panelBody.innerHTML =
            '<p class="support-chat-status">Очікуємо ваше повідомлення…</p>' +
            '<div class="support-messages" id="support-messages">' +
            renderOneMessageHtml(welcome) +
            '</div>' +
            guestHtml +
            '<form class="support-compose" id="support-start-form">' +
            '<input type="text" id="support-message-input" maxlength="2000" placeholder="Ваше повідомлення" autocomplete="off" required>' +
            '<button type="submit">Надіслати</button>' +
            '</form>' +
            '<p class="support-error" id="support-start-error" hidden></p>';

        scrollMessagesDown();
        bindNewChatForm();
    };

    const bindNewChatForm = () => {
        const form = document.getElementById('support-start-form');
        if (!form) {
            return;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (sending) {
                return;
            }

            const errEl = document.getElementById('support-start-error');
            const input = document.getElementById('support-message-input');
            const text = input && input.value ? input.value.trim() : '';
            if (!text) {
                return;
            }

            const body = { message: text };

            if (!isLoggedIn) {
                body.guest_name = (document.getElementById('support-guest-name').value || '').trim();
                body.guest_email = (document.getElementById('support-guest-email').value || '').trim();
                body.guest_phone = (document.getElementById('support-guest-phone').value || '').trim();
            }

            sending = true;
            if (errEl) {
                errEl.hidden = true;
            }

            try {
                const data = await apiFetch('/api/support/start', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                chat = data.chat;
                messages = Array.isArray(data.messages) ? data.messages.slice() : [];
                isArchive = false;
                lastMessageId = 0;
                messages.forEach((m) => {
                    if (m.id > lastMessageId) {
                        lastMessageId = m.id;
                    }
                });
                screen = 'chat';
                panelTitle.textContent = 'Чат №' + chat.id;
                syncActiveFlag();
                renderChatScreen();
                startPoll();
                refreshArchiveFlag();
            } catch (err) {
                if (errEl) {
                    errEl.textContent = err.message;
                    errEl.hidden = false;
                } else if (typeof window.showToast === 'function') {
                    window.showToast(err.message, 'error');
                }
            } finally {
                sending = false;
            }
        });
    };

    const loadChatFromServer = (data) => {
        chat = data.chat;
        messages = Array.isArray(data.messages) ? data.messages.slice() : [];
        isArchive = !!(data.is_archive || (chat && chat.status === 'closed'));
        lastMessageId = 0;
        messages.forEach((m) => {
            if (m.id > lastMessageId) {
                lastMessageId = m.id;
            }
        });
        screen = 'chat';
        if (isArchive) {
            panelTitle.textContent = 'Архів чату №' + chat.id;
        } else {
            panelTitle.textContent = 'Чат №' + chat.id;
        }
        btnBack.hidden = false;
        syncActiveFlag();
        renderChatScreen();
        if (!isArchive && chat.status !== 'closed') {
            startPoll();
        } else {
            stopPoll();
        }
    };

    const openChatFlow = async () => {
        try {
            const data = await apiFetch('/api/support/active');
            if (data.chat) {
                loadChatFromServer(data);
                return;
            }
            isArchive = false;
            showNewChatCompose();
        } catch (err) {
            isArchive = false;
            showNewChatCompose();
        }
    };

    const pollOnce = async () => {
        if (!chat || chat.status === 'closed' || isArchive) {
            return;
        }
        try {
            const url = '/api/support/poll?chat_id=' + encodeURIComponent(chat.id) +
                '&since_id=' + encodeURIComponent(lastMessageId);
            const data = await apiFetch(url);
            const prevStatus = chat.status;
            if (data.chat) {
                chat = data.chat;
            }

            const beforeCount = messages.length;
            mergeMessages(data.messages);
            const newOnes = messages.slice(beforeCount);

            if (chat.status === 'closed') {
                isArchive = true;
                syncActiveFlag();
                stopPoll();
                panelTitle.textContent = 'Архів чату №' + chat.id;
                refreshArchiveFlag();
                renderChatScreen();
                return;
            }

            if (newOnes.length > 0) {
                appendMessagesToBox(newOnes);
                if (isViewingActiveChat()) {
                    markChatRead();
                }
            }

            if (data.chat && (prevStatus !== chat.status || chat.admin_name)) {
                updateStatusLine();
            }
        } catch (err) {
        }
    };

    const startPoll = () => {
        chatPollActive = true;
        pollOnce();
    };

    const openPanel = () => {
        panel.hidden = false;
        panel.classList.add('support-panel--open');

        if (!panelInitialized) {
            if (hasActiveChat && chat) {
                screen = 'chat';
                panelTitle.textContent = 'Чат №' + chat.id;
                btnBack.hidden = false;
                renderChatScreen();
            } else {
                showMenu();
            }
            panelInitialized = true;
        }

        if (screen === 'chat' && chat && !isArchive && chat.status !== 'closed') {
            markChatRead();
            scrollMessagesDown();
            if (!chatPollActive) {
                startPoll();
            }
        }
    };

    const minimizePanel = () => {
        panel.hidden = true;
        panel.classList.remove('support-panel--open');
    };

    btnBack.addEventListener('click', () => {
        if (screen === 'phones' || screen === 'new-chat') {
            showMenu();
            return;
        }
        if (screen === 'archive-list') {
            showMenu();
            return;
        }
        if (screen === 'chat') {
            if (isArchive) {
                showArchiveList();
            } else {
                stopPoll();
                showMenu();
            }
        }
    });

    if (btnMinimize) {
        btnMinimize.addEventListener('click', () => {
            minimizePanel();
        });
    }

    btnClose.addEventListener('click', () => {
        minimizePanel();
    });

    fab.addEventListener('click', () => {
        if (panel.hidden) {
            openPanel();
            if (window.SiteAlerts && typeof window.SiteAlerts.requestPushPermission === 'function') {
                window.SiteAlerts.requestPushPermission();
            }
        } else {
            minimizePanel();
        }
    });

    (async function init() {
        try {
            const cfg = await apiFetch('/api/support/config');
            phones = Array.isArray(cfg.phones) ? cfg.phones : [];
            if (cfg.welcome_message && typeof cfg.welcome_message === 'string') {
                welcomeMessage = cfg.welcome_message;
            }
        } catch (e) {
            phones = [];
        }

        await refreshArchiveFlag();

        try {
            const data = await apiFetch('/api/support/active');
            if (data.chat) {
                chat = data.chat;
                messages = Array.isArray(data.messages) ? data.messages.slice() : [];
                isArchive = false;
                lastMessageId = 0;
                messages.forEach((m) => {
                    if (m.id > lastMessageId) {
                        lastMessageId = m.id;
                    }
                });
                syncActiveFlag();
                screen = 'chat';
                startPoll();
            }
        } catch (e) {
        }

        try {
            const unreadData = await apiFetch('/api/support/unread-count');
            if (window.SiteAlerts && typeof window.SiteAlerts.setInitialCount === 'function') {
                window.SiteAlerts.setInitialCount('support', Number(unreadData.unread_count) || 0);
            }
            updateFabBadge(unreadData.unread_count);
        } catch (e) {
        }

        startUnreadPoll();
        if (window.SiteNotifyAuto && typeof window.SiteNotifyAuto.register === 'function') {
            window.SiteNotifyAuto.register('support', refreshSupport);
        } else {
            setInterval(refreshSupport, POLL_MS);
        }

        if (window.SiteAlerts && typeof window.SiteAlerts.maybeAskPush === 'function') {
            setTimeout(() => window.SiteAlerts.maybeAskPush(), 3000);
        }
    })();
})();
