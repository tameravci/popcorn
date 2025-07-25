from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import requests
import sqlite3
import json
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# TMDB Configuration
TMDB_API_KEY = 'df3e498937ba9d64ad9c717f1a7f7792'
TMDB_BASE_URL = 'https://api.themoviedb.org/3'
TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

# Database initialization
def init_db():
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Check if we need to migrate the media_items table
    cursor.execute("PRAGMA table_info(media_items)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'media_data' not in columns:
        # Drop old table and create new one
        cursor.execute('DROP TABLE IF EXISTS media_items')
        print("Migrating database: Recreating media_items table with new schema")
    
    # Media items table - simplified with JSON storage
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media_items (
            tmdb_id INTEGER,
            user_id INTEGER,
            media_type TEXT,
            media_data TEXT,
            added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (tmdb_id, user_id, media_type),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # User preferences table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            card_size TEXT DEFAULT 'medium',
            default_watch_preference TEXT DEFAULT 'all',
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

@app.route('/')
def index():
    return render_template('index.html')

# User Management Routes
@app.route('/api/users', methods=['GET'])
def get_users():
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, name FROM users ORDER BY name')
    users = [{'id': row[0], 'name': row[1]} for row in cursor.fetchall()]
    conn.close()
    return jsonify(users)

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute('INSERT INTO users (name) VALUES (?)', (name,))
        user_id = cursor.lastrowid
        
        # Create default preferences
        cursor.execute('''
            INSERT INTO user_preferences (user_id, card_size, default_watch_preference) 
            VALUES (?, 'medium', 'all')
        ''', (user_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'id': user_id, 'name': name}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'User already exists'}), 409

# TMDB Proxy Routes
@app.route('/api/search', methods=['GET'])
def search_media():
    query = request.args.get('query', '')
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    try:
        print(f"Searching for: {query}")  # Debug log
        response = requests.get(
            f'{TMDB_BASE_URL}/search/multi',
            params={
                'api_key': TMDB_API_KEY,
                'query': query
            },
            timeout=10
        )
        print(f"TMDB Response status: {response.status_code}")  # Debug log
        response.raise_for_status()
        data = response.json()
        print(f"TMDB Response data keys: {data.keys()}")  # Debug log
        return jsonify(data)
    except requests.RequestException as e:
        print(f"TMDB API Error: {e}")  # Debug log
        return jsonify({'error': f'Failed to search media: {str(e)}'}), 500
    except Exception as e:
        print(f"General Error: {e}")  # Debug log
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/api/media/<media_type>/<int:media_id>', methods=['GET'])
def get_media_details(media_type, media_id):
    try:
        response = requests.get(
            f'{TMDB_BASE_URL}/{media_type}/{media_id}',
            params={'api_key': TMDB_API_KEY}
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.RequestException as e:
        return jsonify({'error': 'Failed to get media details'}), 500

@app.route('/api/media/<media_type>/<int:media_id>/credits', methods=['GET'])
def get_media_credits(media_type, media_id):
    try:
        response = requests.get(
            f'{TMDB_BASE_URL}/{media_type}/{media_id}/credits',
            params={'api_key': TMDB_API_KEY}
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.RequestException as e:
        return jsonify({'error': 'Failed to get media credits'}), 500

# User Media Management Routes
@app.route('/api/users/<int:user_id>/media', methods=['GET'])
def get_user_media(user_id):
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT tmdb_id, media_type, media_data, added_date
        FROM media_items 
        WHERE user_id = ?
        ORDER BY added_date ASC
    ''', (user_id,))
    
    media_items = []
    for row in cursor.fetchall():
        media_data = json.loads(row[2])
        media_data['id'] = row[0]  # Add tmdb_id as id for frontend compatibility
        media_data['media_type'] = row[1]
        media_data['added_date'] = row[3]
        media_items.append(media_data)
    
    conn.close()
    return jsonify(media_items)

@app.route('/api/users/<int:user_id>/media', methods=['POST'])
def add_user_media(user_id):
    data = request.json
    
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    
    # Check if media already exists for this user
    cursor.execute('''
        SELECT tmdb_id FROM media_items 
        WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
    ''', (user_id, data['tmdb_id'], data['media_type']))
    
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Media already exists in user library'}), 409
    
    # Store all media data as JSON (excluding tmdb_id, user_id, media_type which are separate columns)
    media_data = {
        'title': data.get('title'),
        'poster_path': data.get('poster_path'),
        'vote_average': data.get('vote_average', 0),
        'overview': data.get('overview'),
        'release_date': data.get('release_date'),
        'runtime': data.get('runtime', 0),
        'seasons': data.get('seasons', 0),
        'status': data.get('status', 'to-watch'),
        'watch_preference': data.get('watch_preference', 'all')
    }
    
    # Add media item
    cursor.execute('''
        INSERT INTO media_items (user_id, tmdb_id, media_type, media_data)
        VALUES (?, ?, ?, ?)
    ''', (user_id, data['tmdb_id'], data['media_type'], json.dumps(media_data)))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Media added successfully'}), 201

@app.route('/api/users/<int:user_id>/media/<int:tmdb_id>/<media_type>', methods=['PUT'])
def update_user_media(user_id, tmdb_id, media_type):
    data = request.json
    
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    
    # Get current media data
    cursor.execute('''
        SELECT media_data FROM media_items 
        WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
    ''', (user_id, tmdb_id, media_type))
    
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Media not found'}), 404
    
    # Update the JSON data
    media_data = json.loads(row[0])
    if 'status' in data:
        media_data['status'] = data['status']
    if 'watch_preference' in data:
        media_data['watch_preference'] = data['watch_preference']
    
    # Save updated data
    cursor.execute('''
        UPDATE media_items 
        SET media_data = ?
        WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
    ''', (json.dumps(media_data), user_id, tmdb_id, media_type))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Media updated successfully'})

@app.route('/api/users/<int:user_id>/media/<int:tmdb_id>/<media_type>', methods=['DELETE'])
def delete_user_media(user_id, tmdb_id, media_type):
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        DELETE FROM media_items 
        WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
    ''', (user_id, tmdb_id, media_type))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Media deleted successfully'})

# User Preferences Routes
@app.route('/api/users/<int:user_id>/preferences', methods=['GET'])
def get_user_preferences(user_id):
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT card_size, default_watch_preference 
        FROM user_preferences 
        WHERE user_id = ?
    ''', (user_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return jsonify({
            'card_size': row[0],
            'default_watch_preference': row[1]
        })
    else:
        return jsonify({
            'card_size': 'medium',
            'default_watch_preference': 'all'
        })

@app.route('/api/users/<int:user_id>/preferences', methods=['PUT'])
def update_user_preferences(user_id):
    data = request.json
    
    conn = sqlite3.connect('media_tracker.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE user_preferences 
        SET card_size = ?, default_watch_preference = ?
        WHERE user_id = ?
    ''', (data.get('card_size'), data.get('default_watch_preference'), user_id))
    
    if cursor.rowcount == 0:
        # Create preferences if they don't exist
        cursor.execute('''
            INSERT INTO user_preferences (user_id, card_size, default_watch_preference)
            VALUES (?, ?, ?)
        ''', (user_id, data.get('card_size'), data.get('default_watch_preference')))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Preferences updated successfully'})

if __name__ == '__main__':
    app.run(debug=True, port=3000)