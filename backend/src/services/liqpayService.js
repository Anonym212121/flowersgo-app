const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const getKeys = () => {
    return {
        publicKey: process.env.LIQPAY_PUBLIC_KEY || '',
        privateKey: process.env.LIQPAY_PRIVATE_KEY || ''
    };
};

const isSandbox = () => {
    const value = String(process.env.LIQPAY_SANDBOX || '1').trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'yes';
};

const encodeData = (params) => {
    const json = JSON.stringify(params);
    return Buffer.from(json, 'utf8').toString('base64');
};

const makeSignature = (data) => {
    const { privateKey } = getKeys();
    const raw = privateKey + data + privateKey;
    return crypto.createHash('sha1').update(raw).digest('base64');
};

const makeLiqpayOrderRef = (orderId) => {
    const id = Number(orderId);
    if (!Number.isFinite(id) || id <= 0) {
        return String(orderId);
    }
    return id + '-' + Date.now();
};

const parseOrderIdFromLiqpay = (raw) => {
    const text = String(raw == null ? '' : raw).trim();
    if (!text) {
        return null;
    }

    const direct = Number(text);
    if (Number.isFinite(direct) && direct > 0) {
        return direct;
    }

    const match = text.match(/^(\d+)/);
    if (!match) {
        return null;
    }

    const id = Number(match[1]);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    return id;
};

const buildCheckoutForm = ({ orderId, amount, description, resultUrl, serverUrl, orderRef }) => {
    const { publicKey } = getKeys();

    let ref = typeof orderRef === 'string' ? orderRef.trim() : '';
    if (!ref) {
        ref = makeLiqpayOrderRef(orderId);
    }

    const params = {
        public_key: publicKey,
        version: '3',
        action: 'pay',
        amount: Number(amount).toFixed(2),
        currency: 'UAH',
        description: description,
        order_id: ref,
        result_url: resultUrl
    };

    const callbackUrl = typeof serverUrl === 'string' ? serverUrl.trim() : '';
    const isLocalCallback = /localhost|127\.0\.0\.1/i.test(callbackUrl);
    if (callbackUrl && !isLocalCallback) {
        params.server_url = callbackUrl;
    }

    if (isSandbox()) {
        params.sandbox = '1';
    }

    const data = encodeData(params);
    const signature = makeSignature(data);

    return { data, signature, orderRef: ref };
};

const fetchPaymentStatus = (orderRef) => {
    return liqpayRequest({ action: 'status', order_id: orderRef });
};

const liqpayRequest = (params) => {
    return new Promise((resolve, reject) => {
        const { publicKey } = getKeys();
        const payload = {
            public_key: publicKey,
            version: '3',
            ...params
        };

        const data = encodeData(payload);
        const signature = makeSignature(data);
        const body = querystring.stringify({ data, signature });

        const req = https.request(
            {
                hostname: 'www.liqpay.ua',
                path: '/api/request',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            },
            (res) => {
                let chunks = '';
                res.on('data', (chunk) => {
                    chunks += chunk;
                });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(chunks);
                        resolve(json);
                    } catch (err) {
                        resolve(null);
                    }
                });
            }
        );

        req.on('error', reject);
        req.write(body);
        req.end();
    });
};

const refundPayment = (orderRef, amount) => {
    const ref = typeof orderRef === 'string' ? orderRef.trim() : '';
    const sum = Number(amount);
    if (!ref || !Number.isFinite(sum) || sum <= 0) {
        return Promise.resolve(null);
    }

    return liqpayRequest({
        action: 'refund',
        order_id: ref,
        amount: sum.toFixed(2),
        currency: 'UAH'
    });
};

const verifySignature = (data, signature) => {
    if (!data || !signature) {
        return false;
    }
    return makeSignature(data) === signature;
};

const parseData = (data) => {
    try {
        const json = Buffer.from(String(data), 'base64').toString('utf8');
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
};

const requestCheckoutUrl = (form) => {
    return new Promise((resolve, reject) => {
        const body = querystring.stringify({
            data: form.data,
            signature: form.signature
        });

        const req = https.request(
            {
                hostname: 'www.liqpay.ua',
                path: '/api/3/checkout',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            },
            (res) => {
                const location = res.headers.location;
                if ((res.statusCode === 302 || res.statusCode === 303) && location) {
                    resolve(location);
                    res.resume();
                    return;
                }

                let chunks = '';
                res.on('data', (chunk) => {
                    chunks += chunk;
                });
                res.on('end', () => {
                    reject(new Error('LiqPay checkout: ' + res.statusCode));
                });
            }
        );

        req.on('error', reject);
        req.write(body);
        req.end();
    });
};

module.exports = {
    getKeys,
    isSandbox,
    makeLiqpayOrderRef,
    parseOrderIdFromLiqpay,
    buildCheckoutForm,
    fetchPaymentStatus,
    refundPayment,
    requestCheckoutUrl,
    verifySignature,
    parseData
};
