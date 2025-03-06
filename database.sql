-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS forodisco;
USE forodisco;

-- Tabla de roles (única)
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Tabla de usuarios (única)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de venues (única)
CREATE TABLE IF NOT EXISTS venues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de foros (única)
CREATE TABLE IF NOT EXISTS forums (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    venue_id INT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venues(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabla de miembros del foro (única)
CREATE TABLE IF NOT EXISTS forum_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    forum_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_member (forum_id, user_id)
);

-- Tabla de favoritos (única)
CREATE TABLE IF NOT EXISTS user_favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    forum_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_favorite (user_id, forum_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE
);

-- Tabla de favoritos de venues (única)
CREATE TABLE IF NOT EXISTS user_venue_favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    venue_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_venue_favorite (user_id, venue_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);

-- Tabla para foros guardados
CREATE TABLE IF NOT EXISTS saved_forums (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    forum_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (forum_id) REFERENCES forums(id),
    UNIQUE KEY unique_save (user_id, forum_id)
);

-- Insertar el rol de administrador solo si no existe
INSERT INTO roles (name, description)
SELECT 'admin', 'Administrador del sistema'
WHERE NOT EXISTS (
    SELECT * FROM roles WHERE name = 'admin'
);

-- Primero eliminamos el usuario admin existente
DELETE FROM users WHERE username = 'admin';

-- Insertamos el usuario admin con la contraseña hasheada correctamente
-- La contraseña es 'admin123' hasheada con bcrypt
INSERT INTO users (username, email, password)
VALUES ('admin', 'admin@forodisco.com', '$2b$10$PJxWBN7JyPbgq9LZHZxoku2vFk.39aF/3y5c.QA1zBxK5HNBi4W8K');