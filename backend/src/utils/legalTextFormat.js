const escapeHtml = (value) => {
    return String(value == null ? '' : value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
};

const inlineFormat = (text) => {
    const chunks = [];
    let out = String(text == null ? '' : text);

    out = out.replace(/\*\*(.+?)\*\*/g, (m, inner) => {
        const key = '@@B' + chunks.length + '@@';
        chunks.push('<strong>' + escapeHtml(inner) + '</strong>');
        return key;
    });

    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => {
        const safeUrl = String(url).trim();
        const key = '@@L' + chunks.length + '@@';
        if (
            !/^https?:\/\//i.test(safeUrl) &&
            !safeUrl.startsWith('/') &&
            !safeUrl.startsWith('mailto:') &&
            !safeUrl.startsWith('tel:')
        ) {
            chunks.push(escapeHtml(label));
        } else {
            chunks.push('<a href="' + escapeHtml(safeUrl) + '">' + escapeHtml(label) + '</a>');
        }
        return key;
    });

    out = escapeHtml(out);
    for (let i = 0; i < chunks.length; i++) {
        out = out.replace('@@B' + i + '@@', chunks[i]);
        out = out.replace('@@L' + i + '@@', chunks[i]);
    }

    return out;
};

const textToHtml = (raw) => {
    const source = typeof raw === 'string' ? raw : '';
    const lines = source.split(/\r?\n/);
    let html = '';
    let inSection = false;
    let paragraph = [];
    let listType = null;
    let listItems = [];

    const flushList = () => {
        if (!listItems.length) {
            return;
        }
        const cls = listType === 'ol' ? 'info-page__list info-page__list--ordered' : 'info-page__list';
        const tag = listType === 'ol' ? 'ol' : 'ul';
        html += '<' + tag + ' class="' + cls + '">';
        for (let i = 0; i < listItems.length; i++) {
            html += '<li>' + inlineFormat(listItems[i]) + '</li>';
        }
        html += '</' + tag + '>';
        listItems = [];
        listType = null;
    };

    const flushParagraph = () => {
        if (!paragraph.length) {
            return;
        }
        const text = paragraph.join(' ').trim();
        if (text) {
            const cls = text.indexOf('info-page__note') === 0 ? ' class="info-page__note"' : '';
            if (cls) {
                html += '<p class="info-page__note">' + inlineFormat(text.replace('info-page__note:', '').trim()) + '</p>';
            } else {
                html += '<p>' + inlineFormat(text) + '</p>';
            }
        }
        paragraph = [];
    };

    const closeSection = () => {
        flushList();
        flushParagraph();
        if (inSection) {
            html += '</section>';
        }
        inSection = false;
    };

    const openSection = (title) => {
        closeSection();
        html += '<section class="info-page__section"><h2>' + escapeHtml(title) + '</h2>';
        inSection = true;
    };

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (trimmed.indexOf('## ') === 0) {
            openSection(trimmed.slice(3).trim());
            continue;
        }

        if (
            trimmed === '[тарифи доставки]' ||
            trimmed === '<!--DELIVERY_TARIFFS-->'
        ) {
            flushList();
            flushParagraph();
            html += '<!--DELIVERY_TARIFFS-->';
            continue;
        }

        if (trimmed === '') {
            flushList();
            flushParagraph();
            continue;
        }

        if (trimmed.indexOf('- ') === 0) {
            flushParagraph();
            if (listType !== 'ul') {
                flushList();
                listType = 'ul';
            }
            listItems.push(trimmed.slice(2));
            continue;
        }

        if (/^\d+\.\s/.test(trimmed)) {
            flushParagraph();
            if (listType !== 'ol') {
                flushList();
                listType = 'ol';
            }
            listItems.push(trimmed.replace(/^\d+\.\s/, ''));
            continue;
        }

        if (trimmed.indexOf('Примітка:') === 0) {
            flushList();
            flushParagraph();
            paragraph.push('info-page__note:' + trimmed.slice(9).trim());
            flushParagraph();
            continue;
        }

        flushList();
        paragraph.push(trimmed);
    }

    flushList();
    flushParagraph();
    closeSection();

    return html.trim();
};

const htmlToText = (html) => {
    let src = typeof html === 'string' ? html : '';
    if (!src.trim()) {
        return '';
    }

    src = src.replace(/<!--DELIVERY_TARIFFS-->/g, '\n[тарифи доставки]\n');
    src = src.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n');
    src = src.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
    src = src.replace(/<p[^>]*class="info-page__note"[^>]*>([\s\S]*?)<\/p>/gi, '\nПримітка: $1\n');
    src = src.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
    src = src.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
    src = src.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
    src = src.replace(/<br\s*\/?>/gi, '\n');
    src = src.replace(/<[^>]+>/g, '');
    src = src.replace(/&nbsp;/g, ' ');
    src = src.replace(/&amp;/g, '&');
    src = src.replace(/&lt;/g, '<');
    src = src.replace(/&gt;/g, '>');
    src = src.replace(/&quot;/g, '"');
    src = src.replace(/\n{3,}/g, '\n\n');
    return src.trim();
};

module.exports = {
    textToHtml,
    htmlToText
};
