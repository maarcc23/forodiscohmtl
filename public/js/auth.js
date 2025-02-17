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

// Función para actualizar la UI basada en el estado de autenticación
async function updateAuthUI() {
    try {
        const response = await fetch('/api/check-auth', {
            credentials: 'include'
        });
        const data = await response.json();
        
        const authButtons = document.querySelector('.auth-buttons');
        
        if (data.authenticated) {
            // Usuario autenticado - Mostrar nombre de usuario y botón de logout
            authButtons.innerHTML = `
                <div class="user-info">
                    <span class="username">${data.username}</span>
                    <button onclick="logout()" class="btn btn-ghost">Cerrar sesión</button>
                </div>
            `;
        } else {
            // Usuario no autenticado - Mostrar botones de login y registro
            authButtons.innerHTML = `
                <a href="login.html" class="btn btn-ghost">Iniciar sesión</a>
                <a href="register.html" class="btn btn-primary">Registrarse</a>
            `;
        }
    } catch (error) {
        console.error('Error al verificar autenticación:', error);
    }
}

// Función para manejar el logout
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Actualizar la UI después del logout
            await updateAuthUI();
            
            // Si estamos en una página que requiere autenticación, redirigir al inicio
            const protectedPages = ['foros.html', 'perfil.html'];
            const currentPage = window.location.pathname.split('/').pop();
            
            if (protectedPages.includes(currentPage)) {
                window.location.href = 'index.html';
            }
        } else {
            console.error('Error al cerrar sesión:', data.message);
        }
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

// Verificar el estado de autenticación cuando se carga la página
document.addEventListener('DOMContentLoaded', updateAuthUI);

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
