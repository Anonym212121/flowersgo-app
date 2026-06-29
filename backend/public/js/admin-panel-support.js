(() => {
    const content = document.getElementById('admin-panel-content');
    const supportBtn = document.getElementById('admin-show-support');

    if (!content || !supportBtn) {
        return;
    }

    const ADMIN_VIEW_KEY = 'flowersgo_admin_view';
    const POLL_MS = 4000;
    const COUNT_MS = 25000;

    let listTab = 'inbox';
    let activeChatId = null;
    let lastMessageId = 0;
    let chatPollActive = false;

    const escapeHtml = (value) => {
        return String(value == null ? '' : value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    };

    const saveView = (extra) => {
        if (typeof window.saveFormDraftView === 'function') {
            const state = { view: 'support', tab: listTab };
            if (extra && extra.chatId) {
                state.chatId = extra.chatId;
            }
            if (extra && extra.tab) {
                state.tab = extra.tab;
            }
            window.saveFormDraftView(ADMIN_VIEW_KEY, state);
        }
    };

    const stopPoll = () => {
        chatPollActive = false;
    };

    const formatDate = (iso) => {
        if (!iso) {
            return '—';
        }
        try {
            return new Date(iso).toLocaleString('uk-UA');
        } catch (e) {
            return '—';
        }
    };

    const updateBadge = async (api) => {
        try {
            const data = await api.apiFetch('/api/admin/support/chats/counts');
            const open = Number(data.open_count) || 0;
            const unread = Number(data.unread_count) || 0;
            const showNum = unread > 0 ? unread : open;

            if (window.SiteAlerts && typeof window.SiteAlerts.onCountIncrease === 'function') {
                window.SiteAlerts.onCountIncrease('adminSupport', unread, {
                    title: 'Підтримка FlowersGo',
                    body: 'Нове повідомлення від клієнта',
                    link: '/admin'
                });
            }

            let badge = supportBtn.querySelector('.admin-menu-badge');
            if (showNum > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'admin-menu-badge';
                    supportBtn.appendChild(badge);
                }
                badge.textContent = String(showNum);
                if (unread > 0) {
                    badge.classList.add('admin-menu-badge--unread');
                    supportBtn.title = 'Непрочитаних: ' + unread;
                } else {
                    badge.classList.remove('admin-menu-badge--unread');
                    supportBtn.title = 'У черзі: ' + open;
                }
            } else if (badge) {
                badge.remove();
                supportBtn.title = 'Підтримка';
            }
        } catch (e) {
        }
    };

    const renderChatList = (chats, tab) => {
        if (!chats || chats.length === 0) {
            const emptyText = tab === 'archive' ? 'Архів порожній.' : 'Чатів немає.';
            return '<p class="admin-panel-placeholder">' + emptyText + '</p>';
        }

        if (tab === 'archive') {
            return (
                '<div class="admin-table-wrap" data-list-pager data-list-pager-item="tbody tr">' +
                '<table class="admin-table admin-table--compact">' +
                '<thead><tr>' +
                '<th>№</th><th>Клієнт</th><th>Останнє</th><th>Закрито</th><th></th>' +
                '</tr></thead><tbody>' +
                chats.map((c) => {
                    return (
                        '<tr>' +
                        '<td>' + c.id + '</td>' +
                        '<td>' + escapeHtml(c.client_name) + '<br><small>' + escapeHtml(c.guest_email || c.guest_phone || '') + '</small></td>' +
                        '<td>' + escapeHtml((c.last_message || '').slice(0, 60)) + '</td>' +
                        '<td>' + formatDate(c.closed_at) + '</td>' +
                        '<td><button type="button" class="admin-secondary-btn" data-support-open="' + c.id + '">Переглянути</button></td>' +
                        '</tr>'
                    );
                }).join('') +
                '</tbody></table></div>'
            );
        }

        return (
            '<div class="admin-table-wrap" data-list-pager data-list-pager-item="tbody tr">' +
            '<table class="admin-table admin-table--compact">' +
            '<thead><tr>' +
            '<th>№</th><th>Клієнт</th><th>Останнє</th><th>Статус</th><th></th>' +
            '</tr></thead><tbody>' +
            chats.map((c) => {
                const statusLabel = c.status === 'open' ? 'В черзі' : (c.status === 'assigned' ? 'В роботі' : 'Закрито');
                const unread = Number(c.unread_count) || 0;
                const unreadHtml = unread > 0
                    ? ' <span class="admin-support-unread" title="Непрочитані">' + unread + '</span>'
                    : '';
                let action = '';
                if (tab === 'inbox' && c.status === 'open') {
                    action = '<button type="button" class="admin-edit-btn" data-support-claim="' + c.id + '">Взяти</button>';
                } else {
                    action = '<button type="button" class="admin-secondary-btn" data-support-open="' + c.id + '">Відкрити</button>';
                }
                return (
                    '<tr>' +
                    '<td>' + c.id + '</td>' +
                    '<td>' + escapeHtml(c.client_name) + '<br><small>' + escapeHtml(c.guest_email || c.guest_phone || '') + '</small></td>' +
                    '<td>' + escapeHtml((c.last_message || '').slice(0, 60)) + '</td>' +
                    '<td>' + statusLabel + unreadHtml + '</td>' +
                    '<td>' + action + '</td>' +
                    '</tr>'
                );
            }).join('') +
            '</tbody></table></div>'
        );
    };

    const renderMessages = (messages) => {
        if (!messages || messages.length === 0) {
            return '<p class="admin-panel-placeholder">Повідомлень немає.</p>';
        }
        return messages.map((m) => {
            let cls = 'admin-support-msg--client';
            if (m.sender_type === 'admin') {
                cls = 'admin-support-msg--admin';
            } else if (m.sender_type === 'system') {
                cls = 'admin-support-msg--system';
            }
            const meta = m.sender_label ? '<span class="admin-support-msg__who">' + escapeHtml(m.sender_label) + '</span>' : '';
            return (
                '<div class="admin-support-msg ' + cls + '">' +
                meta +
                escapeHtml(m.body) +
                '<span class="admin-support-msg__time">' + formatDate(m.createdAt) + '</span>' +
                '</div>'
            );
        }).join('');
    };

    const bindListActions = (api) => {
        content.querySelectorAll('[data-support-claim]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = Number(btn.getAttribute('data-support-claim'));
                try {
                    await openChat(api, id, true);
                    api.showMessage('Чат взято в роботу');
                } catch (err) {
                    api.showMessage(err.message, true);
                    await loadSupportList(api);
                }
            });
        });

        content.querySelectorAll('[data-support-open]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-support-open'));
                openChat(api, id, false).catch((err) => {
                    api.showMessage(err.message, true);
                });
            });
        });
    };

    const loadSupportList = async (api) => {
        stopPoll();
        activeChatId = null;
        lastMessageId = 0;
        saveView();

        const url = listTab === 'mine'
            ? '/api/admin/support/chats/mine'
            : (listTab === 'archive'
                ? '/api/admin/support/chats/archive'
                : '/api/admin/support/chats/inbox');

        const data = await api.apiFetch(url);
        const chats = Array.isArray(data.chats) ? data.chats : [];

        const tabArchiveClass = listTab === 'archive' ? ' admin-support-tab--active' : '';
        const tabInboxClass = listTab === 'inbox' ? ' admin-support-tab--active' : '';
        const tabMineClass = listTab === 'mine' ? ' admin-support-tab--active' : '';

        content.innerHTML =
            '<div class="admin-support-head">' +
            '<div class="admin-support-tabs">' +
            '<button type="button" class="admin-support-tab' + tabInboxClass + '" data-support-tab="inbox">Черга</button>' +
            '<button type="button" class="admin-support-tab' + tabMineClass + '" data-support-tab="mine">Мої чати</button>' +
            '<button type="button" class="admin-support-tab' + tabArchiveClass + '" data-support-tab="archive">Архів</button>' +
            '</div>' +
            '<button type="button" class="admin-secondary-btn" id="support-refresh-list">Оновити</button>' +
            '</div>' +
            renderChatList(chats, listTab);

        content.querySelectorAll('[data-support-tab]').forEach((tabBtn) => {
            tabBtn.addEventListener('click', () => {
                listTab = tabBtn.getAttribute('data-support-tab');
                loadSupportList(api).catch((err) => api.showMessage(err.message, true));
            });
        });

        const refreshBtn = document.getElementById('support-refresh-list');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadSupportList(api).catch((err) => api.showMessage(err.message, true));
            });
        }

        bindListActions(api);
        updateBadge(api);

        const pagerRoot = content.querySelector('[data-list-pager]');
        if (pagerRoot && window.ListPager) {
            window.ListPager.mount(pagerRoot);
        }
    };

    const renderChatDetail = (api, chat, messages, canReply) => {
        const statusText = chat.status === 'open'
            ? 'В черзі — візьміть чат, щоб відповідати'
            : (chat.status === 'assigned' ? 'В роботі' : 'Архів — лише перегляд');

        content.innerHTML =
            '<div class="admin-support-chat-head">' +
            '<button type="button" class="admin-secondary-btn" id="support-back-list">← До списку</button>' +
            '<div class="admin-support-chat-info">' +
            '<strong>Чат №' + chat.id + '</strong> — ' + escapeHtml(chat.client_name) +
            '<br><small>' + escapeHtml(chat.guest_email || '') + ' ' + escapeHtml(chat.guest_phone || '') + '</small>' +
            '<br><small>Статус: ' + statusText + '</small>' +
            (chat.status === 'closed' && chat.closed_at
                ? '<br><small>Закрито: ' + formatDate(chat.closed_at) + '</small>'
                : '') +
            '</div>' +
            (chat.status === 'open'
                ? '<button type="button" class="admin-primary-btn" id="support-claim-here">Взяти чат</button>'
                : '') +
            (chat.status === 'assigned' && canReply
                ? '<button type="button" class="admin-secondary-btn" id="support-close-chat">Закрити чат</button>'
                : '') +
            '</div>' +
            '<div class="admin-support-messages" id="admin-support-messages">' + renderMessages(messages) + '</div>' +
            (canReply && chat.status === 'assigned'
                ? (
                    '<form class="admin-support-compose" id="admin-support-send">' +
                    '<input type="text" id="admin-support-input" maxlength="2000" placeholder="Відповідь клієнту" autocomplete="off">' +
                    '<button type="submit" class="admin-primary-btn">Надіслати</button>' +
                    '</form>'
                )
                : '');

        const msgBox = document.getElementById('admin-support-messages');
        if (msgBox) {
            msgBox.scrollTop = msgBox.scrollHeight;
        }

        document.getElementById('support-back-list').addEventListener('click', () => {
            loadSupportList(api).catch((err) => api.showMessage(err.message, true));
        });

        const claimBtn = document.getElementById('support-claim-here');
        if (claimBtn) {
            claimBtn.addEventListener('click', async () => {
                try {
                    await openChat(api, chat.id, true);
                    api.showMessage('Чат взято в роботу');
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        const closeBtn = document.getElementById('support-close-chat');
        if (closeBtn) {
            closeBtn.addEventListener('click', async () => {
                if (!window.confirm('Закрити чат з клієнтом?')) {
                    return;
                }
                try {
                    await api.apiFetch('/api/admin/support/chats/' + chat.id + '/close', { method: 'POST' });
                    api.showMessage('Чат закрито');
                    await openChat(api, chat.id, false);
                    updateBadge(api);
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }

        const form = document.getElementById('admin-support-send');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('admin-support-input');
                const text = input && input.value ? input.value.trim() : '';
                if (!text || !activeChatId) {
                    return;
                }
                try {
                    const res = await api.apiFetch('/api/admin/support/chats/' + activeChatId + '/message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text })
                    });
                    if (res.message) {
                        if (res.message.id > lastMessageId) {
                            lastMessageId = res.message.id;
                        }
                        const box = document.getElementById('admin-support-messages');
                        if (box) {
                            box.insertAdjacentHTML('beforeend', renderMessages([res.message]));
                            box.scrollTop = box.scrollHeight;
                        }
                    }
                    input.value = '';
                } catch (err) {
                    api.showMessage(err.message, true);
                }
            });
        }
    };

    const pollChat = async (api) => {
        if (!activeChatId) {
            return;
        }
        try {
            const url = '/api/admin/support/chats/' + activeChatId + '/poll?since_id=' + lastMessageId;
            const data = await api.apiFetch(url);
            const incoming = Array.isArray(data.messages) ? data.messages : [];
            if (incoming.length > 0) {
                incoming.forEach((m) => {
                    if (m.id > lastMessageId) {
                        lastMessageId = m.id;
                    }
                });
                const box = document.getElementById('admin-support-messages');
                if (box) {
                    box.insertAdjacentHTML('beforeend', renderMessages(incoming));
                    box.scrollTop = box.scrollHeight;
                }
                try {
                    await api.apiFetch('/api/admin/support/chats/' + activeChatId + '/read', { method: 'POST' });
                    updateBadge(api);
                } catch (e) {
                }
            }
            if (data.chat && data.chat.status === 'closed') {
                stopPoll();
                const detail = await api.apiFetch('/api/admin/support/chats/' + activeChatId);
                renderChatDetail(api, detail.chat, detail.messages, false);
            }
        } catch (e) {
        }
    };

    const startPoll = (api) => {
        chatPollActive = true;
        pollChat(api);
    };

    const refreshAdminSupport = async (api) => {
        await updateBadge(api);
        if (chatPollActive && activeChatId) {
            await pollChat(api);
        }
    };

    const openChat = async (api, chatId, doClaim) => {
        const id = Number(chatId);
        if (!Number.isFinite(id) || id <= 0) {
            throw new Error('Невірний чат');
        }

        let data;
        if (doClaim) {
            data = await api.apiFetch('/api/admin/support/chats/' + id + '/claim', { method: 'POST' });
        } else {
            data = await api.apiFetch('/api/admin/support/chats/' + id);
        }

        try {
            await api.apiFetch('/api/admin/support/chats/' + id + '/read', { method: 'POST' });
        } catch (e) {
        }

        activeChatId = id;
        lastMessageId = 0;
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        msgs.forEach((m) => {
            if (m.id > lastMessageId) {
                lastMessageId = m.id;
            }
        });

        const chat = data.chat;
        const canReply = chat.status === 'assigned';
        saveView({ chatId: id, tab: listTab });
        renderChatDetail(api, chat, msgs, canReply);
        if (chat.status === 'closed') {
            stopPoll();
        } else {
            startPoll(api);
        }
        updateBadge(api);
    };

    const loadSupport = async (api, openChatId, tab) => {
        api.setActiveMenu('support');
        if (tab === 'archive' || tab === 'mine' || tab === 'inbox') {
            listTab = tab;
        }
        if (openChatId) {
            try {
                await openChat(api, openChatId, false);
                return;
            } catch (e) {
            }
        }
        await loadSupportList(api);
    };

    const startCounts = (api) => {
        updateBadge(api);
        if (window.SiteNotifyAuto && typeof window.SiteNotifyAuto.register === 'function') {
            window.SiteNotifyAuto.register('admin-support', () => refreshAdminSupport(api));
        } else {
            setInterval(() => refreshAdminSupport(api), 10000);
        }
    };

    function hookApi() {
        const api = window.adminPanelApi;
        if (!api || !api.apiFetch) {
            setTimeout(hookApi, 50);
            return;
        }

        api.loadSupportPanel = (chatId) => loadSupport(api, chatId);
        api.restoreSupportView = async () => {
            if (typeof window.loadFormDraftView !== 'function') {
                return false;
            }
            const state = window.loadFormDraftView(ADMIN_VIEW_KEY);
            if (!state || state.view !== 'support') {
                return false;
            }
            try {
                await loadSupport(api, state.chatId || null, state.tab || null);
                return true;
            } catch (err) {
                return false;
            }
        };

        supportBtn.addEventListener('click', () => {
            api.showMessage('');
            loadSupport(api, null).catch((err) => api.showMessage(err.message, true));
        });

        startCounts(api);
        if (window.SiteAlerts && typeof window.SiteAlerts.setInitialCount === 'function') {
            api.apiFetch('/api/admin/support/chats/counts').then((data) => {
                window.SiteAlerts.setInitialCount('adminSupport', Number(data.unread_count) || 0);
            }).catch(() => {});
        }
    }

    window.adminPanelSupport = {
        loadSupport: (api, chatId) => loadSupport(api, chatId)
    };

    hookApi();
})();
