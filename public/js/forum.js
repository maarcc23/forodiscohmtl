// Variables globales
// Nota: isAuthenticated y currentUser ya están definidas en auth.js
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

// Función para guardar/eliminar foros - usando la base de datos
async function saveForum(forumId, button) {
    console.log('saveForum llamado con ID:', forumId);
    
    try {
        // Verificar autenticación usando localStorage
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        console.log('Estado de autenticación:', currentUser);
        
        if (!currentUser || !currentUser.authenticated) {
            console.log('Usuario no autenticado, redirigiendo a login');
            
            // Guardar el ID del foro que se estaba intentando guardar
            localStorage.setItem('pendingForumSave', forumId);
            
            // Redireccionar a la página de login con parámetro de redirección
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}&action=saveForum`;
            return;
        }
        
        // Mostrar indicador de carga en el botón
        const originalButtonText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
        
        // Determinar si ya está guardado
        const isSaved = button.classList.contains('saved');
        console.log('Estado actual del foro:', isSaved ? 'guardado' : 'no guardado');
        
        if (isSaved) {
            console.log('Eliminando foro guardado...');
            
            // Llamar al endpoint para eliminar el foro guardado
            const response = await fetch(`/api/user/forums/${forumId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Actualizar UI
                button.classList.remove('saved');
                button.innerHTML = '<i class="fas fa-star"></i> Guardar';
                showNotification('Foro eliminado de tus guardados');
                
                // Actualizar la lista local de foros guardados
                savedForums = savedForums.filter(id => id !== parseInt(forumId) && id !== forumId);
            } else {
                throw new Error(data.message || 'Error al eliminar el foro guardado');
            }
        } else {
            console.log('Guardando foro...');
            
            // Llamar al endpoint para guardar el foro
            const response = await fetch('/api/user/forums', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ forumId }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Actualizar UI
                button.classList.add('saved');
                button.innerHTML = '<i class="fas fa-star"></i> Guardado';
                showNotification('Foro guardado correctamente');
                
                // Actualizar la lista local de foros guardados
                if (!savedForums.includes(parseInt(forumId)) && !savedForums.includes(forumId)) {
                    savedForums.push(parseInt(forumId));
                }
            } else {
                throw new Error(data.message || 'Error al guardar el foro');
            }
        }
        
        console.log('Foros guardados actualizados:', savedForums);
        
    } catch (error) {
        console.error('Error al guardar/eliminar foro:', error);
        button.innerHTML = originalButtonText;
        button.disabled = false;
        showNotification('Error al procesar tu solicitud: ' + error.message, 'error');
    } finally {
        // Restaurar el estado del botón después de un tiempo
        setTimeout(() => {
            button.disabled = false;
        }, 500);
    }
}

// Función para ver un foro
function viewForum(forumId) {
    // Redirigir a la página de detalle del foro
    window.location.href = `/foro.html?id=${forumId}`;
}

// Función para cargar foros guardados desde la base de datos
async function loadSavedForums() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        
        // Si no hay usuario autenticado, retornar array vacío
        if (!currentUser || !currentUser.authenticated) {
            console.log('No hay usuario autenticado para cargar foros guardados');
            savedForums = [];
            return [];
        }
        
        // Llamar al endpoint para obtener los foros guardados del usuario
        const response = await fetch('/api/user/forums', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.forums) {
            // Extraer solo los IDs de los foros
            const forumIds = data.forums.map(forum => forum.id);
            console.log('Foros guardados cargados desde la base de datos:', forumIds);
            
            // Actualizar la variable global
            savedForums = forumIds;
            return forumIds;
        } else {
            console.warn('No se pudieron cargar los foros guardados:', data.message);
            savedForums = [];
            return [];
        }
    } catch (error) {
        console.error('Error al cargar foros guardados:', error);
        savedForums = [];
        return [];
    }
}

// Función para actualizar la UI de los foros guardados
function updateSavedForumsUI() {
    document.querySelectorAll('.forum-card').forEach(card => {
        const cardForumId = parseInt(card.dataset.forumId);
        const saveBtn = card.querySelector('.btn-save');
        
        if (saveBtn) {
            if (savedForums.includes(cardForumId)) {
                saveBtn.classList.add('saved');
                saveBtn.innerHTML = '<i class="fas fa-star"></i> Guardado';
            } else {
                saveBtn.classList.remove('saved');
                saveBtn.innerHTML = '<i class="fas fa-star"></i> Guardar';
            }
        }
    });
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM cargado - Inicializando script de foros');
    
    // Verificar autenticación
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        const isAuthenticated = data.authenticated;
        console.log('Estado de autenticación:', isAuthenticated);
        
        // Cargar foros guardados si el usuario está autenticado
        if (isAuthenticated) {
            await loadSavedForums();
            updateSavedForumsUI();
        }
    } catch (error) {
        console.error('Error al verificar autenticación:', error);
    }
});

// Exponer funciones globalmente
window.saveForum = saveForum;
window.viewForum = viewForum;
window.showNotification = showNotification;
window.loadSavedForums = loadSavedForums;
window.updateSavedForumsUI = updateSavedForumsUI;