const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'forodisco'
};

// Pool de conexiones MySQL
const pool = mysql.createPool(dbConfig);

// Middleware para procesar JSON y datos de formulario
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de CORS
app.use(cors({
    origin: 'http://localhost:3002',
    credentials: true
}));

// Configuración de sesiones
app.use(session({
    secret: 'tu_secreto_aqui',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Servir archivos estáticos - IMPORTANTE: debe ir después de la configuración de sesión y CORS
app.use(express.static('public'));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// Middleware para verificar si el usuario es admin
const isAdmin = (req, res, next) => {
    console.log('Verificando admin:', {
        userId: req.session.userId,
        role: req.session.role,
        session: req.session
    });
    
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado - No eres administrador'
        });
    }
    next();
};

// Rutas de la API
app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            username: req.session.username,
            role: req.session.role
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

// Ruta específica para el panel de admin
app.get('/admin/venues', (req, res) => {
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public/admin/venues.html'));
});

// Ruta de registro
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validaciones básicas
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }

        const connection = await pool.getConnection();

        try {
            // Verificar si el usuario ya existe
            const [existingUsers] = await connection.query(
                'SELECT id FROM user_forums WHERE username = ? OR email = ?',
                [username, email]
            );

            if (existingUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de usuario o email ya está en uso'
                });
            }

            // Hash de la contraseña
            const hashedPassword = await bcrypt.hash(password, 10);

            // Por defecto, los nuevos usuarios tienen role_id = 3 (usuario normal)
            const [result] = await connection.query(
                'INSERT INTO user_forums (username, email, password, role_id) VALUES (?, ?, ?, 3)',
                [username, email, hashedPassword]
            );

            // Iniciar sesión automáticamente
            req.session.userId = result.insertId;
            req.session.username = username;
            req.session.role = 'usuario';

            res.status(201).json({
                success: true,
                message: 'Usuario registrado exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error en el registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar el usuario'
        });
    }
});

// Ruta de inicio de sesión
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos'
            });
        }

        const connection = await pool.getConnection();

        try {
            // Buscar usuario y su rol
            const [users] = await connection.query(
                'SELECT users.*, roles.name as role_name FROM users JOIN roles ON users.role_id = roles.id WHERE users.email = ?',
                [email]
            );

            console.log('Usuario encontrado:', users[0]); // Para debug

            if (users.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            const user = users[0];

            // Verificar contraseña
            const validPassword = await bcrypt.compare(password, user.password_hash);
            console.log('Contraseña válida:', validPassword); // Para debug

            if (!validPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Establecer sesión
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role_name;

            res.json({
                success: true,
                message: 'Inicio de sesión exitoso',
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role_name
                }
            });
        } catch (error) {
            console.error('Error en la consulta:', error);
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error completo en el inicio de sesión:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar sesión: ' + error.message
        });
    }
});

// Ruta para cerrar sesión
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error al cerrar sesión'
            });
        }
        res.json({
            success: true,
            message: 'Sesión cerrada correctamente'
        });
    });
});

// Ruta para obtener todas las discotecas
app.get('/api/clubs', async (req, res) => {
    try {
        const [clubs] = await pool.query('SELECT * FROM discotecas');
        res.json({
            success: true,
            clubs
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las discotecas'
        });
    }
});

// Ruta para registrar una nueva discoteca (solo admin)
app.post('/api/clubs', isAdmin, async (req, res) => {
    try {
        const { nombre, direccion, telefono, horario, descripcion } = req.body;

        // Validaciones básicas
        if (!nombre || !direccion || !telefono || !horario || !descripcion) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }

        // Insertar la discoteca en la base de datos
        const [result] = await pool.query(
            'INSERT INTO discotecas (nombre, direccion, telefono, horario, descripcion) VALUES (?, ?, ?, ?, ?)',
            [nombre, direccion, telefono, horario, descripcion]
        );

        res.json({
            success: true,
            message: 'Discoteca registrada correctamente',
            clubId: result.insertId
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar la discoteca'
        });
    }
});

// Ruta para crear usuario admin (temporal)
app.post('/api/create-admin', async (req, res) => {
    try {
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
            ['admin', 'admin@forodisco.com', hashedPassword, 1]
        );

        res.json({
            success: true,
            message: 'Admin creado correctamente',
            hashedPassword: hashedPassword
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear admin: ' + error.message
        });
    }
});

// Ruta para obtener todas las venues
app.get('/api/venues', async (req, res) => {
    console.log('GET /api/venues llamado');
    try {
        const connection = await pool.getConnection();
        try {
            const [venues] = await connection.query('SELECT * FROM venues');
            console.log('Venues encontradas:', venues);
            res.json({
                success: true,
                venues
            });
        } catch (error) {
            console.error('Error al consultar venues:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener las venues'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        res.status(500).json({
            success: false,
            message: 'Error de conexión a la base de datos'
        });
    }
});

// Ruta para registrar una nueva venue (solo admin)
app.post('/api/venues', isAdmin, async (req, res) => {
    console.log('POST /api/venues llamado');
    try {
        const { name, description, location, contact_info } = req.body;
        
        console.log('Datos recibidos:', {
            body: req.body,
            session: req.session,
            headers: req.headers
        });

        if (!name || !description || !location || !contact_info) {
            return res.status(400).json({
                success: false,
                message: 'Los campos name, description, location y contact_info son requeridos'
            });
        }

        const connection = await pool.getConnection();
        try {
            console.log('Intentando insertar venue con los siguientes datos:', {
                name,
                description,
                location,
                contact_info,
                admin_id: req.session.userId
            });
            
            const [result] = await connection.query(
                'INSERT INTO venues (name, description, location, contact_info, admin_id, follower_count, rating) VALUES (?, ?, ?, ?, ?, 0, 0)',
                [name, description, location, contact_info, req.session.userId]
            );

            console.log('Venue insertada con éxito:', result);

            res.json({
                success: true,
                message: 'Venue registrada correctamente',
                venueId: result.insertId
            });
        } catch (error) {
            console.error('Error al insertar en la base de datos:', {
                error: error,
                sqlMessage: error.sqlMessage,
                sqlState: error.sqlState
            });
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error completo:', {
            error: error,
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: 'Error al registrar la venue: ' + error.message
        });
    }
});

// IMPORTANTE: Esta debe ser la ÚLTIMA ruta
app.get('*', (req, res) => {
    // No redirigir las rutas /admin/* al index
    if (req.path.startsWith('/admin/')) {
        res.status(404).send('Not found');
        return;
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});