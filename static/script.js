class MediaTracker {
    constructor() {
        this.baseUrl = '/api';
        this.imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
        this.currentUser = null;
        this.media = [];

        this.init();
    }

    async init() {
        await this.showUserSelection();
        this.setupEventListeners();
        this.handleMobileLayout();
    }

    // User Management
    async showUserSelection() {
        const modal = document.getElementById('userSelectionModal');
        modal.classList.add('active');
        
        await this.loadExistingUsers();
        this.setupUserSelectionListeners();
    }

    async loadExistingUsers() {
        try {
            const response = await fetch(`${this.baseUrl}/users`);
            const users = await response.json();
            
            const existingUsersContainer = document.getElementById('existingUsers');
            
            if (users.length === 0) {
                existingUsersContainer.innerHTML = '<div class="no-users-message">No users found. Create your first user below!</div>';
            } else {
                existingUsersContainer.innerHTML = users.map(user => `
                    <div class="user-card" data-user-id="${user.id}">
                        <i class="fas fa-user"></i>
                        <span>${user.name}</span>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            document.getElementById('existingUsers').innerHTML = '<div class="no-users-message">Error loading users. Please refresh the page.</div>';
        }
    }

    setupUserSelectionListeners() {
        // Handle existing user selection
        document.getElementById('existingUsers').addEventListener('click', (e) => {
            const userCard = e.target.closest('.user-card');
            if (userCard) {
                const userId = parseInt(userCard.dataset.userId);
                const userName = userCard.querySelector('span').textContent;
                this.selectUser(userId, userName);
            }
        });

        // Handle new user creation
        const createUserBtn = document.getElementById('createUserBtn');
        const newUserNameInput = document.getElementById('newUserName');

        createUserBtn.addEventListener('click', () => {
            this.createNewUser();
        });

        newUserNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createNewUser();
            }
        });

        newUserNameInput.addEventListener('input', (e) => {
            createUserBtn.disabled = !e.target.value.trim();
        });
    }

    async createNewUser() {
        const nameInput = document.getElementById('newUserName');
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('Please enter a name');
            return;
        }

        const createUserBtn = document.getElementById('createUserBtn');
        createUserBtn.disabled = true;
        createUserBtn.textContent = 'Creating...';

        try {
            const response = await fetch(`${this.baseUrl}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                const user = await response.json();
                this.selectUser(user.id, user.name);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to create user');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            alert('Failed to create user. Please try again.');
        } finally {
            createUserBtn.disabled = false;
            createUserBtn.textContent = 'Create User';
        }
    }

    async selectUser(userId, userName) {
        this.currentUser = { id: userId, name: userName };
        
        // Hide user selection modal
        document.getElementById('userSelectionModal').classList.remove('active');
        
        // Update header to show current user
        document.querySelector('.header h1').innerHTML = `<i class="fas fa-film"></i> Popcorn - ${userName}`;
        
        // Load user's media and preferences
        await this.loadUserData();
        
        // Initialize the rest of the app
        this.renderMedia();
        this.updateCounts();
    }

    async loadUserData() {
        try {
            // Load user's media
            const mediaResponse = await fetch(`${this.baseUrl}/users/${this.currentUser.id}/media`);
            this.media = await mediaResponse.json();

            // Load user preferences
            const prefsResponse = await fetch(`${this.baseUrl}/users/${this.currentUser.id}/preferences`);
            const preferences = await prefsResponse.json();
            
            // Apply preferences to UI
            this.applyUserPreferences(preferences);
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    applyUserPreferences(preferences) {
        // Set card size
        const cardSizeButtons = document.querySelectorAll('[data-filter="cardSize"] .filter-btn');
        cardSizeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === preferences.card_size);
        });
        this.updateCardSize(preferences.card_size);

        // Set default watch preference
        const watchPrefButtons = document.querySelectorAll('[data-filter="watchPreference"] .filter-btn');
        watchPrefButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === preferences.default_watch_preference);
        });
        
        // Apply filters to show the correct content
        this.applyFilters();
    }

    handleMobileLayout() {
        const checkMobile = () => {
            const isMobile = window.innerWidth <= 768;

            // Hide card size filter on mobile
            const cardSizeFilter = document.querySelector('[data-filter="cardSize"]')?.closest('.filter-group');
            if (cardSizeFilter) {
                cardSizeFilter.style.display = isMobile ? 'none' : 'block';
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
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

        // Button-based filters
        this.setupButtonFilters();

        // Drag and drop
        this.setupDragAndDrop();
    }

    setupButtonFilters() {
        // Handle all filter button clicks
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const buttonGroup = button.closest('.button-group');
                const filterType = buttonGroup.dataset.filter;
                const value = button.dataset.value;

                // Remove active class from all buttons in this group
                buttonGroup.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                });

                // Add active class to clicked button
                button.classList.add('active');

                // Handle different filter types
                if (filterType === 'cardSize') {
                    this.updateCardSize(value);
                    this.saveUserPreferences(); // Save card size preference
                } else if (filterType === 'watchPreference') {
                    this.applyFilters();
                    this.saveUserPreferences(); // Save watch preference
                } else {
                    this.applyFilters();
                }
            });
        });
    }

    getActiveFilterValue(filterType) {
        const buttonGroup = document.querySelector(`[data-filter="${filterType}"]`);
        const activeButton = buttonGroup?.querySelector('.filter-btn.active');
        return activeButton?.dataset.value || 'all';
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

                this.optimisticUpdateMediaStatus(mediaId, newStatus);
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
                fetch(`${this.baseUrl}/media/${item.media_type}/${item.id}`),
                fetch(`${this.baseUrl}/media/${item.media_type}/${item.id}/credits`)
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
                            <option value="in-progress" ${item.status === 'in-progress' ? 'selected' : ''}>Shortlist</option>
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

    async removeMedia(mediaId, mediaType) {
        if (confirm('Are you sure you want to remove this item from your tracker?')) {
            try {
                const response = await fetch(`${this.baseUrl}/users/${this.currentUser.id}/media/${mediaId}/${mediaType}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.media = this.media.filter(m => !(m.id == mediaId && m.media_type === mediaType));
                    this.renderMedia();
                    this.updateCounts();
                    this.closeDetailsModal();
                } else {
                    alert('Failed to remove media');
                }
            } catch (error) {
                console.error('Error removing media:', error);
                alert('Failed to remove media');
            }
        }
    }

    async searchMedia() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

        try {
            const response = await fetch(`${this.baseUrl}/search?query=${encodeURIComponent(query)}`);
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
            const response = await fetch(`${this.baseUrl}/media/${item.media_type}/${item.id}`);
            details = await response.json();
        } catch (error) {
            console.error('Error fetching details:', error);
        }

        const mediaItem = {
            tmdb_id: item.id,
            media_type: item.media_type,
            title: item.title || item.name,
            poster_path: item.poster_path,
            vote_average: item.vote_average || 0,
            overview: item.overview,
            release_date: item.release_date || item.first_air_date,
            runtime: details.runtime || (details.episode_run_time && details.episode_run_time[0]) || 0,
            seasons: details.number_of_seasons || 0,
            status: 'to-watch',
            watch_preference: this.getActiveFilterValue('watchPreference') || 'all'
        };

        try {
            const response = await fetch(`${this.baseUrl}/users/${this.currentUser.id}/media`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mediaItem)
            });

            if (response.ok) {
                // Add to local array for immediate UI update
                this.media.push({
                    id: item.id,
                    ...mediaItem
                });
                this.renderMedia();
                this.updateCounts();
                this.closeModal();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to add media');
            }
        } catch (error) {
            console.error('Error adding media:', error);
            alert('Failed to add media. Please try again.');
        }
    }

    async optimisticUpdateMediaStatus(mediaId, newStatus) {
        const media = this.media.find(m => m.id == mediaId);
        if (!media) return;

        // Store the original status for potential rollback
        const originalStatus = media.status;
        const originalIndex = this.media.indexOf(media);

        // Remove the item from its current position
        this.media.splice(originalIndex, 1);
        
        // Update the status
        media.status = newStatus;
        
        // Add it to the end of the array (so it appears at the end of the destination column)
        this.media.push(media);
        
        // Immediately update the UI (optimistic update)
        this.renderMedia();
        this.updateCounts();

        // Add visual feedback that the update is in progress
        const card = document.querySelector(`[data-media-id="${mediaId}"]`);
        if (card) {
            card.style.opacity = '0.7';
            card.style.transition = 'opacity 0.3s ease';
        }

        try {
            const response = await fetch(`${this.baseUrl}/users/${this.currentUser.id}/media/${mediaId}/${media.media_type}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: newStatus,
                    watch_preference: media.watch_preference
                })
            });

            if (response.ok) {
                // Success - restore visual feedback
                if (card) {
                    card.style.opacity = '1';
                }
            } else {
                // Failed - revert the optimistic update
                media.status = originalStatus;
                this.renderMedia();
                this.updateCounts();
                alert('Failed to update media status - changes reverted');
            }
        } catch (error) {
            // Error - revert the optimistic update
            console.error('Error updating media status:', error);
            media.status = originalStatus;
            this.renderMedia();
            this.updateCounts();
            alert('Failed to update media status - changes reverted');
        }
    }

    async updateMediaStatus(mediaId, newStatus) {
        // This method is used for dropdown changes in details modal
        const media = this.media.find(m => m.id == mediaId);
        if (media) {
            try {
                const response = await fetch(`${this.baseUrl}/users/${this.currentUser.id}/media/${mediaId}/${media.media_type}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: newStatus,
                        watch_preference: media.watch_preference
                    })
                });

                if (response.ok) {
                    media.status = newStatus;
                    this.renderMedia();
                    this.updateCounts();
                } else {
                    alert('Failed to update media status');
                }
            } catch (error) {
                console.error('Error updating media status:', error);
                alert('Failed to update media status');
            }
        }
    }

    async updateMediaWatchPreference(mediaId, newPreference) {
        const media = this.media.find(m => m.id == mediaId);
        if (!media) return;

        // Store the original preference for potential rollback
        const originalPreference = media.watch_preference;

        // Immediately update the UI (optimistic update)
        media.watch_preference = newPreference;
        this.renderMedia();
        this.updateCounts();

        try {
            const response = await fetch(`${this.baseUrl}/users/${this.currentUser.id}/media/${mediaId}/${media.media_type}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: media.status,
                    watch_preference: newPreference
                })
            });

            if (!response.ok) {
                // Failed - revert the optimistic update
                media.watch_preference = originalPreference;
                this.renderMedia();
                this.updateCounts();
                alert('Failed to update watch preference - changes reverted');
            }
        } catch (error) {
            // Error - revert the optimistic update
            console.error('Error updating watch preference:', error);
            media.watch_preference = originalPreference;
            this.renderMedia();
            this.updateCounts();
            alert('Failed to update watch preference - changes reverted');
        }
    }

    renderMedia() {
        // Desktop kanban view
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

        // Mobile list view
        const mobileListView = document.getElementById('mobileListView');
        if (mobileListView) {
            mobileListView.innerHTML = '';
        }

        // Apply filters
        const filteredMedia = this.getFilteredMedia();

        // Render for both desktop and mobile
        filteredMedia.forEach(item => {
            // Desktop kanban cards
            const card = this.createMediaCard(item);
            columns[item.status].appendChild(card);

            // Mobile list items
            if (mobileListView) {
                const mobileItem = this.createMobileMediaItem(item);
                mobileListView.appendChild(mobileItem);
            }
        });
        
        // Debug: Check if mobile list view is visible and force show it on mobile
        if (mobileListView) {
            const styles = window.getComputedStyle(mobileListView);
            
            // Force show on mobile for debugging
            if (window.innerWidth <= 768) {
                mobileListView.style.display = 'block';
                mobileListView.style.visibility = 'visible';
                mobileListView.style.backgroundColor = '#ff0000'; // Red background for debugging
                console.log('Forced mobile list view to be visible');
                
                // Add a test item if no items exist
                if (mobileListView.children.length === 0 && this.media.length === 0) {
                    mobileListView.innerHTML = '<div style="color: white; padding: 20px; background: #333; margin: 10px; border-radius: 8px;">TEST: Mobile list view is working! Add some media to see items here.</div>';
                }
            }
        }
    }

    getFilteredMedia() {
        const mediaType = this.getActiveFilterValue('mediaType');
        const runtime = this.getActiveFilterValue('runtime');
        const watchPreference = this.getActiveFilterValue('watchPreference');

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

    createMobileMediaItem(item) {
        const mobileItem = document.createElement('div');
        mobileItem.className = 'mobile-media-item';
        mobileItem.dataset.mediaId = item.id;

        const posterUrl = item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null;
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const duration = this.formatDuration(item.runtime);
        const mediaTypeLabel = item.media_type === 'movie' ? 'Movie' : 'TV';

        // Format status for display
        const statusLabels = {
            'to-watch': 'To Watch',
            'in-progress': 'Shortlist',
            'watching': 'Watching',
            'waiting': 'Waiting for Season',
            'watched': 'Watched'
        };

        // Show duration for movies, season count for TV shows
        let metaInfo = '';
        if (item.media_type === 'movie' && duration !== 'N/A') {
            metaInfo = `
                <div class="mobile-meta-item">
                    <i class="fas fa-clock"></i>
                    ${duration}
                </div>
            `;
        } else if (item.media_type === 'tv' && item.seasons > 0) {
            const seasonText = item.seasons === 1 ? 'Season' : 'Seasons';
            metaInfo = `
                <div class="mobile-meta-item">
                    <i class="fas fa-tv"></i>
                    ${item.seasons} ${seasonText}
                </div>
            `;
        }

        mobileItem.innerHTML = `
            <div class="mobile-poster">
                ${posterUrl ? `<img src="${posterUrl}" alt="${item.title}">` : '<i class="fas fa-film placeholder"></i>'}
                <div class="mobile-type-badge">${mediaTypeLabel}</div>
            </div>
            <div class="mobile-info">
                <div class="mobile-title">${item.title}</div>
                <div class="mobile-meta">
                    <div class="mobile-status-badge ${item.status}">${statusLabels[item.status]}</div>
                    ${metaInfo}
                    <div class="mobile-rating">
                        <i class="fas fa-star"></i>
                        ${rating}
                    </div>
                </div>
            </div>
        `;

        // Click event for details
        mobileItem.addEventListener('click', () => {
            this.showMediaDetails(item);
        });

        return mobileItem;
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

    async saveUserPreferences() {
        if (!this.currentUser) return;
        
        const cardSize = this.getActiveFilterValue('cardSize');
        const defaultWatchPreference = this.getActiveFilterValue('watchPreference');
        
        try {
            await fetch(`${this.baseUrl}/users/${this.currentUser.id}/preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    card_size: cardSize,
                    default_watch_preference: defaultWatchPreference
                })
            });
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }
}

// Initialize the app
const mediaTracker = new MediaTracker();