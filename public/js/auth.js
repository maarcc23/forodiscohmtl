// Función para verificar el estado de la sesión
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/check-auth', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error checking auth status:', error);
        return { loggedIn: false };
    }
}

// Función para actualizar la interfaz según el estado de autenticación
function updateAuthUI() {
    const user = JSON.parse(localStorage.getItem('user'));
    const userSection = document.getElementById('userSection');
    const authButtons = document.getElementById('authButtons');
    const usernameElement = document.getElementById('username');

    if (user) {
        // Usuario autenticado
        if (userSection) userSection.style.display = 'flex';
        if (authButtons) authButtons.style.display = 'none';
        if (usernameElement) usernameElement.textContent = user.email || 'Usuario';
    } else {
        // Usuario no autenticado
        if (userSection) userSection.style.display = 'none';
        if (authButtons) authButtons.style.display = 'flex';
    }
}

// Función para cerrar sesión
function logout() {
    localStorage.removeItem('user');
    updateAuthUI();
    // Redirigir a la página principal
    window.location.href = '/index.html';
}

// Actualizar la UI cuando se carga la página
document.addEventListener('DOMContentLoaded', updateAuthUI);

// Actualizar la UI cuando cambia el almacenamiento local
window.addEventListener('storage', updateAuthUI);

// Estilo adicional para el nombre de usuario
const style = document.createElement('style');
style.textContent = `
    .user-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .username {
        color: white;
        font-size: 0.9rem;
    }
`;
document.head.appendChild(style);
