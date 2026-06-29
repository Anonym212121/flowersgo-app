const getClientId = () => {
    const raw = process.env.GOOGLE_CLIENT_ID;
    return typeof raw === 'string' ? raw.trim() : '';
};

const verifyCredential = async (credential) => {
    const token = typeof credential === 'string' ? credential.trim() : '';
    const clientId = getClientId();
    if (!token || !clientId) {
        return null;
    }

    const url =
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);
    const res = await fetch(url);
    if (!res.ok) {
        return null;
    }

    let data = null;
    try {
        data = await res.json();
    } catch (err) {
        return null;
    }

    if (!data || !data.sub || !data.email) {
        return null;
    }

    if (String(data.aud) !== clientId) {
        return null;
    }

    const emailVerified = data.email_verified;
    if (emailVerified !== true && emailVerified !== 'true') {
        return null;
    }

    const first_name =
        typeof data.given_name === 'string' && data.given_name.trim()
            ? data.given_name.trim().slice(0, 60)
            : 'Користувач';
    const last_name =
        typeof data.family_name === 'string' && data.family_name.trim()
            ? data.family_name.trim().slice(0, 60)
            : 'Google';

    let avatar_url = null;
    if (typeof data.picture === 'string' && data.picture.trim()) {
        avatar_url = data.picture.trim().slice(0, 255);
    }

    return {
        google_id: String(data.sub),
        email: String(data.email).trim().toLowerCase().slice(0, 120),
        first_name,
        last_name,
        avatar_url
    };
};

module.exports = {
    getClientId,
    verifyCredential
};
