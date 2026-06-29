const sanitizeLegalHtml = (raw) => {
    let html = typeof raw === 'string' ? raw : '';

    if (html.length > 80000) {
        html = html.slice(0, 80000);
    }

    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
    html = html.replace(/<object[\s\S]*?<\/object>/gi, '');
    html = html.replace(/<embed[\s\S]*?>/gi, '');
    html = html.replace(/<form[\s\S]*?<\/form>/gi, '');
    html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    html = html.replace(/javascript:/gi, '');

    return html.trim();
};

module.exports = sanitizeLegalHtml;
