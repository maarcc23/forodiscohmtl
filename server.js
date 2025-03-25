const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const mysql = require('mysql2/promise');

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

// Middleware
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
        
        // Eliminar los foros de ejemplo de la tabla venues
        await connection.query(`
            DELETE FROM venues 
            WHERE name IN ('Opium Barcelona', 'Pacha Barcelona', 'Razzmatazz', 'Sala Apolo', 'Shoko Barcelona')
        `);
        console.log('Foros de ejemplo eliminados de la base de datos');
        
        console.log('Base de datos inicializada correctamente');
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    } finally {
        connection.release();
    }
}

// Inicializar la base de datos al arrancar el servidor
initializeDatabase();

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

// Servir archivos estáticos para cualquier otra ruta
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});