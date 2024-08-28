const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { expressjwt: jwt } = require('express-jwt');
const db = require('./config/db'); // Asegúrate de importar el db.js
require('dotenv').config();

const camionesRoutes = require('./routes/camiones');
const conductoresRoutes = require('./routes/conductores');
// Importar más rutas según sea necesario

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
app.use(compression());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limita cada IP a 100 solicitudes por ventana
});
app.use(limiter);

// JWT middleware
app.use(jwt({ 
    secret: process.env.JWT_SECRET, 
    algorithms: ['HS256'] 
}).unless({ path: ['/api/login', '/api/health'] }));

// Rutas
app.use('/api/camiones', camionesRoutes);
app.use('/api/conductores', conductoresRoutes);
// Usar más rutas según sea necesario

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Manejo de rutas no encontradas (404)
app.use((req, res, next) => {
    res.status(404).send('Recurso no encontrado');
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (process.env.NODE_ENV === 'production') {
        res.status(500).send('Algo salió mal!');
    } else {
        res.status(500).send(`Error: ${err.message}`);
    }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Manejo graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recibido. Cerrando servidor HTTP...');
    server.close(async () => {
        console.log('Servidor HTTP cerrado.');
        try {
            await db.closePool(); // Cierra el pool de conexiones de la base de datos
            console.log('Conexión a la base de datos cerrada.');
        } catch (err) {
            console.error('Error cerrando la conexión a la base de datos:', err);
        }
        process.exit(0);
    });
});

module.exports = app;
