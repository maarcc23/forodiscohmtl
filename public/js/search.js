// Script para la funcionalidad de búsqueda
document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const searchResults = document.getElementById('searchResults');
    
    // Verificar que existan los elementos necesarios
    if (!searchInput || !searchButton) {
        console.warn('No se encontraron algunos elementos de búsqueda');
        return;
    }
    
    // Crear contenedor de resultados si no existe
    if (!searchResults) {
        searchResults = document.createElement('div');
        searchResults.id = 'searchResults';
        searchResults.className = 'search-results';
        document.querySelector('.search-container')?.appendChild(searchResults);
    }
    
    let isAuthenticated = false;
    let savedVenues = [];
    
    // Inicializar
    init();
    
    async function init() {
        // Verificar autenticación
        isAuthenticated = await checkAuth();
        
        // Cargar locales guardados si está autenticado
        if (isAuthenticated) {
            await loadSavedVenues();
        }
        
        // Configurar eventos
        setupEventListeners();
    }
    
    // Verificar si el usuario está autenticado
    async function checkAuth() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            return data.authenticated;
        } catch (error) {
            console.error('Error al verificar autenticación:', error);
            return false;
        }
    }
    
    // Cargar locales guardados
    async function loadSavedVenues() {
        try {
            // Intentar cargar desde localStorage primero
            const savedVenuesLocal = localStorage.getItem('savedVenues');
            if (savedVenuesLocal) {
                try {
                    savedVenues = JSON.parse(savedVenuesLocal) || [];
                    console.log('Locales guardados cargados desde localStorage:', savedVenues);
                    return savedVenues;
                } catch (e) {
                    console.error('Error al cargar locales guardados desde localStorage:', e);
                }
            }
            
            // Si no hay datos en localStorage o hay un error, intentar con la API
            try {
                const response = await fetch('/api/user/venues', {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error('Error al cargar locales guardados');
                }
                
                const data = await response.json();
                savedVenues = data.venues || [];
                
                // Guardar en localStorage para futuras consultas
                localStorage.setItem('savedVenues', JSON.stringify(savedVenues));
                
                return savedVenues;
            } catch (apiError) {
                console.error('Error al cargar locales guardados desde API:', apiError);
                return savedVenues; // Devolver lo que ya tengamos en savedVenues
            }
        } catch (error) {
            console.error('Error al cargar locales guardados:', error);
            return [];
        }
    }
    
    // Configurar eventos
    function setupEventListeners() {
        searchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    performSearch(query);
                }
            }
        });
        
        // Cerrar resultados al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput && e.target !== searchButton) {
                searchResults.style.display = 'none';
            }
        });
    }
    
    // Función para realizar la búsqueda
    async function performSearch(query) {
        try {
            // Mostrar indicador de carga
            searchResults.innerHTML = `
                <div class="search-loading">
                    <div class="spinner"></div>
                    <p>Buscando...</p>
                </div>
            `;
            searchResults.style.display = 'block';
            
            // Realizar petición al servidor
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error('Error en la búsqueda');
            }
            
            const data = await response.json();
            
            // Mostrar resultados
            if (data.results && data.results.length > 0) {
                displayResults(data.results);
            } else {
                searchResults.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <p>No se encontraron resultados para "${query}"</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error al realizar búsqueda:', error);
            searchResults.innerHTML = `
                <div class="search-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error al realizar la búsqueda. Inténtalo de nuevo.</p>
                </div>
            `;
        }
    }
    
    // Mostrar resultados de búsqueda
    function displayResults(results) {
        searchResults.innerHTML = '';
        
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'results-container';
        
        results.forEach(venue => {
            const isSaved = savedVenues.includes(venue.id) || savedVenues.some(v => v.id === venue.id);
            
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML = `
                <div class="result-info">
                    <h3>${venue.name}</h3>
                    <p>${venue.description || 'Sin descripción'}</p>
                    <p class="venue-location">
                        <i class="fas fa-map-marker-alt"></i> 
                        ${venue.address || 'Dirección no disponible'}
                    </p>
                </div>
                <div class="result-actions">
                    <button onclick="saveVenue(${venue.id}, this)" class="btn-save ${isSaved ? 'saved' : ''}">
                        <i class="fas fa-star"></i> ${isSaved ? 'Guardado' : 'Guardar'}
                    </button>
                    <button onclick="viewVenue(${venue.id})" class="btn-view">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </div>
            `;
            
            resultsContainer.appendChild(resultItem);
        });
        
        searchResults.appendChild(resultsContainer);
    }
    
    // Función para ver un local (expuesta globalmente)
    window.viewVenue = function(id) {
        window.location.href = `/venue.html?id=${id}`;
    };
    
    // Función para guardar un local (expuesta globalmente)
    window.saveVenue = async function(id, button) {
        console.log('saveVenue llamado con ID:', id);
        
        // Verificar autenticación usando localStorage
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        
        if (!currentUser || !currentUser.authenticated) {
            console.log('Usuario no autenticado, redirigiendo a login');
            window.location.href = '/login.html';
            return;
        }
        
        try {
            const isSaved = button.classList.contains('saved');
            
            // Obtener información del venue para guardar en localStorage
            let venueToSave = null;
            
            // Si estamos guardando (no eliminando), necesitamos la información del venue
            if (!isSaved) {
                // Buscar el venue en los resultados actuales
                const venueElement = button.closest('.result-item');
                if (venueElement) {
                    const venueName = venueElement.querySelector('h3').textContent;
                    const venueDescription = venueElement.querySelector('p').textContent;
                    const venueAddress = venueElement.querySelector('.venue-location').textContent.trim();
                    
                    venueToSave = {
                        id: id,
                        name: venueName,
                        description: venueDescription,
                        address: venueAddress
                    };
                }
            }
            
            // Intentar guardar/eliminar usando la API primero
            try {
                const method = isSaved ? 'DELETE' : 'POST';
                
                const response = await fetch(`/api/user/venues/${id}`, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`Error al ${isSaved ? 'eliminar' : 'guardar'} local`);
                }
                
                // Si la API funciona, actualizamos localStorage también
                updateLocalStorage(id, isSaved, venueToSave);
                
            } catch (apiError) {
                console.error('Error al usar API para guardar/eliminar local:', apiError);
                // Si falla la API, solo usamos localStorage
                updateLocalStorage(id, isSaved, venueToSave);
            }
            
            // Actualizar UI
            if (isSaved) {
                button.classList.remove('saved');
                button.innerHTML = '<i class="fas fa-star"></i> Guardar';
                savedVenues = savedVenues.filter(v => {
                    if (typeof v === 'object') {
                        return v.id !== id;
                    } else {
                        return v !== id;
                    }
                });
                showNotification('Local eliminado de tus guardados');
            } else {
                button.classList.add('saved');
                button.innerHTML = '<i class="fas fa-star"></i> Guardado';
                if (venueToSave) {
                    savedVenues.push(venueToSave);
                } else {
                    savedVenues.push(id);
                }
                showNotification('Local guardado correctamente');
            }
        } catch (error) {
            console.error('Error al guardar/eliminar local:', error);
            showNotification('Error al procesar tu solicitud', 'error');
        }
    };
    
    // Función para actualizar localStorage
    function updateLocalStorage(id, isSaved, venueToSave) {
        try {
            // Obtener los venues guardados actuales
            let currentSaved = [];
            try {
                const savedJson = localStorage.getItem('savedVenues');
                currentSaved = savedJson ? JSON.parse(savedJson) : [];
            } catch (e) {
                console.error('Error al parsear savedVenues de localStorage:', e);
                currentSaved = [];
            }
            
            // Actualizar la lista
            if (isSaved) {
                // Eliminar el venue
                currentSaved = currentSaved.filter(v => {
                    if (typeof v === 'object') {
                        return v.id !== id;
                    } else {
                        return v !== id;
                    }
                });
            } else {
                // Añadir el venue
                if (venueToSave) {
                    // Verificar si ya existe y actualizarlo
                    const existingIndex = currentSaved.findIndex(v => {
                        if (typeof v === 'object') {
                            return v.id === id;
                        } else {
                            return v === id;
                        }
                    });
                    
                    if (existingIndex >= 0) {
                        currentSaved[existingIndex] = venueToSave;
                    } else {
                        currentSaved.push(venueToSave);
                    }
                } else {
                    // Si no tenemos la información completa, solo guardamos el ID
                    if (!currentSaved.includes(id) && !currentSaved.some(v => typeof v === 'object' && v.id === id)) {
                        currentSaved.push(id);
                    }
                }
            }
            
            // Guardar de vuelta en localStorage
            localStorage.setItem('savedVenues', JSON.stringify(currentSaved));
            console.log('localStorage actualizado:', currentSaved);
            
        } catch (error) {
            console.error('Error al actualizar localStorage:', error);
        }
    }
    
    // Mostrar notificación
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
    
    // Estilos para los resultados de búsqueda
    const searchStyles = document.createElement('style');
    searchStyles.textContent = `
        .search-container {
            position: relative;
        }
        
        .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background-color: #1a1a1a;
            border-radius: 0 0 10px 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            z-index: 100;
            max-height: 400px;
            overflow-y: auto;
            display: none;
        }
        
        .results-container {
            padding: 10px;
        }
        
        .result-item {
            padding: 15px;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.2s ease;
        }
        
        .result-item:last-child {
            border-bottom: none;
        }
        
        .result-item:hover {
            background-color: #252525;
        }
        
        .result-info {
            flex: 1;
        }
        
        .result-info h3 {
            color: white;
            margin: 0 0 5px 0;
            font-size: 1rem;
        }
        
        .result-info p {
            color: #b0b0b0;
            margin: 0 0 5px 0;
            font-size: 0.9rem;
        }
        
        .venue-location {
            color: #888 !important;
            font-size: 0.8rem !important;
        }
        
        .result-actions {
            display: flex;
            gap: 10px;
        }
        
        .result-actions button {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
            white-space: nowrap;
        }
        
        .btn-save {
            background-color: transparent;
            color: #ff4b6e;
            border: 1px solid #ff4b6e !important;
        }
        
        .btn-save:hover {
            background-color: rgba(255, 75, 110, 0.1);
        }
        
        .btn-save.saved {
            background-color: #ff4b6e;
            color: white;
        }
        
        .btn-view {
            background-color: #ff4b6e;
            color: white;
        }
        
        .btn-view:hover {
            background-color: #e63e5c;
        }
        
        .search-loading,
        .no-results,
        .search-error {
            padding: 20px;
            text-align: center;
            color: #b0b0b0;
        }
        
        .search-loading .spinner {
            width: 30px;
            height: 30px;
            border: 3px solid #ff4b6e;
            border-top: 3px solid transparent;
            border-radius: 50%;
            margin: 0 auto 10px;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #1a1a1a;
            color: white;
            padding: 12px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            max-width: 300px;
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .notification.success {
            border-left: 4px solid #4CAF50;
        }
        
        .notification.error {
            border-left: 4px solid #f44336;
        }
        
        .notification i {
            font-size: 1.2rem;
        }
        
        .notification.success i {
            color: #4CAF50;
        }
        
        .notification.error i {
            color: #f44336;
        }
    `;
    document.head.appendChild(searchStyles);
});