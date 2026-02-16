/**
 * Ghostly Core - Database Layer
 * SQLite storage for terminal events, episodes, and embeddings
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

let db = null;
let SQL = null;

/**
 * Initialize database connection
 * @param {string} dbPath - Path to SQLite database
 * @returns {Promise<Object>} Database instance
 */
export async function initDatabase(dbPath = './data/ghostly.db') {
  const resolvedPath = path.resolve(process.cwd(), dbPath);
  
  // Ensure directory exists
  const dbDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Initialize SQL.js
  SQL = await initSqlJs();
  
  // Load existing or create new
  if (fs.existsSync(resolvedPath)) {
    const buffer = fs.readFileSync(resolvedPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  createTables();
  saveDatabase(resolvedPath);
  
  return db;
}

/**
 * Get database instance
 * @returns {Object} Database instance
 */
export function getDatabase() {
  return db;
}

/**
 * Save database to disk
 */
function saveDatabase(dbPath) {
  if (!db || !dbPath) return;
  
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * Create database tables
 */
function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS raw_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      cwd TEXT,
      git_branch TEXT,
      command TEXT NOT NULL,
      exit_code INTEGER,
      stdout_text TEXT,
      stderr_text TEXT,
      project_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_hash TEXT,
      summary TEXT NOT NULL,
      problem TEXT,
      environment TEXT,
      fix TEXT,
      keywords TEXT,
      embedding_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      vector TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_hash TEXT UNIQUE NOT NULL,
      name TEXT,
      root_path TEXT,
      git_remote TEXT,
      first_seen TEXT DEFAULT (datetime('now')),
      last_seen TEXT DEFAULT (datetime('now'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      cwd TEXT,
      git_branch TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      last_activity TEXT DEFAULT (datetime('now')),
      ended_at TEXT
    )
  `);
}

/**
 * Insert a terminal event
 * @param {Object} event - Event data
 * @returns {number} Inserted ID
 */
export function insertEvent(event) {
  const stmt = db.prepare(`
    INSERT INTO raw_events 
    (session_id, timestamp, cwd, git_branch, command, exit_code, stdout_text, stderr_text, project_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run([
    event.session_id,
    event.timestamp,
    event.cwd || null,
    event.git_branch || null,
    event.command,
    event.exit_code || null,
    event.stdout_text || null,
    event.stderr_text || null,
    event.project_hash || null
  ]);
  
  stmt.free();
  
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0][0] || 0;
}

/**
 * Insert an episode
 * @param {Object} episode - Episode data
 * @returns {number} Inserted ID
 */
export function insertEpisode(episode) {
  const stmt = db.prepare(`
    INSERT INTO episodes 
    (project_hash, summary, problem, environment, fix, keywords, embedding_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run([
    episode.project_hash,
    episode.summary,
    episode.problem,
    episode.environment,
    episode.fix,
    episode.keywords,
    episode.embedding_id || null
  ]);
  
  stmt.free();
  
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0][0] || 0;
}

/**
 * Get episodes for a project
 * @param {string} projectHash - Project hash
 * @param {number} limit - Max results
 * @returns {Array} Episodes
 */
export function getEpisodes(projectHash, limit = 10) {
  const results = db.exec(`
    SELECT * FROM episodes 
    WHERE project_hash = '${projectHash}'
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `);
  
  if (!results[0]) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

/**
 * Search episodes by keywords
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Array} Matching episodes
 */
export function searchEpisodes(query, limit = 5) {
  const escaped = query.replace(/'/g, "''");
  
  const results = db.exec(`
    SELECT * FROM episodes 
    WHERE summary LIKE '%${escaped}%' 
       OR problem LIKE '%${escaped}%' 
       OR keywords LIKE '%${escaped}%'
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `);
  
  if (!results[0]) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

/**
 * Insert embedding
 * @param {number} episodeId - Episode ID
 * @param {string} model - Model name
 * @param {Array} vector - Embedding vector
 * @returns {number} Inserted ID
 */
export function insertEmbedding(episodeId, model, vector) {
  const vectorStr = JSON.stringify(vector);
  
  const stmt = db.prepare(`
    INSERT INTO embeddings (episode_id, model, vector)
    VALUES (?, ?, ?)
  `);
  
  stmt.run([episodeId, model, vectorStr]);
  stmt.free();
  
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0][0] || 0;
}

/**
 * Get embedding for episode
 * @param {number} episodeId - Episode ID
 * @returns {Object|null} Embedding data
 */
export function getEmbedding(episodeId) {
  const stmt = db.prepare(`
    SELECT id, episode_id, model, vector, created_at 
    FROM embeddings 
    WHERE episode_id = ?
  `);
  
  stmt.bind([episodeId]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return { ...row, vector: JSON.parse(row.vector) };
  }
  
  stmt.free();
  return null;
}

/**
 * Upsert project
 * @param {Object} project - Project data
 */
export function upsertProject(project) {
  const existing = db.exec(`SELECT id FROM projects WHERE project_hash = '${project.project_hash}'`);
  
  if (existing[0]?.values?.length > 0) {
    db.run(`
      UPDATE projects 
      SET name = '${(project.name || '').replace(/'/g, "''")}', 
          root_path = '${(project.root_path || '').replace(/'/g, "''")}', 
          last_seen = datetime('now')
      WHERE project_hash = '${project.project_hash}'
    `);
  } else {
    db.run(`
      INSERT INTO projects (project_hash, name, root_path, last_seen)
      VALUES ('${project.project_hash}', '${(project.name || '').replace(/'/g, "''")}', '${(project.root_path || '').replace(/'/g, "''")}', datetime('now'))
    `);
  }
}

/**
 * Get project by hash
 * @param {string} projectHash - Project hash
 * @returns {Object|null} Project data
 */
export function getProject(projectHash) {
  const results = db.exec(`SELECT * FROM projects WHERE project_hash = '${projectHash}'`);
  
  if (!results[0]?.values?.length) return null;
  
  const columns = results[0].columns;
  const row = results[0].values[0];
  const obj = {};
  columns.forEach((col, i) => obj[col] = row[i]);
  return obj;
}

/**
 * Get database statistics
 * @returns {Object} Stats
 */
export function getStats() {
  const events = db.exec('SELECT COUNT(*) FROM raw_events');
  const episodes = db.exec('SELECT COUNT(*) FROM episodes');
  const projects = db.exec('SELECT COUNT(*) FROM projects');
  
  return {
    events: events[0]?.values[0][0] || 0,
    episodes: episodes[0]?.values[0][0] || 0,
    projects: projects[0]?.values[0][0] || 0
  };
}

export default {
  initDatabase,
  getDatabase,
  insertEvent,
  insertEpisode,
  getEpisodes,
  searchEpisodes,
  insertEmbedding,
  getEmbedding,
  upsertProject,
  getProject,
  getStats
};
