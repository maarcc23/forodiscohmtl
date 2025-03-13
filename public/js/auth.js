// Script para manejar la autenticación y estado de sesión
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    // Elementos DOM
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Variables globales
    let isAuthenticated = false;
    let currentUser = null;

    // Inicializar
    init();
    
    async function init() {
        // Verificar estado de autenticación
        const authStatus = await checkAuthStatus();
        
        // Actualizar UI según estado
        updateAuthUI(authStatus);
        
        // Configurar eventos
        setupEventListeners();
        
        // Verificar si hay un parámetro de redirección en la URL
        handleRedirectParam();
    }
    
    // Verificar estado de autenticación con el servidor
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/check-auth', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                return { authenticated: false };
            }
            
            const data = await response.json();
            
            // Si está autenticado, obtener datos del usuario
            if (data.authenticated) {
                const userResponse = await fetch('/api/auth/current-user', {
                    credentials: 'include'
                });
                
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.success) {
                        // Guardar datos del usuario en localStorage
                        localStorage.setItem('currentUser', JSON.stringify(userData.user));
                        return { 
                            authenticated: true, 
                            user: userData.user 
                        };
                    }
                }
            }
            
            return data;
        } catch (error) {
            console.error('Error al verificar estado de autenticación:', error);
            return { authenticated: false };
        }
    }
    
    // Función para verificar autenticaciónn
function checkAuth() {
    console.log('Verificando autenticación...');
    
    // Obtener información del usuario desde localStorage
    currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    isAuthenticated = currentUser && currentUser.authenticated;
    
    console.log('Estado de autenticación:', { isAuthenticated, currentUser });
    
    // Actualizar UI según el estado de autenticación
    updateAuthUI();
    
    return isAuthenticated;
}
    
    // Actualizar interfaz según estado de autenticación
    function updateAuthUI(authStatus) {
        if (authStatus.authenticated) {
            // Usuario autenticado
            if (authButtons) authButtons.style.display = 'none';
            if (userInfo) {
                userInfo.style.display = 'flex';
                
                // Mostrar nombre de usuario
                const user = authStatus.user || JSON.parse(localStorage.getItem('currentUser')) || {};
                if (usernameDisplay) {
                    usernameDisplay.textContent = user.username || user.email || 'Usuario';
                }
                
                // Mostrar opciones según rol
                const isAdmin = user.role === 'admin';
                const adminLink = document.getElementById('adminLink');
                if (adminLink) {
                    adminLink.style.display = isAdmin ? 'block' : 'none';
                }
            }
        } else {
            // Usuario no autenticado
            if (authButtons) authButtons.style.display = 'flex';
            if (userInfo) userInfo.style.display = 'none';
            
            // Limpiar localStorage
            localStorage.removeItem('currentUser');
        }
    }
    
    // Configurar event listeners
    function setupEventListeners() {
        // Botón de logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
        
        // Botones de login/register en modales
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }
    }
    
    // Manejar parámetro de redirección
    function handleRedirectParam() {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        
        if (redirect) {
            // Guardar redirección para después del login
            sessionStorage.setItem('redirectAfterLogin', redirect);
        }
    }
    
    // Función de login
    async function handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorElement = document.getElementById('loginError');
        
        if (!email || !password) {
            if (errorElement) errorElement.textContent = 'Por favor, completa todos los campos';
            return;
        }
        
        try {
            // Deshabilitar botón y mostrar cargando
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = 'Iniciando sesión...';
            }
            
            // Enviar petición
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Login exitoso
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                
                // Redirigir según corresponda
                const redirect = sessionStorage.getItem('redirectAfterLogin');
                if (redirect) {
                    sessionStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirect;
                } else {
                    window.location.href = '/index.html';
                }
            } else {
                // Error de login
                if (errorElement) errorElement.textContent = data.message || 'Error al iniciar sesión';
                
                // Restaurar botón
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Iniciar sesión';
                }
            }
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            if (errorElement) errorElement.textContent = 'Error al conectar con el servidor';
            
            // Restaurar botón
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Iniciar sesión';
            }
        }
    }
    
    // Función de registro
    async function handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorElement = document.getElementById('registerError');
        
        // Validaciones
        if (!username || !email || !password || !confirmPassword) {
            if (errorElement) errorElement.textContent = 'Por favor, completa todos los campos';
            return;
        }
        
        if (password !== confirmPassword) {
            if (errorElement) errorElement.textContent = 'Las contraseñas no coinciden';
            return;
        }
        
        try {
            // Deshabilitar botón y mostrar cargando
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = 'Registrando...';
            }
            
            // Enviar petición
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Registro exitoso
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                
                // Redirigir según corresponda
                const redirect = sessionStorage.getItem('redirectAfterLogin');
                if (redirect) {
                    sessionStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirect;
                } else {
                    window.location.href = '/index.html';
                }
            } else {
                // Error de registro
                if (errorElement) errorElement.textContent = data.message || 'Error al registrarse';
                
                // Restaurar botón
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Registrarse';
                }
            }
        } catch (error) {
            console.error('Error al registrarse:', error);
            if (errorElement) errorElement.textContent = 'Error al conectar con el servidor';
            
            // Restaurar botón
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Registrarse';
            }
        }
    }
    
    // Función de logout
   // Función de logout
