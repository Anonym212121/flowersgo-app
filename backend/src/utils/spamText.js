const BadWordsNext = require('bad-words-next');
const ua = require('bad-words-next/lib/ua');
const ru = require('bad-words-next/lib/ru');
const en = require('bad-words-next/lib/en');
const ruLat = require('bad-words-next/lib/ru_lat');

const profanity = new BadWordsNext({
    exclusions: ['херсон', 'херсоні', 'херсонська', 'піон', 'піони', 'хустка', 'хустки']
});
profanity.add(ua);
profanity.add(ru);
profanity.add(en);
profanity.add(ruLat);
profanity.add({
    id: 'lat_extra',
    words: ['blyat*', 'blya*', 'suka', 'pidar*', 'pidor*', 'nahui', 'nahuy'],
    lookalike: {}
});

const looksLikeSpam = (raw) => {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) {
        return false;
    }

    const links = text.match(/https?:\/\/|www\.|t\.me\/|telegram\.me\//gi);
    if (links && links.length >= 2) {
        return true;
    }

    if (/(.)\1{14,}/.test(text)) {
        return true;
    }

    if (/(viagra|casino|crypto\s*wallet|free\s*bitcoin|bit\.ly\/|tinyurl\.com|onlyfans|porn)/i.test(text)) {
        return true;
    }

    return false;
};

const looksLikeAttack = (raw) => {
    const text = typeof raw === 'string' ? raw : '';
    if (!text) {
        return false;
    }

    if (/javascript\s*:/i.test(text)) {
        return true;
    }
    if (/vbscript\s*:/i.test(text)) {
        return true;
    }
    if (/data\s*:\s*text\/html/i.test(text)) {
        return true;
    }
    if (/on(error|load|click|mouseover|focus|submit)\s*=/i.test(text)) {
        return true;
    }
    if (/<\s*(script|iframe|object|embed|svg|link|meta|form)\b/i.test(text)) {
        return true;
    }
    if (/(union\s+select|drop\s+table|insert\s+into|or\s+1\s*=\s*1|sleep\s*\(\s*\d+)/i.test(text)) {
        return true;
    }
    if (/<%[\s=]|\$\{[^}]+\}/.test(text)) {
        return true;
    }
    if (/\bdocument\.cookie\b|\beval\s*\(|\blocalStorage\b/i.test(text)) {
        return true;
    }

    return false;
};

const hasProfanity = (raw) => {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) {
        return false;
    }
    try {
        return profanity.check(text);
    } catch (err) {
        return false;
    }
};

module.exports = {
    looksLikeSpam,
    looksLikeAttack,
    hasProfanity
};
