document.addEventListener('DOMContentLoaded', function() {
    const userForumsContainer = document.getElementById('userForums');

    // Verificar autenticación
    async function checkAuth() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            if (!data.authenticated) {
                window.location.href = '/login.html?redirect=/foros.html';
                return false;
            }
            return data.authenticated;
        } catch (error) {
            console.error('Error al verificar autenticación:', error);
            return false;
        }
    }

    // Función para mostrar notificaciones
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Cargar los foros del usuario
    async function loadUserForums() {
        try {
            const response = await fetch('/api/user/forums');
            const data = await response.json();

            if (data.success) {
                userForumsContainer.innerHTML = ''; // Limpiar contenedor

                if (data.forums.length === 0) {
                    userForumsContainer.innerHTML = `
                        <div class="text-center w-100">
                            <h3 style="color: #333;">No tienes foros guardados</h3>
                            <p style="color: #666;">Explora foros en la página principal y guárdalos para verlos aquí</p>
                            <a href="index.html" class="btn btn-primary">Explorar Foros</a>
                        </div>
                    `;
                    return;
                }

                data.forums.forEach(forum => {
                    const forumCard = document.createElement('div');
                    forumCard.className = 'forum-card';
                    forumCard.dataset.forumId = forum.id;
                    forumCard.innerHTML = `
                        <h3>${forum.title}</h3>
                        <p>${forum.description}</p>
                        <div class="forum-info">
                            <span class="location">📍 ${forum.location || 'Ubicación no disponible'}</span>
                            <span class="members">👥 ${forum.member_count || 0} miembros</span>
                        </div>
                        <div class="forum-actions">
                            <button class="favorite-btn active" onclick="removeForum(${forum.id}, this)">★ Guardado</button>
                            <button class="view-forum-btn" onclick="viewForum(${forum.id})">Ver Foro</button>
                        </div>
                    `;
                    userForumsContainer.appendChild(forumCard);
                });
            }
        } catch (error) {
            console.error('Error al cargar foros:', error);
            showNotification('Error al cargar los foros. Por favor, intenta recargar la página.', 'error');
        }
    }

    // Función para eliminar un foro
    window.removeForum = async function(forumId, button) {
        try {
            const response = await fetch('/api/forums/favorite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ forumId })
            });

            const data = await response.json();
            
            if (data.success) {
                // Eliminar la tarjeta del foro con una animación
                const card = button.closest('.forum-card');
                card.style.opacity = '0';
                card.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    card.remove();
                    // Si no quedan foros, recargar la vista
                    if (userForumsContainer.children.length === 0) {
                        loadUserForums();
                    }
                }, 300);
                showNotification('Foro eliminado de guardados');
            }
        } catch (error) {
            console.error('Error al eliminar foro:', error);
            showNotification('Error al eliminar el foro. Por favor, inténtalo de nuevo.', 'error');
        }
    };

    // Función para ver un foro
    window.viewForum = function(forumId) {
        // Por ahora solo mostramos un mensaje
        alert('Funcionalidad de ver foro en desarrollo');
    };

    // Inicializar
    checkAuth().then(isAuthenticated => {
        if (isAuthenticated) {
            loadUserForums();
        }
    });
});