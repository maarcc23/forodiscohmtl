// Script para manejar la autenticación y estado de sesión
// Variables globales - declaradas antes de cualquier uso
let isAuthenticated = false;
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar
    init();
    
    async function init() {
        // Verificar estado de autenticación
        await checkAuth();
        
        // Actualizar UI según estado
        updateAuthUI();
        
        // Configurar eventos
        setupEventListeners();
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
    isAuthenticated = false;
    currentUser = null;
    
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
                isAuthenticated = true;
                currentUser = {
                    id: data.userId,
                    username: data.username
                };
                
                // Actualizar también localStorage para mantener sincronizado
                localStorage.setItem('currentUser', JSON.stringify({
                    id: data.userId,
                    username: data.username,
                    authenticated: true
                }));
                
                console.log('Usuario autenticado desde API:', currentUser);
                return true;
            }
        }
        
        // Si la API falla o dice que no está autenticado, verificar localStorage
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (storedUser && storedUser.authenticated) {
            isAuthenticated = true;
            currentUser = storedUser;
            console.log('Usuario autenticado desde localStorage:', currentUser);
            return true;
        }
        
        // No autenticado en ninguna fuente
        isAuthenticated = false;
        currentUser = null;
        console.log('Usuario no autenticado');
        return false;
        
    } catch (error) {
        console.warn('Error al verificar autenticación con API, usando localStorage:', error);
        
        // Verificar en localStorage como respaldo
        const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (storedUser && storedUser.authenticated) {
            isAuthenticated = true;
            currentUser = storedUser;
            console.log('Usuario autenticado desde localStorage (tras error API):', currentUser);
            return true;
        }
        
        // No autenticado
        isAuthenticated = false;
        currentUser = null;
        console.log('Usuario no autenticado (tras error)');
        return false;
    }
}

// Función para actualizar la interfaz de usuario según el estado de autenticación
function updateAuthUI() {
    // Actualizar las variables globales con la información más reciente
    if (!currentUser) {
        currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    }
    isAuthenticated = currentUser && currentUser.authenticated;
    
    console.log('Actualizando UI con estado:', { isAuthenticated, currentUser });
    
    // Elementos de la interfaz de usuario
    const userInfoElement = document.getElementById('userInfo');
    const authButtonsElement = document.getElementById('authButtons');
    const usernameDisplayElement = document.getElementById('usernameDisplay');
    
    if (isAuthenticated && currentUser) {
        // Usuario autenticado: mostrar información del usuario y ocultar botones de autenticación
        if (userInfoElement) {
            userInfoElement.style.display = 'flex';
        }
        if (authButtonsElement) {
            authButtonsElement.style.display = 'none';
        }
        if (usernameDisplayElement) {
            usernameDisplayElement.textContent = currentUser.username || 'Usuario';
        }
        
        // Verificar si hay botón de Mi Perfil y agregarlo si no existe
        const navLinks = document.querySelector('.nav-links');
        if (navLinks && !document.querySelector('.nav-links a[href="perfil.html"]')) {
            const perfilLink = document.createElement('a');
            perfilLink.href = 'perfil.html';
            //perfilLink.textContent = 'Mi Perfil';
            perfilLink.classList.add('nav-link');
            navLinks.appendChild(perfilLink);
        }
    } else {
        // Usuario no autenticado: ocultar información del usuario y mostrar botones de autenticación
        if (userInfoElement) {
            userInfoElement.style.display = 'none';
        }
        if (authButtonsElement) {
            authButtonsElement.style.display = 'flex';
        }
    }
}

// Función para guardar un foro en el perfil del usuario
window.saveForum = async function(forumId, forumName) {
    // Verificar si el usuario está autenticado
    if (!isAuthenticated || !currentUser) {
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
                userId: currentUser.id,
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
            if (isAuthenticated && currentUser) {
                fetch('/api/user/save-forum', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: currentUser.id,
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