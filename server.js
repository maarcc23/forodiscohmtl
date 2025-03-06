const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = 3002;

// Configuración básica
app.use(express.json());
app.use(express.static('public'));

// Conexión a la base de datos
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'forodisco'
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
// Ruta de login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Intento de login:', { email, password }); // Para debug

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos'
            });
        }

        const connection = await pool.getConnection();
        
        try {
            // Verificar si el usuario ya existe
            const [existingUsers] = await connection.query(
                'SELECT id FROM user_forums WHERE username = ? OR email = ?',
                [username, email]
            const [users] = await connection.query(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );

            // Para el usuario admin, permitir acceso directo
            if (email === 'admin@forodisco.com' && password === 'admin123') {
                return res.json({
                    success: true,
                    message: 'Login exitoso',
                    user: {
                        id: 1, // ID fijo para el admin
                        email: email,
                        username: 'admin'
                    }
                });
            }

            if (users.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            const user = users[0];

            // Por defecto, los nuevos usuarios tienen role_id = 3 (usuario normal)
            const [result] = await connection.query(
                'INSERT INTO user_forums (username, email, password, role_id) VALUES (?, ?, ?, 3)',
                [username, email, hashedPassword]
            );
            // Para otros usuarios, verificar contraseña
            if (user.password !== password) {
                return res.status(401).json({
                    success: false,
                    message: 'Contraseña incorrecta'
                });
            }

            res.json({
                success: true,
                message: 'Login exitoso',
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username
                }
            });

            // Iniciar sesión automáticamente
            req.session.userId = result.insertId;
            req.session.username = username;
            req.session.role = 'usuario';
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor'
        });
    }
});

// Ruta para obtener todos los foros
app.get('/api/forums', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [forums] = await connection.query(`
                SELECT 
                    *,
                    nombre as name
                FROM forums
                ORDER BY created_at DESC
            `);
            
            res.json({
                success: true,
                forums
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener foros:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los foros'
        });
    }
});

// Ruta para guardar un foro
app.post('/api/forums/:forumId/save', async (req, res) => {
    try {
        const { forumId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere el ID del usuario'
            });
        }

        const connection = await pool.getConnection();
        
        try {
            // Buscar usuario y su rol
            const [users] = await connection.query(
                'SELECT users.*, roles.name as role_name FROM users JOIN roles ON users.role_id = roles.id WHERE users.email = ?',
                [email]
            // Verificar si el foro ya está guardado
            const [existing] = await connection.query(
                'SELECT * FROM saved_forums WHERE user_id = ? AND forum_id = ?',
                [userId, forumId]
            );

            console.log('Usuario encontrado:', users[0]); // Para debug

            if (users.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
            if (existing.length > 0) {
                return res.json({
                    success: true,
                    message: 'El foro ya está guardado'
                });
            }

            // Guardar el foro
            await connection.query(
                'INSERT INTO saved_forums (user_id, forum_id) VALUES (?, ?)',
                [userId, forumId]
            );

            // Verificar contraseña
            const validPassword = await bcrypt.compare(password, user.password_hash);
            console.log('Contraseña válida:', validPassword); // Para debug
            res.json({
                success: true,
                message: 'Foro guardado exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al guardar el foro:', error);
        res.status(500).json({
            success: false,
            message: 'Error al guardar el foro'
        });
    }
});

// Ruta para obtener los foros guardados de un usuario
app.get('/api/users/:userId/saved-forums', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('Obteniendo foros guardados para usuario:', userId);

            // Establecer sesión
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role_name;
        const connection = await pool.getConnection();
        
        try {
            const [forums] = await connection.query(`
                SELECT 
                    f.*,
                    COALESCE(f.nombre, 'Sin título') as nombre,
                    COALESCE(f.description, 'Sin descripción') as description,
                    COALESCE(f.location, '') as location
                FROM forums f 
                JOIN saved_forums sf ON f.id = sf.forum_id 
                WHERE sf.user_id = ?
                ORDER BY sf.created_at DESC
            `, [userId]);

            console.log('Foros encontrados:', forums);

            res.json({
                success: true,
                message: 'Inicio de sesión exitoso',
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role_name
                }
                forums: forums.map(forum => ({
                    ...forum,
                    name: forum.nombre // Mapear nombre a name para mantener compatibilidad
                }))
            });
        } catch (error) {
            console.error('Error en la consulta:', error);
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error completo en el inicio de sesión:', error);
        console.error('Error al obtener foros guardados:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar sesión: ' + error.message
            message: 'Error al obtener foros guardados'
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
// Ruta para eliminar un foro guardado
app.delete('/api/forums/:forumId/save', async (req, res) => {
    try {
        const { forumId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere el ID del usuario'
            });
        }

        const connection = await pool.getConnection();
        
        try {
            await connection.query(
                'DELETE FROM saved_forums WHERE user_id = ? AND forum_id = ?',
                [userId, forumId]
            );

            res.json({
                success: true,
                message: 'Foro eliminado exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al eliminar el foro:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar el foro'
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
// Ruta para buscar venues
app.get('/api/search/venues', async (req, res) => {
    try {
        const { query } = req.query;
        const connection = await pool.getConnection();
        
        try {
            let sql = `
                SELECT * FROM venues 
                WHERE name LIKE ? 
                OR description LIKE ? 
                OR location LIKE ?
            `;
            
            const searchTerm = `%${query}%`;
            const [venues] = await connection.query(sql, [searchTerm, searchTerm, searchTerm]);
            
            console.log('Resultados de búsqueda:', venues);

            res.json({
                success: true,
                venues: venues.map(venue => ({
                    id: venue.id,
                    name: venue.name,
                    description: venue.description,
                    location: venue.location
                }))
            });
        } finally {
            connection.release();
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
    } catch (error) {
        console.error('Error en la búsqueda:', error);
        res.status(500).json({
            success: false,
            message: 'Error al realizar la búsqueda'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar la discoteca'
        });
    }
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
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});