const { Pool } = require('pg');
const winston = require('winston');
require('dotenv').config();

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'db-service' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    max: process.env.DB_MAX_CLIENTS || 20,
    idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT || 30000,
    connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT || 2000,
});

pool.on('error', (err, client) => {
    logger.error('Error inesperado en cliente inactivo', { error: err });
    process.exit(-1);
});

const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.info('Consulta ejecutada', { query: text, duration, rows: res.rowCount });
        return res;
    } catch (err) {
        logger.error('Error en consulta', { query: text, error: err });
        throw err;
    }
};

const getClient = async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;

    const timeout = setTimeout(() => {
        logger.error('Un cliente ha sido devuelto al pool después de estar mucho tiempo inactivo.');
        console.error('Un cliente ha sido devuelto al pool después de estar mucho tiempo inactivo.');
    }, 5000);

    client.query = (...args) => {
        client.lastQuery = args[0];
        return query.apply(client, args);
    };
    client.release = () => {
        clearTimeout(timeout);
        client.query = query;
        client.release = release;
        return release.apply(client);
    };

    try {
        await client.query('BEGIN');
        return client;
    } catch (err) {
        client.release();
        throw err;
    }
};

const closePool = async () => {
    try {
        await pool.end();
        logger.info('Conexión a la base de datos cerrada.');
    } catch (err) {
        logger.error('Error cerrando la conexión a la base de datos:', { error: err });
    }
};

module.exports = {
    query,
    getClient,
    closePool
};