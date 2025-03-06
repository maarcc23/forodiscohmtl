console.log('Inicializando script de búsqueda...'); // Debug inicial

// Esperar a que el DOM esté completamente cargado
window.addEventListener('load', function() {
    console.log('Iniciando configuración de búsqueda...'); // Debug

    // Función simple de búsqueda
    function setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const searchResults = document.getElementById('searchResults');

        if (!searchInput || !searchButton || !searchResults) {
            console.error('No se encontraron los elementos de búsqueda');
            return;
        }

        async function doSearch(query) {
            try {
                searchResults.innerHTML = '<p>Buscando...</p>';
                
                const response = await fetch('/api/search?q=' + encodeURIComponent(query));
                const data = await response.json();
                
                if (data.success && data.results) {
                    if (data.results.length === 0) {
                        searchResults.innerHTML = '<p>No se encontraron resultados</p>';
                    } else {
                        const html = data.results.map(venue => `
                            <div class="search-result-item">
                                <h3>${venue.name || 'Sin nombre'}</h3>
                                <p>${venue.description || 'Sin descripción'}</p>
                                <p>📍 ${venue.location || 'Sin ubicación'}</p>
                                <button onclick="verLocal(${venue.id})">Ver Local</button>
                            </div>
                        `).join('');
                        searchResults.innerHTML = html;
                    }
                } else {
                    searchResults.innerHTML = '<p>Error al buscar</p>';
                }
            } catch (error) {
                console.error('Error:', error);
                searchResults.innerHTML = '<p>Error al conectar con el servidor</p>';
            }
        }

        // Función para ver un local
        window.verLocal = function(id) {
            alert('Ver local ' + id);
        };

        // Click en el botón de búsqueda
        searchButton.onclick = function(e) {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                doSearch(query);
            }
        };

        // Búsqueda al presionar Enter
        searchInput.onkeypress = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = this.value.trim();
                if (query) {
                    doSearch(query);
                }
            }
        };
    }

    // Iniciar cuando el documento esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSearch);
    } else {
        setupSearch();
    }

    console.log('Configuración de búsqueda completada'); // Debug

    // Cerrar resultados al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && 
            !searchButton.contains(e.target) && 
            !searchResults.contains(e.target)) {
            searchResults.innerHTML = '';
        }
    });
});