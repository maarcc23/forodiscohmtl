const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const mysql = require('mysql2/promise');
const multer = require('multer');
const fs = require('fs');

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'forodisco'
};

// Pool de conexiones MySQL
const pool = mysql.createPool(dbConfig);

// Middleware
const app = express();
const PORT = process.env.PORT || 3002;

// Configuración de multer para almacenar las imágenes de perfil
const profileImagesDir = path.join(__dirname, 'public', 'uploads', 'profile_images');

// Asegurarse de que el directorio existe
if (!fs.existsSync(profileImagesDir)) {
    fs.mkdirSync(profileImagesDir, { recursive: true });
}

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, profileImagesDir);
    },
    filename: function (req, file, cb) {
        // Generar un nombre único para la imagen
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + uniqueSuffix + ext);
    }
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes'), false);
    }
};

// Configuración de multer
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Límite de 5MB
    }
});

app.use(express.json());
app.use(express.static('public'));
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(session({
    secret: 'forodisco_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Inicializar la base de datos
async function initializeDatabase() {
    const connection = await pool.getConnection();
    try {
        // Crear tabla de usuarios si no existe
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_admin BOOLEAN DEFAULT FALSE
            )
        `);
        
        // Crear tabla de venues si no existe
        await connection.query(`
            CREATE TABLE IF NOT EXISTS venues (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                location VARCHAR(100),
                image_url VARCHAR(255),
                website VARCHAR(255),
                capacity INT,
                members INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Crear tabla de foros guardados por usuario si no existe
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_forums (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                forum_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY user_forum_unique (user_id, forum_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Crear tabla de venues favoritas por usuario si no existe
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_venue_favorites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                venue_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY user_venue_unique (user_id, venue_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        // Crear tabla forum_members para el nuevo sistema de seguimiento
        await connection.query(`
            CREATE TABLE IF NOT EXISTS forum_members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                venue_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY user_venue_unique (user_id, venue_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabla forum_members creada o verificada');
        
        // Eliminar los foros de ejemplo de la tabla venues
        /*await connection.query(`
            DELETE FROM venues 
            WHERE name IN ('Opium Barcelona', 'Pacha Barcelona', 'Razzmatazz', 'Sala Apolo', 'Shoko Barcelona')
        `);*/
        console.log('Foros de ejemplo eliminados de la base de datos');
        
        console.log('Base de datos inicializada correctamente');
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    } finally {
        connection.release();
    }
}

// Modificar la estructura de la tabla venues para agregar follower_count
async function updateDatabaseStructure() {
    const connection = await pool.getConnection();
    try {
        console.log('Actualizando estructura de la base de datos...');
        
        // Verificar si la columna follower_count existe en la tabla venues
        const [columns] = await connection.query('SHOW COLUMNS FROM venues LIKE "follower_count"');
        
        // Si la columna no existe, agregarla
        if (columns.length === 0) {
            await connection.query('ALTER TABLE venues ADD COLUMN follower_count INT DEFAULT 0');
            console.log('Columna follower_count agregada a la tabla venues');
        }
    
        
        // Crear la tabla comments con la estructura correcta
        await connection.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                content TEXT NOT NULL,
                user_id INT NOT NULL,
                venue_id INT NOT NULL,
                parent_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('Tabla comments recreada con la estructura correcta');
        
        console.log('Estructura de la base de datos actualizada correctamente');
    } catch (error) {
        console.error('Error al actualizar la estructura de la base de datos:', error);
    } finally {
        connection.release();
    }
}

// Inicializar la base de datos al arrancar el servidor
initializeDatabase().then(() => {
    updateDatabaseStructure();
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
                'SELECT id FROM users WHERE username = ? OR email = ?',
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

            // Obtener el ID del rol 'usuario'
            const [roles] = await connection.query(
                'SELECT id FROM roles WHERE name = ?',
                ['usuario']
            );

            if (roles.length === 0) {
                throw new Error('Rol de usuario no encontrado');
            }

            // Insertar el nuevo usuario
            const [result] = await connection.query(
                'INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
                [username, email, hashedPassword, roles[0].id]
            );

            // Iniciar sesión automáticamente
            req.session.userId = result.insertId;
            req.session.username = username;
            req.session.email = email;

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
            // Buscar usuario por email
            const [users] = await connection.query(
                'SELECT id, username, password_hash, email FROM users WHERE email = ?',
                [email]
            );

            if (users.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            const user = users[0];

            // Verificar contraseña
            const validPassword = await bcrypt.compare(password, user.password_hash);

            if (!validPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Establecer sesión
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.email = user.email;

            res.json({
                success: true,
                message: 'Inicio de sesión exitoso'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error en el inicio de sesión:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar sesión'
        });
    }
});

// Ruta para verificar sesión
app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            username: req.session.username
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

// Ruta de cierre de sesión
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error al cerrar sesión'
            });
        }
        res.json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });
    });
});

// Ruta para obtener todas las venues
app.get('/api/venues', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            // Verificar si la tabla venues existe
            const [tables] = await connection.query("SHOW TABLES LIKE 'venues'");
            
            // Si la tabla no existe, crearla
            if (tables.length === 0) {
                console.log('La tabla venues no existe, creándola...');
                await connection.query(`
                    CREATE TABLE venues (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        location VARCHAR(255),
                        members INT DEFAULT 0
                    )
                `);
                console.log('Tabla venues creada correctamente');
            }
            
            // Obtener todas las venues sin filtrar
            const [venues] = await connection.query('SELECT * FROM venues ORDER BY name');
            
            // Si no hay venues, insertar datos de prueba
            if (venues.length === 0) {
                console.log('No hay venues, insertando datos de prueba...');
                
                // Insertar venues de ejemplo
                await connection.query(`
                    INSERT INTO venues (name, description, location, members) VALUES
                    ('Opium Barcelona', 'Discoteca y club nocturno con vistas al mar', 'Passeig Marítim, 34, Barcelona', 0),
                    ('Pacha Barcelona', 'Sucursal de la famosa discoteca ibicenca', 'Passeig Marítim, 38, Barcelona', 0),
                    ('Razzmatazz', 'Complejo con 5 salas y diferentes estilos musicales', 'Carrer dels Almogàvers, 122, Barcelona', 0),
                    ('Sala Apolo', 'Histórica sala de conciertos y club nocturno', 'Carrer Nou de la Rambla, 113, Barcelona', 0),
                    ('Shoko Barcelona', 'Restaurante y club con ambiente sofisticado', 'Passeig Marítim, 36, Barcelona', 0)
                `);
                
                console.log('Datos de prueba insertados correctamente');
                
                // Obtener las venues recién insertadas
                const [newVenues] = await connection.query('SELECT * FROM venues ORDER BY name');
                
                res.json({
                    success: true,
                    venues: newVenues
                });
            } else {
                res.json({
                    success: true,
                    venues: venues
                });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener venues:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las venues'
        });
    }
});

// Ruta para crear una nueva venue
app.post('/api/venues', async (req, res) => {
    try {
        // Verificar si el usuario es admin
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const { name, location, description, contact_info } = req.body;

        if (!name || !location) {
            return res.status(400).json({ success: false, message: 'Nombre y ubicación son requeridos' });
        }

        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query(
                'INSERT INTO venues (name, location, description, contact_info) VALUES (?, ?, ?, ?)',
                [name, location, description, contact_info]
            );

            // Crear un foro asociado a la venue
            await connection.query(
                'INSERT INTO forums (title, description, venue_id) VALUES (?, ?, ?)',
                [name, description, result.insertId]
            );

            res.status(201).json({ success: true, message: 'Venue creada exitosamente', venueId: result.insertId });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al crear venue:', error);
        res.status(500).json({ success: false, message: 'Error al crear venue' });
    }
});

// Ruta para buscar venues
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        
        if (!query.trim()) {
            return res.json({ success: true, results: [] });
        }

        const connection = await pool.getConnection();
        try {
            const searchTerm = `%${query}%`;
            const [venues] = await connection.query(
                'SELECT * FROM venues WHERE name LIKE ? OR description LIKE ? OR location LIKE ? LIMIT 10',
                [searchTerm, searchTerm, searchTerm]
            );
            
            res.json({ success: true, results: venues });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error en la búsqueda:', error);
        res.status(500).json({ success: false, message: 'Error al realizar la búsqueda' });
    }
});

// Ruta para obtener foros guardados por el usuario
app.get('/api/user/forums', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const connection = await pool.getConnection();
        try {
            const [forums] = await connection.query(
                `SELECT f.*, v.name as venue_name, v.location as venue_location 
                FROM forums f 
                JOIN user_forums uf ON f.id = uf.forum_id 
                LEFT JOIN venues v ON f.venue_id = v.id 
                WHERE uf.user_id = ?`,
                [req.session.userId]
            );
            
            res.json({ success: true, forums });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener foros del usuario:', error);
        res.status(500).json({ success: false, message: 'Error al obtener foros' });
    }
});

// Ruta para guardar un foro
app.post('/api/user/forums', async (req, res) => {
    try {
        console.log('Recibida petición para guardar foro:', req.body);
        
        if (!req.session.userId) {
            console.log('Usuario no autenticado');
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        console.log('Usuario autenticado con ID:', req.session.userId);

        const { forumId } = req.body;

        if (!forumId) {
            console.log('ID del foro no proporcionado');
            return res.status(400).json({ success: false, message: 'ID del foro es requerido' });
        }
        console.log('ID del foro a guardar:', forumId);

        // Asegurarnos de que forumId es un número
        const forumIdNum = parseInt(forumId, 10);
        if (isNaN(forumIdNum)) {
            console.log('ID del foro no es un número válido');
            return res.status(400).json({ success: false, message: 'ID del foro debe ser un número' });
        }

        // Primero, verificar si la tabla user_forums existe
        const connection = await pool.getConnection();
        try {
            // Crear la tabla user_forums si no existe
            await connection.query(`
                CREATE TABLE IF NOT EXISTS user_forums (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    forum_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY user_forum_unique (user_id, forum_id)
                )
            `);
            console.log('Tabla user_forums verificada/creada');

            console.log('Verificando si el venue existe...');
            // Verificar si el venue existe (ya que estamos guardando venues como foros)
            const [venues] = await connection.query('SELECT id FROM venues WHERE id = ?', [forumIdNum]);
            console.log('Resultado de la consulta de venues:', venues);
            
            if (venues.length === 0) {
                console.log('Venue no encontrada');
                return res.status(404).json({ success: false, message: 'Venue no encontrada' });
            }
            console.log('Venue encontrada');

            console.log('Verificando si el foro ya está guardado...');
            // Verificar si ya está guardado
            const [existingForum] = await connection.query(
                'SELECT id FROM user_forums WHERE user_id = ? AND forum_id = ?',
                [req.session.userId, forumIdNum]
            );
            console.log('Resultado de la consulta de foros existentes:', existingForum);

            if (existingForum.length > 0) {
                console.log('Foro ya guardado');
                return res.json({ success: true, message: 'Foro ya guardado', alreadySaved: true });
            }
            console.log('Foro no guardado previamente, procediendo a guardar');

            // Guardar el foro
            console.log('Insertando foro en la tabla user_forums...');
            try {
                const result = await connection.query(
                    'INSERT INTO user_forums (user_id, forum_id) VALUES (?, ?)',
                    [req.session.userId, forumIdNum]
                );
                console.log('Foro guardado exitosamente, resultado:', result);
                res.status(201).json({ success: true, message: 'Foro guardado exitosamente' });
            } catch (insertError) {
                console.error('Error específico al insertar foro:', insertError);
                throw insertError;
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error detallado al guardar foro:', error);
        // Devolver información más detallada sobre el error
        res.status(500).json({ 
            success: false, 
            message: 'Error al guardar foro: ' + error.message
        });
    }
});

// Ruta para eliminar un foro guardado
app.delete('/api/user/forums/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const forumId = req.params.id;

        const connection = await pool.getConnection();
        try {
            await connection.query(
                'DELETE FROM user_forums WHERE user_id = ? AND forum_id = ?',
                [req.session.userId, forumId]
            );

            res.json({ success: true, message: 'Foro eliminado exitosamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al eliminar foro:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar foro' });
    }
});

// Ruta para obtener información del usuario actual
app.get('/api/auth/current-user', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const connection = await pool.getConnection();
        try {
            const [users] = await connection.query(
                'SELECT id, username, email, role_id FROM users WHERE id = ?',
                [req.session.userId]
            );

            if (users.length === 0) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const user = users[0];
            
            // Obtener el rol
            const [roles] = await connection.query(
                'SELECT name FROM roles WHERE id = ?',
                [user.role_id]
            );

            const role = roles.length > 0 ? roles[0].name : 'usuario';

            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: role
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener usuario actual:', error);
        res.status(500).json({ success: false, message: 'Error al obtener usuario' });
    }
});

// Ruta para actualizar el perfil del usuario
app.put('/api/user/profile', async (req, res) => {
    try {
        const { username, userId, authToken, email } = req.body;

        // Validar datos
        if (!username) {
            return res.status(400).json({ success: false, message: 'El nombre de usuario es requerido' });
        }

        if (!email) {
            return res.status(400).json({ success: false, message: 'El correo electrónico es requerido para identificar al usuario' });
        }

        // Verificar autenticación - ahora acepta tanto sesión como localStorage
        let userEmail;
        
        if (req.session && req.session.email) {
            // Autenticación basada en sesión (método original)
            userEmail = req.session.email;
        } else if (email && authToken) {
            // Autenticación alternativa basada en localStorage
            userEmail = email;
        } else {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const connection = await pool.getConnection();
        try {
            // Verificar si el nombre de usuario ya está en uso por otro usuario
            const [existingUsers] = await connection.query(
                'SELECT id FROM users WHERE username = ? AND email != ?',
                [username, userEmail]
            );

            if (existingUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de usuario ya está en uso'
                });
            }

            // Actualizar el perfil del usuario usando el correo electrónico como identificador
            await connection.query(
                'UPDATE users SET username = ? WHERE email = ?',
                [username, userEmail]
            );

            // Actualizar la sesión si existe
            if (req.session) {
                req.session.username = username;
            }

            res.json({
                success: true,
                message: 'Perfil actualizado correctamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al actualizar el perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el perfil'
        });
    }
});

// Ruta para obtener los foros guardados por un usuario
app.get('/api/user/saved-forums', async (req, res) => {
    try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }
        
        const userId = req.session.userId;
        const connection = await pool.getConnection();
        
        try {
            // Obtener los foros guardados por el usuario
            const [savedForums] = await connection.query(
                `SELECT f.*, v.name as venue_name, v.location as venue_location 
                FROM forums f 
                JOIN user_forums uf ON f.id = uf.forum_id 
                LEFT JOIN venues v ON f.venue_id = v.id 
                WHERE uf.user_id = ?`,
                [userId]
            );
            
            res.json({
                success: true,
                savedForums: savedForums
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener foros guardados:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los foros guardados'
        });
    }
});

// Endpoint para guardar una venue para el usuario
app.post('/api/user/save-venue', async (req, res) => {
    try {
        console.log('Recibida petición para guardar venue:', req.body);
        
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        
        const userId = req.session.userId;
        const { venue_id } = req.body;
        
        if (!venue_id) {
            return res.status(400).json({ success: false, message: 'ID de venue no proporcionado' });
        }
        
        const connection = await pool.getConnection();
        
        try {
            // Verificar si ya existe esta relación usuario-venue
            const [existingVenues] = await connection.query(
                'SELECT * FROM user_venue_favorites WHERE user_id = ? AND venue_id = ?',
                [userId, venue_id]
            );
            
            if (existingVenues.length > 0) {
                return res.json({ success: true, message: 'Venue ya guardada previamente' });
            }
            
            // Insertar nueva relación usuario-venue
            await connection.query(
                'INSERT INTO user_venue_favorites (user_id, venue_id, created_at) VALUES (?, ?, NOW())',
                [userId, venue_id]
            );
            
            res.json({ success: true, message: 'Venue guardada correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al guardar venue:', error);
        res.status(500).json({ success: false, message: 'Error al guardar venue' });
    }
});

// Endpoint para eliminar una venue guardada por el usuario
app.delete('/api/user/delete-venue/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        
        const userId = req.session.userId;
        const venueId = req.params.id;
        
        const connection = await pool.getConnection();
        
        try {
            // Eliminar la relación usuario-venue
            const [result] = await connection.query(
                'DELETE FROM user_venue_favorites WHERE user_id = ? AND venue_id = ?',
                [userId, venueId]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Venue no encontrada o ya eliminada' });
            }
            
            res.json({ success: true, message: 'Venue eliminada correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al eliminar venue:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar venue' });
    }
});

// Endpoint para obtener todas las venues guardadas por el usuario
app.get('/api/user/venues', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        
        const userId = req.session.userId;
        const connection = await pool.getConnection();
        
        try {
            console.log('Obteniendo venues guardadas para el usuario:', userId);
            
            // Primero, obtener solo los IDs de las venues guardadas
            const [savedVenueIds] = await connection.query(
                `SELECT venue_id, created_at FROM user_venue_favorites WHERE user_id = ?`,
                [userId]
            );
            
            console.log('IDs de venues guardadas encontradas:', savedVenueIds.length);
            
            if (savedVenueIds.length === 0) {
                return res.json({
                    success: true,
                    venues: []
                });
            }
            
            // Extraer solo los IDs
            const venueIds = savedVenueIds.map(item => item.venue_id);
            
            // Luego, obtener los detalles de esas venues con información adicional
            const [venueDetails] = await connection.query(
                `SELECT 
                    v.id,
                    v.name,
                    v.description,
                    v.location,
                    v.follower_count
                FROM venues v
                WHERE v.id IN (?)`,
                [venueIds]
            );
            
            console.log('Detalles de venues encontrados:', venueDetails.length);
            
            // Combinar los datos
            const venues = savedVenueIds.map(item => {
                const details = venueDetails.find(v => v.id === item.venue_id) || {};
                return {
                    id: item.venue_id,
                    created_at: item.created_at,
                    name: details.name || 'Foro ' + item.venue_id,
                    description: details.description || 'Sin descripción',
                    image_url: details.image_url,
                    location: details.location || 'Ubicación no disponible',
                    address: details.address,
                    followers: details.followers || 0,
                    category: details.category || 'General',
                    rating: details.rating || 0
                };
            });
            
            // Devolver los resultados
            res.json({
                success: true,
                venues: venues
            });
        } catch (dbError) {
            console.error('Error en la consulta de la base de datos:', dbError);
            
            // Si hay un error en la consulta, intentar obtener al menos los IDs
            try {
                const [basicVenues] = await connection.query(
                    `SELECT venue_id as id, created_at FROM user_venue_favorites WHERE user_id = ?`,
                    [userId]
                );
                
                // Crear objetos simples con los IDs
                const simpleVenues = basicVenues.map(item => ({
                    id: item.id,
                    created_at: item.created_at,
                    name: 'Foro ' + item.id,
                    description: 'Información no disponible',
                    location: 'Ubicación no disponible',
                    followers: 0
                }));
                
                return res.json({
                    success: true,
                    venues: simpleVenues,
                    note: 'Datos parciales debido a un error en la base de datos'
                });
            } catch (fallbackError) {
                console.error('Error en consulta de respaldo:', fallbackError);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error al consultar la base de datos',
                    error: dbError.message
                });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener venues guardadas:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener venues guardadas',
            error: error.message
        });
    }
});

// Endpoint para eliminar un foro guardado de la tabla user_venue_favorites
app.delete('/api/user/venues/:venueId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        
        const userId = req.session.userId;
        const venueId = req.params.venueId;
        
        console.log(`Eliminando venue ${venueId} de favoritos para el usuario ${userId}`);
        
        const connection = await pool.getConnection();
        
        try {
            // Eliminar la relación en la tabla user_venue_favorites
            const [result] = await connection.query(
                'DELETE FROM user_venue_favorites WHERE user_id = ? AND venue_id = ?',
                [userId, venueId]
            );
            
            connection.release();
            
            if (result.affectedRows > 0) {
                return res.json({
                    success: true,
                    message: 'Venue eliminada de favoritos correctamente'
                });
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró la venue en favoritos'
                });
            }
        } catch (error) {
            connection.release();
            console.error('Error al eliminar venue de favoritos:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error en el servidor:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar venue de favoritos' });
    }
});

// Endpoint para obtener eventos
app.get('/api/events', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            // Obtener todos los eventos con el nombre del venue
            const [events] = await connection.query(`
                SELECT e.*, v.name as venue_name 
                FROM events e 
                LEFT JOIN venues v ON e.venue_id = v.id 
                ORDER BY e.event_date ASC
            `);
            
            res.json(events);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener eventos:', error);
        res.status(500).json({ success: false, message: 'Error al obtener eventos' });
    }
});

// Endpoint para inicializar la tabla de recomendaciones
app.get('/api/init-recommendations', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            // Crear tabla de recomendaciones si no existe
            await connection.query(`
                CREATE TABLE IF NOT EXISTS recommendations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    parent_id INT NULL,
                    title VARCHAR(255) NULL,
                    description TEXT NOT NULL,
                    interaction_count INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_id) REFERENCES recommendations(id) ON DELETE CASCADE
                )
            `);
            
            res.json({ success: true, message: 'Tabla de recomendaciones inicializada correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al inicializar tabla de recomendaciones:', error);
        res.status(500).json({ success: false, message: 'Error al inicializar tabla de recomendaciones' });
    }
});

// Endpoint para obtener todas las recomendaciones principales (no comentarios)
app.get('/api/recommendations', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            // Obtener todas las recomendaciones principales con el nombre del usuario
            const [recommendations] = await connection.query(`
                SELECT r.*, u.username as author_name,
                (SELECT COUNT(*) FROM recommendations WHERE parent_id = r.id) as comments_count
                FROM recommendations r 
                LEFT JOIN users u ON r.user_id = u.id 
                WHERE r.parent_id IS NULL
                ORDER BY r.created_at DESC
            `);
            
            res.json(recommendations);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener recomendaciones:', error);
        res.status(500).json({ success: false, message: 'Error al obtener recomendaciones' });
    }
});

// Endpoint para obtener una recomendación específica con sus comentarios
app.get('/api/recommendations/:id', async (req, res) => {
    try {
        const recommendationId = req.params.id;
        const connection = await pool.getConnection();
        try {
            // Obtener la recomendación principal
            const [recommendation] = await connection.query(`
                SELECT r.*, u.username as author_name
                FROM recommendations r 
                LEFT JOIN users u ON r.user_id = u.id 
                WHERE r.id = ?
            `, [recommendationId]);
            
            if (recommendation.length === 0) {
                return res.status(404).json({ success: false, message: 'Recomendación no encontrada' });
            }
            
            // Obtener los comentarios de la recomendación
            const [comments] = await connection.query(`
                SELECT r.*, u.username as author_name
                FROM recommendations r 
                LEFT JOIN users u ON r.user_id = u.id 
                WHERE r.parent_id = ?
                ORDER BY r.created_at ASC
            `, [recommendationId]);
            
            res.json({
                recommendation: recommendation[0],
                comments: comments
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener recomendación:', error);
        res.status(500).json({ success: false, message: 'Error al obtener recomendación' });
    }
});

// Endpoint para crear una nueva recomendación
app.post('/api/recommendations', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        
        const { title, description } = req.body;
        
        if (!title || !description) {
            return res.status(400).json({ success: false, message: 'Título y descripción son requeridos' });
        }
        
        const connection = await pool.getConnection();
        try {
            // Insertar la nueva recomendación
            const [result] = await connection.query(`
                INSERT INTO recommendations (user_id, title, description)
                VALUES (?, ?, ?)
            `, [req.session.userId, title, description]);
            
            res.status(201).json({ 
                success: true, 
                message: 'Recomendación creada correctamente',
                recommendationId: result.insertId
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al crear recomendación:', error);
        res.status(500).json({ success: false, message: 'Error al crear recomendación' });
    }
});

// Endpoint para añadir un comentario a una recomendación
app.post('/api/recommendations/:id/comments', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        
        const recommendationId = req.params.id;
        const { description } = req.body;
        
        if (!description) {
            return res.status(400).json({ success: false, message: 'Descripción es requerida' });
        }
        
        const connection = await pool.getConnection();
        try {
            // Verificar que la recomendación existe
            const [recommendation] = await connection.query(`
                SELECT id FROM recommendations WHERE id = ?
            `, [recommendationId]);
            
            if (recommendation.length === 0) {
                return res.status(404).json({ success: false, message: 'Recomendación no encontrada' });
            }
            
            // Insertar el nuevo comentario
            const [result] = await connection.query(`
                INSERT INTO recommendations (user_id, parent_id, description)
                VALUES (?, ?, ?)
            `, [req.session.userId, recommendationId, description]);
            
            // Incrementar el contador de interacciones de la recomendación principal
            await connection.query(`
                UPDATE recommendations SET interaction_count = interaction_count + 1
                WHERE id = ?
            `, [recommendationId]);
            
            res.status(201).json({ 
                success: true, 
                message: 'Comentario añadido correctamente',
                commentId: result.insertId
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al añadir comentario:', error);
        res.status(500).json({ success: false, message: 'Error al añadir comentario' });
    }
});

// Endpoint para dar "me gusta" a una recomendación
app.post('/api/recommendations/:id/like', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        
        const recommendationId = req.params.id;
        
        const connection = await pool.getConnection();
        try {
            // Incrementar el contador de interacciones
            await connection.query(`
                UPDATE recommendations SET interaction_count = interaction_count + 1
                WHERE id = ?
            `, [recommendationId]);
            
            res.json({ success: true, message: 'Me gusta añadido correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al dar me gusta:', error);
        res.status(500).json({ success: false, message: 'Error al dar me gusta' });
    }
});

// Endpoint para obtener comentarios de un venue
app.get('/api/venues/:venueId/comments', async (req, res) => {
    try {
        const venueId = req.params.venueId;

        if (!venueId) {
            return res.status(400).json({ success: false, message: 'ID de venue no especificado' });
        }

        console.log('Obteniendo comentarios para el venue ID:', venueId);
        
        const connection = await pool.getConnection();
        try {
            // Verificar si la tabla comments existe
            const [tables] = await connection.query("SHOW TABLES LIKE 'comments'");
            
            // Si la tabla no existe, devolver una lista vacía
            if (tables.length === 0) {
                console.log('La tabla comments no existe, devolviendo lista vacía');
                return res.json({
                    success: true,
                    comments: []
                });
            }
            
            // Obtener todos los comentarios del venue ordenados por fecha
            const [comments] = await connection.query(
                `SELECT 
                    c.id, c.content, c.user_id, c.venue_id, c.parent_id, c.created_at, c.updated_at, 
                    IFNULL(u.username, 'Usuario') as username,
                    u.profile_image
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.venue_id = ?
                ORDER BY c.created_at DESC`,
                [venueId]
            );
            
            console.log(`Se encontraron ${comments.length} comentarios para el venue ID ${venueId}`);
            
            res.json({
                success: true,
                comments: comments
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener comentarios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los comentarios: ' + error.message
        });
    }
});

// Endpoint para crear un comentario
app.post('/api/venues/comments', async (req, res) => {
    try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const { venueId, content } = req.body;
        
        if (!venueId || !content) {
            return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
        }

        const connection = await pool.getConnection();
        try {
            // Insertar el comentario
            const [result] = await connection.query(
                'INSERT INTO comments (content, user_id, venue_id) VALUES (?, ?, ?)',
                [content, req.session.userId, venueId]
            );
            
            // Obtener el comentario recién creado con el nombre de usuario
            const [comments] = await connection.query(
                `SELECT 
                    c.id, c.content, c.user_id, c.venue_id, c.parent_id, c.created_at, c.updated_at, 
                    IFNULL(u.username, 'Usuario') as username,
                    u.profile_image
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.id = ?`,
                [result.insertId]
            );
            
            res.json({
                success: true,
                message: 'Comentario creado correctamente',
                comment: comments[0]
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al crear comentario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear el comentario: ' + error.message
        });
    }
});

// Endpoint para responder a un comentario
app.post('/api/venues/comments/reply', async (req, res) => {
    try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const { venueId, parentId, content } = req.body;
        
        if (!venueId || !parentId || !content) {
            return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
        }

        const connection = await pool.getConnection();
        try {
            // Verificar que el comentario padre existe
            const [parentComment] = await connection.query(
                'SELECT * FROM comments WHERE id = ? AND venue_id = ?',
                [parentId, venueId]
            );
            
            if (parentComment.length === 0) {
                return res.status(404).json({ success: false, message: 'Comentario padre no encontrado' });
            }
            
            // Insertar la respuesta
            const [result] = await connection.query(
                'INSERT INTO comments (content, user_id, venue_id, parent_id) VALUES (?, ?, ?, ?)',
                [content, req.session.userId, venueId, parentId]
            );
            
            // Obtener la respuesta recién creada con el nombre de usuario
            const [comments] = await connection.query(
                `SELECT 
                    c.id, c.content, c.user_id, c.venue_id, c.parent_id, c.created_at, c.updated_at, 
                    IFNULL(u.username, 'Usuario') as username,
                    u.profile_image
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.id = ?`,
                [result.insertId]
            );
            
            res.json({
                success: true,
                message: 'Respuesta creada correctamente',
                comment: comments[0]
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al crear respuesta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la respuesta: ' + error.message
        });
    }
});

// Endpoint para seguir/dejar de seguir un venue (incrementa/decrementa follower_count)
app.post('/api/venues/:venueId/follow', async (req, res) => {
    try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const venueId = req.params.venueId;
        
        if (!venueId) {
            return res.status(400).json({ success: false, message: 'ID de venue no especificado' });
        }

        const connection = await pool.getConnection();
        try {
            // Verificar si el usuario ya sigue este venue
            const [existingFollow] = await connection.query(
                'SELECT * FROM user_venue_favorites WHERE user_id = ? AND venue_id = ?',
                [req.session.userId, venueId]
            );
            
            if (existingFollow.length > 0) {
                // Si ya lo sigue, simplemente devolver el contador actual
                const [followerCountResult] = await connection.query(
                    'SELECT COUNT(*) as count FROM user_venue_favorites WHERE venue_id = ?',
                    [venueId]
                );
                
                return res.json({
                    success: true,
                    message: 'Ya sigues este venue',
                    followerCount: parseInt(followerCountResult[0].count, 10)
                });
            }
            
            // Iniciar transacción
            await connection.beginTransaction();
            
            // Insertar en la tabla de favoritos
            await connection.query(
                'INSERT INTO user_venue_favorites (user_id, venue_id) VALUES (?, ?)',
                [req.session.userId, venueId]
            );
            
            // Calcular el contador de seguidores en tiempo real
            const [followerCountResult] = await connection.query(
                'SELECT COUNT(*) as count FROM user_venue_favorites WHERE venue_id = ?',
                [venueId]
            );
            
            const followerCount = parseInt(followerCountResult[0].count, 10);
            
            // Actualizar el contador en la tabla venues para mantenerlo sincronizado
            await connection.query(
                'UPDATE venues SET follower_count = ? WHERE id = ?',
                [followerCount, venueId]
            );
            
            // Confirmar la transacción
            await connection.commit();
            
            res.json({
                success: true,
                message: 'Ahora sigues este venue',
                followerCount: followerCount
            });
        } catch (error) {
            // Revertir la transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al seguir venue:', error);
        res.status(500).json({
            success: false,
            message: 'Error al seguir el venue: ' + error.message
        });
    }
});

// Endpoint para dejar de seguir un venue
app.delete('/api/venues/:venueId/follow', async (req, res) => {
    try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const venueId = req.params.venueId;
        
        if (!venueId) {
            return res.status(400).json({ success: false, message: 'ID de venue no especificado' });
        }

        const connection = await pool.getConnection();
        try {
            // Verificar si el usuario sigue este venue
            const [existingFollow] = await connection.query(
                'SELECT * FROM user_venue_favorites WHERE user_id = ? AND venue_id = ?',
                [req.session.userId, venueId]
            );
            
            if (existingFollow.length === 0) {
                // Si no lo sigue, simplemente devolver el contador actual
                const [followerCountResult] = await connection.query(
                    'SELECT COUNT(*) as count FROM user_venue_favorites WHERE venue_id = ?',
                    [venueId]
                );
                
                return res.json({
                    success: true,
                    message: 'No sigues este venue',
                    followerCount: parseInt(followerCountResult[0].count, 10)
                });
            }
            
            // Iniciar transacción
            await connection.beginTransaction();
            
            // Eliminar de la tabla de favoritos
            await connection.query(
                'DELETE FROM user_venue_favorites WHERE user_id = ? AND venue_id = ?',
                [req.session.userId, venueId]
            );
            
            // Calcular el contador de seguidores en tiempo real
            const [followerCountResult] = await connection.query(
                'SELECT COUNT(*) as count FROM user_venue_favorites WHERE venue_id = ?',
                [venueId]
            );
            
            const followerCount = parseInt(followerCountResult[0].count, 10);
            
            // Actualizar el contador en la tabla venues para mantenerlo sincronizado
            await connection.query(
                'UPDATE venues SET follower_count = ? WHERE id = ?',
                [followerCount, venueId]
            );
            
            // Confirmar la transacción
            await connection.commit();
            
            res.json({
                success: true,
                message: 'Has dejado de seguir este venue',
                followerCount: followerCount
            });
        } catch (error) {
            // Revertir la transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al dejar de seguir venue:', error);
        res.status(500).json({
            success: false,
            message: 'Error al dejar de seguir el venue: ' + error.message
        });
    }
});

// Endpoint para verificar si el usuario sigue un venue
app.get('/api/venues/:venueId/follow-status', async (req, res) => {
    try {
        const venueId = req.params.venueId;
        
        if (!venueId) {
            return res.status(400).json({ success: false, message: 'ID de venue no especificado' });
        }

        const connection = await pool.getConnection();
        try {
            // Calcular el número real de seguidores con COUNT(*)
            const [followerCountResult] = await connection.query(
                'SELECT COUNT(*) as count FROM user_venue_favorites WHERE venue_id = ?',
                [venueId]
            );
            
            const followerCount = parseInt(followerCountResult[0].count, 10);
            
            // Si el usuario no está autenticado, solo devolver el contador
            if (!req.session || !req.session.userId) {
                return res.json({ 
                    success: true, 
                    isFollowing: false,
                    followerCount: followerCount
                });
            }
            
            // Verificar si el usuario sigue este venue
            const [existingFollow] = await connection.query(
                'SELECT * FROM user_venue_favorites WHERE user_id = ? AND venue_id = ?',
                [req.session.userId, venueId]
            );
            
            // Actualizar el contador en la base de datos para mantenerlo sincronizado
            await connection.query(
                'UPDATE venues SET follower_count = ? WHERE id = ?',
                [followerCount, venueId]
            );
            
            res.json({
                success: true,
                isFollowing: existingFollow.length > 0,
                followerCount: followerCount
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al verificar estado de seguimiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar estado de seguimiento: ' + error.message
        });
    }
});

// Endpoint para verificar si un foro está guardado
app.get('/api/user/forums/status/:forumId', async (req, res) => {
    try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const forumId = req.params.forumId;
        
        if (!forumId) {
            return res.status(400).json({ success: false, message: 'ID de foro no especificado' });
        }

        const connection = await pool.getConnection();
        try {
            // Verificar si el usuario ha guardado este foro
            const [existingForum] = await connection.query(
                'SELECT * FROM user_forums WHERE user_id = ? AND forum_id = ?',
                [req.session.userId, forumId]
            );
            
            res.json({
                success: true,
                isSaved: existingForum.length > 0
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al verificar estado de guardado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar estado de guardado: ' + error.message
        });
    }
});

// Endpoint para obtener un venue específico
app.get('/api/venues/:venueId', async (req, res) => {
    try {
        const venueId = req.params.venueId;
        
        if (!venueId) {
            return res.status(400).json({ success: false, message: 'ID de venue no especificado' });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener datos del venue
            const [venues] = await connection.query(
                'SELECT * FROM venues WHERE id = ?',
                [venueId]
            );
            
            if (venues.length === 0) {
                return res.status(404).json({ success: false, message: 'Venue no encontrado' });
            }
            
            const venue = venues[0];
            
            // Calcular el número real de seguidores con COUNT(*)
            const [followerCountResult] = await connection.query(
                'SELECT COUNT(*) as count FROM user_venue_favorites WHERE venue_id = ?',
                [venueId]
            );
            
            // Actualizar el contador de seguidores en la respuesta
            venue.follower_count = followerCountResult[0].count;
            
            // Si hay una discrepancia entre el contador almacenado y el real, actualizar la base de datos
            if (venue.follower_count !== followerCountResult[0].count) {
                await connection.query(
                    'UPDATE venues SET follower_count = ? WHERE id = ?',
                    [followerCountResult[0].count, venueId]
                );
            }
            
            res.json({
                success: true,
                venue: venue
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener venue:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el venue: ' + error.message
        });
    }
});

// Endpoint para obtener los comentarios más recientes (del último día)
app.get('/api/recent-comments', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            // Obtener comentarios de las últimas 24 horas
            const [comments] = await connection.query(`
                SELECT c.*, u.username, v.name as venue_name 
                FROM comments c
                JOIN users u ON c.user_id = u.id
                JOIN venues v ON c.venue_id = v.id
                WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
                ORDER BY c.created_at DESC
                LIMIT 10
            `);
            
            res.json(comments);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener comentarios recientes:', error);
        res.status(500).json({ success: false, message: 'Error al obtener comentarios recientes' });
    }
});

// Endpoint para obtener los locales más seguidos
app.get('/api/most-followed-venues', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            // Obtener los locales más seguidos ordenados por follower_count
            const [venues] = await connection.query(`
                SELECT * FROM venues 
                ORDER BY follower_count DESC 
                LIMIT 3
            `);
            
            res.json(venues);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener locales más seguidos:', error);
        res.status(500).json({ success: false, message: 'Error al obtener locales más seguidos' });
    }
});

// Endpoint para subir imágenes de perfil
app.post('/api/upload-profile-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const connection = await pool.getConnection();
        try {
            // Actualizar la imagen de perfil del usuario
            await connection.query(
                'UPDATE users SET profile_image = ? WHERE id = ?',
                [req.file.filename, req.session.userId]
            );

            res.json({ success: true, message: 'Imagen de perfil actualizada correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al subir imagen de perfil:', error);
        res.status(500).json({ success: false, message: 'Error al subir imagen de perfil' });
    }
});

// Endpoint para obtener la imagen de perfil del usuario actual
app.get('/api/user/profile-image', async (req, res) => {
    try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const userId = req.session.userId;
        const connection = await pool.getConnection();
        try {
            // Obtener la imagen de perfil del usuario
            const [users] = await connection.query(
                'SELECT profile_image FROM users WHERE id = ?',
                [userId]
            );

            if (users.length === 0) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const profileImage = users[0].profile_image;

            res.json({
                success: true,
                profileImage: profileImage
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener imagen de perfil:', error);
        res.status(500).json({ success: false, message: 'Error al obtener imagen de perfil' });
    }
});

app.delete('/api/comments/:commentId', async (req, res) => {
    console.log('Solicitud para eliminar comentario recibida. ID:', req.params.commentId);

    const commentId = req.params.commentId;
    console.log('ID del comentario a eliminar (original):', commentId);

    // Validar que commentId es un número podría ser una buena idea aquí también
    if (isNaN(parseInt(commentId, 10))) {
        console.log('ID de comentario inválido:', commentId);
        return res.status(400).json({ success: false, message: 'ID de comentario inválido.' });
    }

    let connection; // Declarar fuera para que esté disponible en el bloque finally

    try {
        connection = await pool.getConnection();
        console.log('Conexión a la base de datos obtenida.');

        // 2. Usar consultas parametrizadas para seguridad (como en el GET)
        //    y await para la ejecución de la consulta.
        const query_str = 'DELETE FROM comments WHERE id = ?';
        console.log('Ejecutando consulta DELETE:', query_str, 'con ID:', commentId);

        // El resultado de un DELETE, UPDATE, INSERT con mysql2/promise es un array
        // donde el primer elemento es un objeto con información como affectedRows.
        const [results] = await connection.query(query_str, [commentId]);
        
        console.log('Resultado de la eliminación:', results);

        if (results.affectedRows > 0) {
            console.log('Comentario eliminado correctamente de la base de datos.');
            res.status(200).json({ success: true, message: 'Comentario eliminado correctamente.' });
        } else {
            // 3. Manejar "no encontrado" de forma más limpia (similar al GET)
            console.log('No se encontró el comentario en la base de datos con ID:', commentId);
            res.status(404).json({ success: false, message: 'Comentario no encontrado.' });
            // Se elimina la lógica del TRUNCATE, ya que es una acción muy drástica
            // y no es un fallback apropiado para un delete específico.
        }

    } catch (error) {
        console.error('Error general al eliminar el comentario:', error);
        // El return no es necesario aquí si es la última instrucción del catch,
        // pero es explícito.
        return res.status(500).json({ success: false, message: 'Error general al eliminar el comentario: ' + error.message });
    } finally {
        if (connection) {
            // 4. Liberar la conexión de forma estándar (como en el GET)
            connection.release();
            console.log('Conexión a la base de datos liberada.');
        }
    }
});

// Servir archivos estáticos para cualquier otra ruta
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});