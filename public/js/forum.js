// Variables globales
let isAuthenticated = false;
let savedForums = [];
let venues = [];

// Función para mostrar notificaciones
function showNotification(message, type = 'success') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Añadir al DOM
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Función para guardar/eliminar foros - usando localStorage como alternativa
async function saveForum(forumId, button) {
    console.log('saveForum llamado con ID:', forumId);
    
    try {
        // Verificar autenticación usando localStorage
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        console.log('Estado de autenticación:', currentUser);
        
        if (!currentUser || !currentUser.authenticated) {
            console.log('Usuario no autenticado, redirigiendo a login');
            
            // Redireccionar a la página de login
            window.location.href = '/login.html';
            return;
        }
        
        // Mostrar indicador de carga en el botón
        const originalButtonText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
        
        // Determinar si ya está guardado
        const isSaved = button.classList.contains('saved');
        console.log('Estado actual del foro:', isSaved ? 'guardado' : 'no guardado');
        
        // Obtener foros guardados del localStorage
        let savedForumsLocal = JSON.parse(localStorage.getItem('savedForums') || '[]');
        
        if (isSaved) {
            console.log('Eliminando foro guardado del localStorage...');
            // Eliminar el foro de los guardados
            savedForumsLocal = savedForumsLocal.filter(id => id !== parseInt(forumId) && id !== forumId);
            localStorage.setItem('savedForums', JSON.stringify(savedForumsLocal));
            
            // Actualizar UI
            button.classList.remove('saved');
            button.innerHTML = '<i class="fas fa-star"></i> Guardar';
            showNotification('Foro eliminado de tus guardados');
        } else {
            console.log('Guardando foro en localStorage...');
            // Añadir el foro a los guardados
            if (!savedForumsLocal.includes(parseInt(forumId)) && !savedForumsLocal.includes(forumId)) {
                savedForumsLocal.push(forumId);
                localStorage.setItem('savedForums', JSON.stringify(savedForumsLocal));
            }
            
            // Actualizar UI
            button.classList.add('saved');
            button.innerHTML = '<i class="fas fa-star"></i> Guardado';
            showNotification('Foro guardado correctamente');
        }
        
        // Actualizar la variable global
        savedForums = savedForumsLocal;
        console.log('Foros guardados actualizados:', savedForums);
        
        // Restaurar el botón
        button.disabled = false;
        
    } catch (error) {
        console.error('Error al guardar/eliminar foro:', error);
        // Restaurar el botón en caso de error
        if (button) {
            button.disabled = false;
            button.innerHTML = button.classList.contains('saved') ? 
                '<i class="fas fa-star"></i> Guardado' : 
                '<i class="fas fa-star"></i> Guardar';
        }
        showNotification('Error al procesar tu solicitud', 'error');
    }
}

// Función para ver un foro
function viewForum(forumId) {
    // Redirigir a la página de detalle del foro
    window.location.href = `/foro.html?id=${forumId}`;
}

// Función para cargar foros guardados desde localStorage
function loadSavedForumsFromLocalStorage() {
    try {
        const savedForumsLocal = JSON.parse(localStorage.getItem('savedForums') || '[]');
        savedForums = savedForumsLocal;
        console.log('Foros guardados cargados desde localStorage:', savedForums);
        return savedForums;
    } catch (error) {
        console.error('Error al cargar foros guardados desde localStorage:', error);
        return [];
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM cargado - Inicializando script de foros');
    
    // Verificar autenticación
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        isAuthenticated = data.authenticated;
        console.log('Estado de autenticación:', isAuthenticated);
        
        // Cargar foros guardados si el usuario está autenticado
        if (isAuthenticated) {
            // Cargar desde localStorage en lugar de la API
            loadSavedForumsFromLocalStorage();
            
            // Actualizar la UI para mostrar los foros guardados
            document.querySelectorAll('.forum-card').forEach(card => {
                const cardForumId = parseInt(card.dataset.forumId);
                const saveBtn = card.querySelector('.btn-save');
                
                if (saveBtn && savedForums.includes(cardForumId)) {
                    saveBtn.classList.add('saved');
                    saveBtn.innerHTML = '<i class="fas fa-star"></i> Guardado';
                }
            });
        }
    } catch (error) {
        console.error('Error al verificar autenticación:', error);
    }
});

// Exponer funciones globalmente
window.saveForum = saveForum;
window.viewForum = viewForum;
window.showNotification = showNotification;
window.loadSavedForumsFromLocalStorage = loadSavedForumsFromLocalStorage;