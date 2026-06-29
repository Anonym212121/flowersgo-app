const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

const parseBool = (value) => {
    if (value === undefined || value === null) return false;
    const v = String(value).trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
};

const buildSslConfig = () => {
    if (!parseBool(process.env.DB_SSL)) return undefined;

    const rejectUnauthorized = !parseBool(process.env.DB_SSL_INSECURE);
    const caPath = process.env.DB_SSL_CA_PATH;

    if (caPath) {
        try {
            const ca = fs.readFileSync(caPath, 'utf8');
            return { rejectUnauthorized, ca };
        } catch (err) {
            console.error('DB SSL ERROR');
            console.error(`Reason: Не вдалося прочитати сертифікат з "${caPath}"`);
            return { rejectUnauthorized: false };
        }
    }

    return { rejectUnauthorized };
};

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'flowershop',
    port: Number(process.env.DB_PORT) || 3306,
    ssl: buildSslConfig(),
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0
});
const checkSystemHealth = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('DATABASE REPORT');
        console.log(`STATUS: Connected to "${process.env.DB_NAME}"`);
        connection.release();
    } catch (err) {
        console.error('DB CONNECTION ERROR');
        console.error(`Reason: ${err.message}`);
    }
};

if (process.env.NODE_ENV !== 'test') {
    checkSystemHealth();
}

module.exports = pool;