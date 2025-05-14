// Script para manejar la autenticación y estado de sesión
// Variables globales para la autenticación
// Las exponemos en window para que otros scripts puedan acceder a ellas
window.isAuthenticated = false;
window.currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar
    init();
    
    async function init() {
        console.log('Inicializando auth.js...');
        
        // Verificar estado de autenticación
        await checkAuth();
        
        // Actualizar UI según estado
        updateAuthUI();
        
        // Configurar eventos
        setupEventListeners();
        
        // Log para depuración
        console.log('Estado de autenticación:', { isAuthenticated: window.isAuthenticated, currentUser: window.currentUser });
    }
    
    function setupEventListeners() {
        // Si existe el botón de logout, configurar evento
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                logoutUser();
            });
        }
    }
});

// Función global para cerrar sesión
window.logoutUser = function() {
    try {
        // Intentar cerrar sesión con la API primero
        fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        })
        .then(response => {
            console.log('Respuesta de API logout:', response.status);
            // Independientemente de la respuesta de la API, también limpiar localStorage
            clearLocalSession();
        })
        .catch(error => {
            console.warn('Error al cerrar sesión con API:', error);
            // Si falla la API, al menos limpiar localStorage
            clearLocalSession();
        });
    } catch (error) {
        console.error('Error general al cerrar sesión:', error);
        clearLocalSession();
    }
};

function clearLocalSession() {
    // Modificar el estado de autenticación en localStorage
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (user) {
        user.authenticated = false;
        localStorage.setItem('currentUser', JSON.stringify(user));
    }
    
    // Actualizar variables globales
    window.isAuthenticated = false;
    window.currentUser = null;
    
    console.log('Sesión cerrada correctamente');
    
    // Actualizar UI
    updateAuthUI();
    
    // Redirigir a la página principal
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

// Función para verificar el estado de autenticación
async function checkAuth() {
    try {
        // Primero intentar verificar con la API
        const response = await fetch('/api/check-auth', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                // Usuario autenticado según la API
                window.isAuthenticated = true;
                window.currentUser = {
                    id: data.userId,
                    username: data.username,
                    role: data.role || 'user',
                    authenticated: true
                };
                
                // Actualizar también localStorage para mantener sincronizado
                localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
                
                console.log('Usuario autenticado desde API:', window.currentUser);
                return true;
            }
        }
        
        // Si la API falla o dice que no está autenticado, verificar localStorage
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (storedUser && storedUser.authenticated) {
            window.isAuthenticated = true;
            window.currentUser = storedUser;
            console.log('Usuario autenticado desde localStorage:', window.currentUser);
            return true;
        }
        
        // No autenticado en ninguna fuente
        window.isAuthenticated = false;
        window.currentUser = null;
        console.log('Usuario no autenticado');
        return false;
        
    } catch (error) {
        console.warn('Error al verificar autenticación con API, usando localStorage:', error);
        
        // Verificar en localStorage como respaldo
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (storedUser && storedUser.authenticated) {
            window.isAuthenticated = true;
            window.currentUser = storedUser;
            console.log('Usuario autenticado desde localStorage (tras error API):', window.currentUser);
            return true;
        }
        
        // No autenticado
        window.isAuthenticated = false;
        window.currentUser = null;
        console.log('Usuario no autenticado (tras error)');
        return false;
    }
}

// Función para actualizar la interfaz de usuario según el estado de autenticación
function updateAuthUI() {
    // Actualizar las variables globales con la información más reciente
    if (!window.currentUser) {
        window.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    }
    window.isAuthenticated = window.currentUser && window.currentUser.authenticated;
    
    console.log('Actualizando UI con estado:', { isAuthenticated: window.isAuthenticated, currentUser: window.currentUser });
    
    // Elementos de la interfaz de usuario
    const userInfoElement = document.getElementById('userInfo');
    const authButtonsElement = document.getElementById('authButtons');
    const usernameDisplayElement = document.getElementById('usernameDisplay');
    
    if (window.isAuthenticated && window.currentUser) {
        // Usuario autenticado: mostrar información del usuario y ocultar botones de autenticación
        if (userInfoElement) {
            userInfoElement.style.display = 'flex';
        }
        if (authButtonsElement) {
            authButtonsElement.style.display = 'none';
        }
        if (usernameDisplayElement) {
            usernameDisplayElement.textContent = window.currentUser.username || 'Usuario';
        }
        
        // Actualizar el saludo en la barra de navegación
        const welcomeElement = document.querySelector('.user-info span');
        if (welcomeElement) {
            welcomeElement.innerHTML = `Bienvenido, <span class="username" id="usernameDisplay">${window.currentUser.username}</span>`;
        }
        
        // Ya no añadimos el botón "Mi Perfil" aquí, ya que está incluido en el HTML
    } else {
        // Usuario no autenticado: ocultar información del usuario y mostrar botones de autenticación
        if (userInfoElement) {
            userInfoElement.style.display = 'none';
        }
        if (authButtonsElement) {
            authButtonsElement.style.display = 'flex';
        }
    }
    
    // Resaltar el enlace de la página actual en la barra de navegación
    highlightCurrentPage();
}

