const express = require('express');
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
            // Verificar si el foro ya está guardado
            const [existing] = await connection.query(
                'SELECT * FROM saved_forums WHERE user_id = ? AND forum_id = ?',
                [userId, forumId]
            );

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
                forums: forums.map(forum => ({
                    ...forum,
                    name: forum.nombre // Mapear nombre a name para mantener compatibilidad
                }))
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al obtener foros guardados:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener foros guardados'
        });
    }
});

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
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});