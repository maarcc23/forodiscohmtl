-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS forodisco;
USE forodisco;

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Insertar roles básicos
INSERT INTO roles (name, description) VALUES
('admin', 'Administrador principal del sistema'),
('delegado', 'Administrador de discoteca/bar'),
('usuario', 'Usuario normal del sistema');

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Tabla de discotecas/bares
CREATE TABLE IF NOT EXISTS venues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    contact_info TEXT,
    admin_id INT,
    follower_count INT DEFAULT 0,
    rating DECIMAL(3,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- Tabla de foros
CREATE TABLE IF NOT EXISTS forums (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venue_id INT,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    created_by INT NOT NULL,
    is_trending BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venues(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabla de seguimiento de foros por usuarios
CREATE TABLE IF NOT EXISTS user_forums (
    user_id INT NOT NULL,
    forum_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, forum_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (forum_id) REFERENCES forums(id)
);

-- Tabla de discusiones/posts
CREATE TABLE IF NOT EXISTS discussions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    forum_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    created_by INT NOT NULL,
    interaction_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (forum_id) REFERENCES forums(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabla de eventos
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venue_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATETIME NOT NULL,
    created_by INT NOT NULL,
    interaction_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venues(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabla de comentarios (puede ser usado tanto en discusiones como en eventos)
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    user_id INT NOT NULL,
    discussion_id INT,
    event_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (discussion_id) REFERENCES discussions(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    CHECK (discussion_id IS NOT NULL OR event_id IS NOT NULL)
);

-- Tabla de seguidores de venues
CREATE TABLE IF NOT EXISTS venue_followers (
    user_id INT NOT NULL,
    venue_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, venue_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (venue_id) REFERENCES venues(id)
);