async function logout() {
    try {
        console.log('Cerrando sesión...');
        
        // Limpiar localStorage
        localStorage.removeItem('currentUser');
        
        // Opcional: eliminar datos guardados
        localStorage.removeItem('savedForums');
        localStorage.removeItem('savedVenues');
        
        // Actualizar UI
        if (authButtons) authButtons.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'none';
        
        // Mostrar notificación si existe la función
        if (typeof showNotification === 'function') {
            showNotification('Has cerrado sesión correctamente');
        }
        
        // Redireccionar a la página de login
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        
        // En caso de error, limpiar localStorage de todas formas
        localStorage.removeItem('currentUser');
        
        // Redireccionar a la página de login
        window.location.href = '/login.html';
    }
}
    
    // Función para verificar autenticación antes de guardar
    function requireAuth(redirectPath = null) {
        console.log('Verificando autenticación para acción protegida...');
        
        // Verificar autenticación
        if (!checkAuth()) {
            console.log('Usuario no autenticado, redirigiendo a login');
            
            // Redireccionar a la página de login
            window.location.href = '/login.html';
            return false;
        }
        
        return true;
    }
    
    // Verificar autenticación al cargar la página
    checkAuth();
    
    // Exponer funciones globalmente
    window.checkAuth = checkAuth;
    window.logout = logout;
    window.requireAuth = requireAuth;
    
    // Función para mostrar modal de login
    window.showLoginModal = function() {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            window.location.href = '/login.html';
        }
    };
    
    // Función para mostrar modal de registro
    window.showRegisterModal = function() {
        const registerModal = document.getElementById('registerModal');
        if (registerModal) {
            registerModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            window.location.href = '/register.html';
        }
    };
    
    // Función para cerrar modales
    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        if (e.target === registerModal) {
            registerModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Estilos adicionales
    const style = document.createElement('style');
    style.textContent = `
        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .username {
            color: #ff4b6e;
            font-weight: 500;
        }
        
        .dropdown-menu {
            position: absolute;
            top: 100%;
            right: 0;
            background-color: #1a1a1a;
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            padding: 10px 0;
            min-width: 150px;
            z-index: 100;
            display: none;
        }
        
        .dropdown-menu.show {
            display: block;
            animation: fadeIn 0.2s ease;
        }
        
        .dropdown-item {
            padding: 8px 15px;
            color: white;
            display: block;
            text-decoration: none;
            transition: background-color 0.3s ease;
        }
        
        .dropdown-item:hover {
            background-color: #333;
        }
        
        .dropdown-divider {
            height: 1px;
            background-color: #333;
            margin: 5px 0;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
});
