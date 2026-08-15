const jwt = require('jsonwebtoken');
const { WebSocketServer, WebSocket } = require('ws');

const clients = new Map();
let wss = null;
let pingTimer = null;

const parseCookies = (cookieHeader) => {
    const result = {};
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return result;
    }
    const parts = cookieHeader.split(';');
    for (let i = 0; i < parts.length; i++) {
        const trimmed = parts[i].trim();
        const idx = trimmed.indexOf('=');
        if (idx === -1) {
            continue;
        }
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!key) {
            continue;
        }
        try {
            result[key] = decodeURIComponent(value);
        } catch {
            result[key] = value;
        }
    }
    return result;
};

const userFromUpgrade = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    try {
        const token = cookies.token;
        if (token && process.env.JWT_SECRET) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const rawId = decoded.user_id != null ? decoded.user_id : decoded.id;
            const userId = Number(rawId);
            if (Number.isFinite(userId) && userId > 0) {
                const guest = cookies.support_guest_token;
                return {
                    user_id: userId,
                    role_name: decoded.role_name || '',
                    guest_token: guest && guest.length >= 8 ? guest : null
                };
            }
        }
    } catch {
    }

    const guest = cookies.support_guest_token;
    if (guest && typeof guest === 'string' && guest.length >= 8) {
        return {
            user_id: null,
            role_name: 'guest',
            guest_token: guest
        };
    }
    return null;
};

const sendRaw = (ws, payload) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
    }
    try {
        ws.send(JSON.stringify(payload));
    } catch (err) {
    }
};

const sendToUser = (userId, payload) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0 || !payload) {
        return 0;
    }
    let sent = 0;
    for (const [socket, info] of clients) {
        if (info.user_id === uid) {
            sendRaw(socket, payload);
            sent += 1;
        }
    }
    return sent;
};

const sendToGuest = (guestToken, payload) => {
    const token = typeof guestToken === 'string' ? guestToken : '';
    if (!token || !payload) {
        return 0;
    }
    let sent = 0;
    for (const [socket, info] of clients) {
        if (info.guest_token && info.guest_token === token) {
            sendRaw(socket, payload);
            sent += 1;
        }
    }
    return sent;
};

const sendToRole = (roleName, payload) => {
    const role = typeof roleName === 'string' ? roleName : '';
    if (!role || !payload) {
        return 0;
    }
    let sent = 0;
    for (const [socket, info] of clients) {
        if (info.role_name === role) {
            sendRaw(socket, payload);
            sent += 1;
        }
    }
    return sent;
};

const pushSupportChat = (payload) => {
    const data = payload || {};
    const msg = {
        type: 'support_chat',
        event: data.event || 'message',
        chat_id: data.chat_id || null,
        chat: data.chat || null,
        message: data.message || null
    };
    const uid = Number(data.user_id);
    const adminId = Number(data.admin_id);
    const guest = typeof data.guest_token === 'string' ? data.guest_token : '';
    let sent = 0;
    const seen = new Set();

    for (const [socket, info] of clients) {
        let match = false;
        if (Number.isFinite(uid) && uid > 0 && info.user_id === uid) {
            match = true;
        }
        if (guest && info.guest_token === guest) {
            match = true;
        }
        if (Number.isFinite(adminId) && adminId > 0 && info.user_id === adminId) {
            match = true;
        }
        if (data.to_admins && info.role_name === 'admin') {
            match = true;
        }
        if (!match || seen.has(socket)) {
            continue;
        }
        seen.add(socket);
        sendRaw(socket, msg);
        sent += 1;
    }
    return sent;
};

const pushNotification = (userId, payload) => {
    const data = payload || {};
    return sendToUser(userId, {
        type: 'notification',
        title: data.title || 'Сповіщення',
        body: data.body || '',
        link_url: data.link_url || '',
        ntype: data.ntype || '',
        order_id: data.order_id || null
    });
};

const pushCourierOrder = (userId, payload) => {
    const data = payload || {};
    return sendToUser(userId, {
        type: 'courier_order',
        event: data.event || 'update',
        order_id: data.order_id || null,
        title: data.title || 'Оновлення замовлення',
        body: data.body || '',
        link_url: data.link_url || '/courier/orders'
    });
};

const attach = (httpServer) => {
    if (!httpServer || wss) {
        return wss;
    }

    wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    wss.on('connection', (ws, req) => {
        const user = userFromUpgrade(req);
        if (!user) {
            ws.close(4001, 'auth');
            return;
        }

        let sameConn = 0;
        for (const info of clients.values()) {
            if (user.user_id && info.user_id === user.user_id) {
                sameConn += 1;
            } else if (user.guest_token && info.guest_token === user.guest_token) {
                sameConn += 1;
            }
        }
        if (sameConn >= 8) {
            ws.close(4002, 'limit');
            return;
        }

        ws.isAlive = true;
        clients.set(ws, user);
        sendRaw(ws, { type: 'hello' });

        ws.on('pong', () => {
            ws.isAlive = true;
        });
        ws.on('close', () => {
            clients.delete(ws);
        });
        ws.on('error', () => {
            clients.delete(ws);
        });
    });

    pingTimer = setInterval(() => {
        if (!wss) {
            return;
        }
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                clients.delete(ws);
                ws.terminate();
                return;
            }
            ws.isAlive = false;
            try {
                ws.ping();
            } catch (err) {
            }
        });
    }, 30000);

    if (pingTimer.unref) {
        pingTimer.unref();
    }

    return wss;
};

module.exports = {
    attach,
    sendToUser,
    sendToGuest,
    sendToRole,
    pushNotification,
    pushCourierOrder,
    pushSupportChat
};
