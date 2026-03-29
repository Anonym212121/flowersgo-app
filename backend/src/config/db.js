const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0
});
const checkSystemHealth = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('DATABASE REPORT');
        console.log(`STATUS: Connected to "${process.env.DB_NAME}"`);
        console.log('--------------------------');
        connection.release();
    } catch (err) {
        console.error('DB CONNECTION ERROR');
        console.error(`Reason: ${err.message}`);
    }
};

checkSystemHealth();
module.exports = pool;