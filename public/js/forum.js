document.addEventListener('DOMContentLoaded', function() {
    const exploreBtn = document.querySelector('.explore-forums-btn');
    const forosModal = document.getElementById('forosModal');
    const forumDetailView = document.getElementById('forumDetailView');
    const closeModalBtn = document.querySelector('.close-modal');
    let currentForumId = null;
    let currentUserId = null; // ID del usuario africa

    // Obtener el ID del usuario actual (africa)
    async function getCurrentUser() {
        try {
            const response = await fetch('/api/auth/current-user');
            const data = await response.json();
            if (data.success) {
                currentUserId = data.user.id;
            }
        } catch (error) {
            console.error('Error al obtener usuario actual:', error);
        }
    }

    // Verificar si el usuario está autenticado
    async function checkAuth() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            console.log('Estado de autenticación:', data); // Debug
            if (!data.authenticated) {
                window.location.href = '/login.html';
                return false;
            }
            return data.authenticated;
        } catch (error) {
            console.error('Error al verificar autenticación:', error);
            return false;
        }
    }

    // Mostrar modal de foros
    exploreBtn.addEventListener('click', () => {
        forosModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevenir scroll
        loadForumMembers(); // Cargar el número de miembros al abrir el modal
    });

    // Cerrar modal
    closeModalBtn.addEventListener('click', () => {
        forosModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restaurar scroll
    });

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === forosModal) {
            forosModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        if (e.target === forumDetailView) {
            forumDetailView.style.display = 'none';
        }
    });

    // Cargar número de miembros para cada foro
    async function loadForumMembers() {
        const forumCards = document.querySelectorAll('.forum-card');
        for (const card of forumCards) {
            const forumId = card.dataset.forumId;
            try {
                const response = await fetch(`/api/forums/${forumId}/members`);
                const data = await response.json();
                if (data.success) {
                    const memberCountEl = card.querySelector('.member-count');
                    if (memberCountEl) {
                        memberCountEl.textContent = data.memberCount;
                    }
                }
            } catch (error) {
                console.error('Error al cargar miembros:', error);
            }
        }
    }

    // Ver detalle del foro
    document.querySelectorAll('.view-forum-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const forumCard = e.target.closest('.forum-card');
            currentForumId = forumCard.dataset.forumId;
            forosModal.style.display = 'none';
            forumDetailView.style.display = 'block';
            loadForumComments(currentForumId);
        });
    });

    // Cargar comentarios del foro
    async function loadForumComments(forumId) {
        try {
            const response = await fetch(`/api/forums/${forumId}/comments`);
            const data = await response.json();
            if (data.success) {
                const commentsContainer = document.querySelector('.forum-comments');
                commentsContainer.innerHTML = ''; // Limpiar comentarios existentes
                data.comments.forEach(comment => {
                    addCommentToUI(comment);
                });
            }
        } catch (error) {
            console.error('Error al cargar comentarios:', error);
        }
    }

    // Función para guardar/eliminar foro
    async function toggleSaveForum(forumId, button) {
        try {
            const response = await fetch(`/api/forums/${forumId}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Actualizar el botón
                if (data.saved) {
                    button.textContent = '★ Guardado';
                    button.classList.add('saved');
                } else {
                    button.textContent = '☆ Guardar';
                    button.classList.remove('saved');
                }
                
                showNotification(data.message, 'success');
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            console.error('Error al guardar/eliminar foro:', error);
            showNotification('Error al gestionar el foro', 'error');
        }
    }

    // Event Listeners para botones de guardar
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!await checkAuth()) return;
            
            const forumCard = e.target.closest('.forum-card');
            const forumId = forumCard.dataset.forumId;
            toggleSaveForum(forumId, e.target);
        });
    });

    // Funcionalidad para comentarios
    async function addComment(forumId, content) {
        if (!currentUserId) {
            alert('Debes iniciar sesión para comentar');
            return;
        }

        try {
            const response = await fetch('/api/forums/comment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    forumId, 
                    content,
                    userId: currentUserId
                })
            });
            const data = await response.json();
            if (data.success) {
                addCommentToUI(data.comment);
            }
        } catch (error) {
            console.error('Error al añadir comentario:', error);
        }
    }

    // Actualizar UI
    function updateFavoriteUI(forumId, isFavorite) {
        document.querySelectorAll(`[data-forum-id="${forumId}"] .favorite-btn`).forEach(btn => {
            btn.classList.toggle('active', isFavorite);
            btn.innerHTML = isFavorite ? '★ Guardado' : '☆ Guardar';
        });
    }

    function updateMemberCount(forumId, count) {
        document.querySelectorAll(`[data-forum-id="${forumId}"] .member-count`).forEach(el => {
            el.textContent = count;
        });
    }

    function addCommentToUI(comment) {
        const commentsContainer = document.querySelector('.forum-comments');
        if (commentsContainer) {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
                <p class="comment-content">${comment.content}</p>
                <small class="comment-meta">Por ${comment.username} - ${new Date(comment.created_at).toLocaleString()}</small>
            `;
            commentsContainer.appendChild(commentElement);
        }
    }

    // Event Listeners
    document.querySelectorAll('.submit-comment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const form = e.target.closest('.comment-form');
            const textarea = form.querySelector('textarea');
            const content = textarea.value.trim();
            
            if (content && currentForumId) {
                addComment(currentForumId, content);
                textarea.value = '';
            }
        });
    });

    // Función para mostrar notificaciones
    function showNotification(message, type = 'success') {
        console.log('Mostrando notificación:', message, type); // Debug
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '1rem 2rem';
        notification.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
        notification.style.color = 'white';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '9999';
        notification.style.animation = 'slideIn 0.3s ease-out';
        
        document.body.appendChild(notification);
        console.log('Notificación añadida al DOM'); // Debug

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Añadir estilos de animación
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Función para guardar un foro
    async function saveForum(forumId, button) {
        try {
            // Verificar si el usuario está logueado
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                alert('Debes iniciar sesión para guardar foros');
                window.location.href = '/login.html';
                return;
            }

            // Cambiar el estado del botón mientras se procesa
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const response = await fetch(`/api/forums/${forumId}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    userId: user.id 
                })
            });

            const data = await response.json();

            if (data.success) {
                // Actualizar el botón para mostrar que está guardado
                button.innerHTML = '<i class="fas fa-check"></i> Guardado';
                button.classList.add('saved');
                button.style.backgroundColor = '#4CAF50';
                button.style.color = 'white';
                button.disabled = true;
            } else {
                throw new Error(data.message || 'Error al guardar el foro');
            }
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'Error al guardar el foro');
            
            // Restaurar el botón a su estado original
            button.innerHTML = '<i class="fas fa-star"></i> Guardar';
            button.disabled = false;
        }
    }

    // Función para ver un foro específico
    function viewForum(forumId) {
        window.location.href = `/forum.html?id=${forumId}`;
    }

    // Estilos para los botones
    const style2 = document.createElement('style');
    style2.textContent = `
        .forum-actions {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
        }

        .save-forum-btn {
            transition: all 0.3s ease;
        }

        .save-forum-btn.saved {
            background-color: #4CAF50;
            color: white;
            border-color: #4CAF50;
        }

        .save-forum-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(style2);

    // Agregar event listeners a los botones de guardar
    document.addEventListener('DOMContentLoaded', () => {
        const saveButtons = document.querySelectorAll('.save-forum-btn');
        saveButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const forumId = e.target.closest('.forum-card').dataset.forumId;
                saveForum(forumId, e.target);
            });
        });
    });

    // Inicialización
    getCurrentUser();
});