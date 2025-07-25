class MediaTracker {
    constructor() {
        this.apiKey = 'df3e498937ba9d64ad9c717f1a7f7792';
        this.baseUrl = 'https://api.themoviedb.org/3';
        this.imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
        this.media = JSON.parse(localStorage.getItem('mediaTracker') || '[]');

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderMedia();
        this.updateCounts();
    }

    setupEventListeners() {
        // Modal controls
        document.getElementById('addMediaBtn').addEventListener('click', () => {
            this.openModal();
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('addMediaModal').addEventListener('click', (e) => {
            if (e.target.id === 'addMediaModal') {
                this.closeModal();
            }
        });

        // Details modal controls
        document.getElementById('closeDetailsModal').addEventListener('click', () => {
            this.closeDetailsModal();
        });

        document.getElementById('mediaDetailsModal').addEventListener('click', (e) => {
            if (e.target.id === 'mediaDetailsModal') {
                this.closeDetailsModal();
            }
        });

        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchMedia();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchMedia();
            }
        });

        // Filters
        document.getElementById('cardSize').addEventListener('change', (e) => {
            this.updateCardSize(e.target.value);
        });

        document.getElementById('mediaType').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('runtime').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('watchPreference').addEventListener('change', () => {
            this.applyFilters();
        });

        // Drag and drop
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const columns = document.querySelectorAll('.column-content');

        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', (e) => {
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('drag-over');
                }
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');

                const mediaId = e.dataTransfer.getData('text/plain');
                const newStatus = column.id;

                this.updateMediaStatus(mediaId, newStatus);
            });
        });
    }

    openModal() {
        document.getElementById('addMediaModal').classList.add('active');
        document.getElementById('searchInput').focus();
    }

    closeModal() {
        document.getElementById('addMediaModal').classList.remove('active');
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('searchInput').value = '';
    }

    closeDetailsModal() {
        document.getElementById('mediaDetailsModal').classList.remove('active');
    }

    async showMediaDetails(item) {
        document.getElementById('mediaDetailsModal').classList.add('active');
        const detailsContent = document.getElementById('detailsContent');

        // Show loading state
        detailsContent.innerHTML = '<div class="loading">Loading details...</div>';

        try {
            // Fetch detailed information
            const [detailsResponse, creditsResponse] = await Promise.all([
                fetch(`${this.baseUrl}/${item.media_type}/${item.id}?api_key=${this.apiKey}`),
                fetch(`${this.baseUrl}/${item.media_type}/${item.id}/credits?api_key=${this.apiKey}`)
            ]);

            const details = await detailsResponse.json();
            const credits = await creditsResponse.json();

            this.renderMediaDetails(item, details, credits);
        } catch (error) {
            console.error('Error fetching details:', error);
            detailsContent.innerHTML = '<div class="loading">Error loading details. Please try again.</div>';
        }
    }

    renderMediaDetails(item, details, credits) {
        const detailsContent = document.getElementById('detailsContent');
        const posterUrl = item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null;
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const releaseDate = item.release_date ? new Date(item.release_date).getFullYear() : 'N/A';

        // Get genres
        const genres = details.genres ? details.genres.map(g => g.name) : [];

        // Get cast (first 10 members)
        const cast = credits.cast ? credits.cast.slice(0, 10).map(c => c.name) : [];

        // Format runtime for movies
        const duration = item.media_type === 'movie' && details.runtime ?
            this.formatDuration(details.runtime) : null;

        // Get additional info based on media type
        let additionalInfo = '';
        if (item.media_type === 'tv') {
            const seasons = details.number_of_seasons || 'N/A';
            const episodes = details.number_of_episodes || 'N/A';
            const status = details.status || 'N/A';
            additionalInfo = `
                <div class="details-meta-item">
                    <i class="fas fa-tv"></i>
                    ${seasons} Seasons, ${episodes} Episodes
                </div>
                <div class="details-meta-item">
                    <i class="fas fa-info-circle"></i>
                    ${status}
                </div>
            `;
        } else if (duration) {
            additionalInfo = `
                <div class="details-meta-item">
                    <i class="fas fa-clock"></i>
                    ${duration}
                </div>
            `;
        }

        detailsContent.innerHTML = `
            <div class="details-content">
                <div class="details-poster">
                    ${posterUrl ?
                `<img src="${posterUrl}" alt="${item.title}">` :
                '<div class="placeholder"><i class="fas fa-film"></i></div>'
            }
                </div>
                <div class="details-info">
                    <h1 class="details-title">${item.title}</h1>
                    
                    <div class="details-meta">
                        <div class="details-meta-item">
                            <i class="fas fa-calendar"></i>
                            ${releaseDate}
                        </div>
                        <div class="details-meta-item">
                            <i class="fas fa-film"></i>
                            ${item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                        </div>
                        ${additionalInfo}
                        <div class="details-rating">
                            <i class="fas fa-star"></i>
                            ${rating}/10
                        </div>
                    </div>

                    ${genres.length > 0 ? `
                    <div class="details-genres">
                        ${genres.map(genre => `<span class="genre-tag">${genre}</span>`).join('')}
                    </div>
                    ` : ''}

                    <div class="details-overview">
                        <h3>Overview</h3>
                        <p>${item.overview || 'No description available.'}</p>
                    </div>

                    ${cast.length > 0 ? `
                    <div class="details-cast">
                        <h3>Cast</h3>
                        <div class="cast-list">
                            ${cast.map(actor => `<span class="cast-member">${actor}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <div class="details-actions">
                        <select class="status-select" id="detailsStatusSelect">
                            <option value="to-watch" ${item.status === 'to-watch' ? 'selected' : ''}>To Watch</option>
                            <option value="in-progress" ${item.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                            <option value="watching" ${item.status === 'watching' ? 'selected' : ''}>Watching</option>
                            <option value="waiting" ${item.status === 'waiting' ? 'selected' : ''}>Waiting for Season</option>
                            <option value="watched" ${item.status === 'watched' ? 'selected' : ''}>Watched</option>
                        </select>
                        <select class="status-select" id="detailsWatchPreferenceSelect">
                            <option value="alone" ${(item.watch_preference || 'alone') === 'alone' ? 'selected' : ''}>Watch Alone</option>
                            <option value="partner" ${(item.watch_preference || 'alone') === 'partner' ? 'selected' : ''}>Watch with Partner</option>
                        </select>
                        <button class="remove-btn" onclick="mediaTracker.removeMedia(${item.id}, '${item.media_type}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add event listener for status change
        document.getElementById('detailsStatusSelect').addEventListener('change', (e) => {
            this.updateMediaStatus(item.id, e.target.value);
        });

        // Add event listener for watch preference change
        document.getElementById('detailsWatchPreferenceSelect').addEventListener('change', (e) => {
            this.updateMediaWatchPreference(item.id, e.target.value);
        });
    }

    removeMedia(mediaId, mediaType) {
        if (confirm('Are you sure you want to remove this item from your tracker?')) {
            this.media = this.media.filter(m => !(m.id == mediaId && m.media_type === mediaType));
            this.saveMedia();
            this.renderMedia();
            this.updateCounts();
            this.closeDetailsModal();
        }
    }

    async searchMedia() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

        try {
            const response = await fetch(
                `${this.baseUrl}/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(query)}`
            );
            const data = await response.json();

            this.displaySearchResults(data.results);
        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = '<div class="loading">Error searching. Please try again.</div>';
        }
    }

    displaySearchResults(results) {
        const resultsContainer = document.getElementById('searchResults');

        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<div class="loading">No results found.</div>';
            return;
        }

        const filteredResults = results.filter(item =>
            (item.media_type === 'movie' || item.media_type === 'tv') &&
            (item.title || item.name)
        );

        resultsContainer.innerHTML = filteredResults.map(item => {
            const title = item.title || item.name;
            const releaseDate = item.release_date || item.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
            const posterPath = item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null;

            return `
                <div class="search-result" onclick="mediaTracker.addMedia(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                    <div class="search-result-poster">
                        ${posterPath ? `<img src="${posterPath}" alt="${title}">` : '<i class="fas fa-film"></i>'}
                    </div>
                    <div class="search-result-info">
                        <div class="search-result-title">${title}</div>
                        <div class="search-result-meta">
                            ${item.media_type === 'movie' ? 'Movie' : 'TV Show'} • ${year}
                            ${item.vote_average ? ` • ⭐ ${item.vote_average.toFixed(1)}` : ''}
                        </div>
                        <div class="search-result-overview">
                            ${item.overview || 'No description available.'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async addMedia(item) {
        // Check if already exists
        if (this.media.find(m => m.id === item.id && m.media_type === item.media_type)) {
            alert('This item is already in your tracker!');
            return;
        }

        // Get additional details
        let details = {};
        try {
            const response = await fetch(
                `${this.baseUrl}/${item.media_type}/${item.id}?api_key=${this.apiKey}`
            );
            details = await response.json();
        } catch (error) {
            console.error('Error fetching details:', error);
        }

        const mediaItem = {
            id: item.id,
            media_type: item.media_type,
            title: item.title || item.name,
            poster_path: item.poster_path,
            vote_average: item.vote_average || 0,
            overview: item.overview,
            release_date: item.release_date || item.first_air_date,
            runtime: details.runtime || (details.episode_run_time && details.episode_run_time[0]) || 0,
            seasons: details.number_of_seasons || 0,
            status: 'to-watch',
            watch_preference: 'alone',
            added_date: new Date().toISOString()
        };

        this.media.push(mediaItem);
        this.saveMedia();
        this.renderMedia();
        this.updateCounts();
        this.closeModal();
    }

    updateMediaStatus(mediaId, newStatus) {
        const media = this.media.find(m => m.id == mediaId);
        if (media) {
            media.status = newStatus;
            this.saveMedia();
            this.renderMedia();
            this.updateCounts();
        }
    }

    updateMediaWatchPreference(mediaId, newPreference) {
        const media = this.media.find(m => m.id == mediaId);
        if (media) {
            media.watch_preference = newPreference;
            this.saveMedia();
            this.renderMedia();
            this.updateCounts();
        }
    }

    renderMedia() {
        const columns = {
            'to-watch': document.getElementById('to-watch'),
            'in-progress': document.getElementById('in-progress'),
            'watching': document.getElementById('watching'),
            'waiting': document.getElementById('waiting'),
            'watched': document.getElementById('watched')
        };

        // Clear columns
        Object.values(columns).forEach(column => {
            column.innerHTML = '';
        });

        // Apply filters
        const filteredMedia = this.getFilteredMedia();

        // Render cards
        filteredMedia.forEach(item => {
            const card = this.createMediaCard(item);
            columns[item.status].appendChild(card);
        });
    }

    getFilteredMedia() {
        const mediaType = document.getElementById('mediaType').value;
        const runtime = document.getElementById('runtime').value;
        const watchPreference = document.getElementById('watchPreference').value;

        return this.media.filter(item => {
            // Media type filter
            if (mediaType !== 'all' && item.media_type !== mediaType) {
                return false;
            }

            // Runtime filter
            if (runtime !== 'all' && item.runtime) {
                const itemRuntime = item.runtime;
                switch (runtime) {
                    case 'short':
                        if (itemRuntime >= 90) return false;
                        break;
                    case 'medium':
                        if (itemRuntime < 90 || itemRuntime > 150) return false;
                        break;
                    case 'long':
                        if (itemRuntime <= 150) return false;
                        break;
                }
            }

            // Watch preference filter
            if (watchPreference !== 'all' && item.watch_preference !== watchPreference) {
                return false;
            }

            return true;
        });
    }

    createMediaCard(item) {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.draggable = true;
        card.dataset.mediaId = item.id;

        const posterUrl = item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null;
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const duration = this.formatDuration(item.runtime);
        const mediaTypeLabel = item.media_type === 'movie' ? 'Movie' : 'TV';

        // Show duration for movies, season count for TV shows
        let metaInfo = '';
        if (item.media_type === 'movie' && duration !== 'N/A') {
            metaInfo = `
                <div class="card-duration">
                    <i class="fas fa-clock"></i>
                    ${duration}
                </div>
            `;
        } else if (item.media_type === 'tv' && item.seasons > 0) {
            const seasonText = item.seasons === 1 ? 'Season' : 'Seasons';
            metaInfo = `
                <div class="card-duration">
                    <i class="fas fa-tv"></i>
                    ${item.seasons} ${seasonText}
                </div>
            `;
        } else {
            metaInfo = '<div></div>';
        }

        card.innerHTML = `
            <div class="card-poster">
                ${posterUrl ? `<img src="${posterUrl}" alt="${item.title}">` : '<i class="fas fa-film placeholder"></i>'}
                <div class="media-type-badge">${mediaTypeLabel}</div>
            </div>
            <div class="card-info">
                <div class="card-title">${item.title}</div>
                <div class="card-meta">
                    ${metaInfo}
                    <div class="card-rating">
                        <i class="fas fa-star"></i>
                        ${rating}
                    </div>
                </div>
            </div>
        `;

        // Click event for details
        card.addEventListener('click', (e) => {
            // Don't open details if dragging
            if (card.classList.contains('dragging')) return;
            this.showMediaDetails(item);
        });

        // Drag events
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.id);
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        return card;
    }

    formatDuration(minutes) {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    }

    updateCounts() {
        const counts = {
            'to-watch': 0,
            'in-progress': 0,
            'watching': 0,
            'waiting': 0,
            'watched': 0
        };

        const filteredMedia = this.getFilteredMedia();
        filteredMedia.forEach(item => {
            counts[item.status]++;
        });

        Object.keys(counts).forEach(status => {
            const column = document.querySelector(`[data-status="${status}"] .count`);
            if (column) {
                column.textContent = counts[status];
            }
        });
    }

    updateCardSize(size) {
        const board = document.querySelector('.kanban-board');
        board.className = `kanban-board card-size-${size}`;
    }

    applyFilters() {
        this.renderMedia();
        this.updateCounts();
    }

    saveMedia() {
        localStorage.setItem('mediaTracker', JSON.stringify(this.media));
    }
}

// Initialize the app
const mediaTracker = new MediaTracker();