const looksLikeSpam = (raw) => {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) {
        return false;
    }

    const links = text.match(/https?:\/\/|www\./gi);
    if (links && links.length >= 2) {
        return true;
    }

    if (/(.)\1{14,}/.test(text)) {
        return true;
    }

    if (/(viagra|casino|crypto\s*wallet|free\s*bitcoin|bit\.ly\/|tinyurl\.com)/i.test(text)) {
        return true;
    }

    return false;
};

module.exports = {
    looksLikeSpam
};