// Función para resaltar el enlace de la página actual en la barra de navegación
function highlightCurrentPage() {
    // Obtener la ruta de la página actual
    const currentPath = window.location.pathname;
    const pageName = currentPath.split('/').pop();
    
    console.log('Página actual:', pageName);
    
    // Obtener todos los enlaces de la barra de navegación
    const navLinks = document.querySelectorAll('.nav-links a');
    
    // Eliminar la clase 'active' de todos los enlaces
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Añadir la clase 'active' al enlace correspondiente a la página actual
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === pageName || 
            (pageName === '' && linkHref === 'index.html') || 
            (pageName === '/' && linkHref === 'index.html')) {
            link.classList.add('active');
            console.log('Enlace resaltado:', linkHref);
        }
    });
}

// Función para guardar un foro en el perfil del usuario
window.saveForum = async function(forumId, forumName) {
    // Verificar si el usuario está autenticado
    if (!window.isAuthenticated || !window.currentUser) {
        // Guardar el foro pendiente para después de iniciar sesión
        localStorage.setItem('pendingForumSave', forumId);
        
        // Redirigir a login con parámetro de acción
        window.location.href = `login.html?redirect=index.html&action=saveForum`;
        return;
    }
    
    // Intentar guardar en la base de datos primero
    try {
        const response = await fetch('/api/user/save-forum', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: window.currentUser.id,
                forumId: forumId
            }),
            credentials: 'include'
        });
        
        if (response.ok) {
            alert('Foro guardado correctamente en tu perfil');
            return;
        }
    } catch (error) {
        console.warn('Error al guardar foro en API, usando localStorage:', error);
    }
    
    // Si la API falla, guardar en localStorage como respaldo
    try {
        const savedForums = JSON.parse(localStorage.getItem('savedForums') || '[]');
        if (!savedForums.includes(forumId)) {
            savedForums.push(forumId);
            localStorage.setItem('savedForums', JSON.stringify(savedForums));
            alert('Foro guardado localmente en tu perfil');
        } else {
            alert('Este foro ya está guardado en tu perfil');
        }
    } catch (localError) {
        console.error('Error al guardar foro en localStorage:', localError);
        alert('Error al guardar el foro. Por favor, intenta de nuevo.');
    }
};

// Función para manejar foros pendientes por guardar
window.handlePendingForumSave = function(params) {
    if (!params) return;
    
    const pendingForumSave = localStorage.getItem('pendingForumSave');
    const action = params.get('action');
    
    if (pendingForumSave && action === 'saveForum') {
        console.log('Hay un foro pendiente por guardar:', pendingForumSave);
        
        // Guardar el foro en la lista de foros guardados
        const savedForums = JSON.parse(localStorage.getItem('savedForums') || '[]');
        if (!savedForums.includes(pendingForumSave)) {
            savedForums.push(pendingForumSave);
            localStorage.setItem('savedForums', JSON.stringify(savedForums));
            console.log('Foro guardado exitosamente:', pendingForumSave);
            
            // También intentar guardar en la base de datos si el usuario está autenticado
            if (window.isAuthenticated && window.currentUser) {
                fetch('/api/user/save-forum', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: window.currentUser.id,
                        forumId: pendingForumSave
                    }),
                    credentials: 'include'
                }).catch(error => {
                    console.warn('Error al sincronizar foro guardado con API:', error);
                });
            }
        }
        
        // Limpiar el foro pendiente
        localStorage.removeItem('pendingForumSave');
    }
};

// Función para verificar la autenticación en la página de foros
window.checkForumsAuth = function() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isAuthenticated = currentUser && currentUser.authenticated;
    
    // Mostrar/ocultar elementos según el estado de autenticación
    const userInfoElement = document.getElementById('userInfo');
    const authButtonsElement = document.getElementById('authButtons');
    
    if (userInfoElement && authButtonsElement) {
        if (isAuthenticated) {
            // Usuario autenticado
            userInfoElement.style.display = 'flex';
            authButtonsElement.style.display = 'none';
            
            // Mostrar el nombre de usuario
            const usernameDisplay = document.getElementById('usernameDisplay');
            if (usernameDisplay) {
                usernameDisplay.textContent = currentUser.username || 'Usuario';
            }
            
            // Cargar los foros guardados (si existe la función)
            if (typeof loadSavedForums === 'function') {
                loadSavedForums();
            }
        } else {
            // Usuario no autenticado
            userInfoElement.style.display = 'none';
            authButtonsElement.style.display = 'flex';
            
            // Mostrar mensaje de que debe iniciar sesión
            const forumsContainer = document.getElementById('forumsContainer');
            if (forumsContainer) {
                forumsContainer.innerHTML = `
                    <div class="login-required">
                        <h3>Inicia sesión para ver tus foros guardados</h3>
                        <p>Necesitas iniciar sesión para acceder a tus foros guardados.</p>
                        <div class="login-buttons">
                            <a href="login.html" class="btn-login">Iniciar sesión</a>
                            <a href="register.html" class="btn-register">Registrarse</a>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    return isAuthenticated;
};