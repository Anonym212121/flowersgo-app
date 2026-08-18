const FALLBACK_USD_UAH = 41.5;
const CACHE_MS = 60 * 60 * 1000;

let cachedRate = FALLBACK_USD_UAH;
let cachedAt = 0;
let loading = null;

const parseRate = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }
    const n = Number(data[0].rate);
    if (!Number.isFinite(n) || n <= 0) {
        return null;
    }
    return n;
};

const fetchNbuRate = async () => {
    const url = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json';
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
        throw new Error('NBU HTTP ' + res.status);
    }
    const data = await res.json();
    const rate = parseRate(data);
    if (!rate) {
        throw new Error('NBU rate empty');
    }
    return rate;
};

const getUsdUahRate = async () => {
    const now = Date.now();
    if (cachedAt > 0 && now - cachedAt < CACHE_MS) {
        return cachedRate;
    }
    if (loading) {
        try {
            return await loading;
        } catch (err) {
            return cachedRate;
        }
    }
    loading = fetchNbuRate()
        .then((rate) => {
            cachedRate = rate;
            cachedAt = Date.now();
            loading = null;
            return rate;
        })
        .catch((err) => {
            console.error('fxService NBU:', err.message);
            loading = null;
            cachedAt = Date.now();
            return cachedRate;
        });
    return loading;
};

module.exports = {
    getUsdUahRate,
    FALLBACK_USD_UAH
};
