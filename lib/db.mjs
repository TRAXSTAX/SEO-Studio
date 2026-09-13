import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'seo-history.db');

const db = new sqlite3.Database(dbPath);

export const dbReady = new Promise((resolve, reject) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      url TEXT,
      keyword TEXT,
      vitals_score INTEGER,
      content_score INTEGER,
      overall_score INTEGER
    )
  `, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export async function saveAudit(url, keyword, vitalsScore, contentScore, overallScore) {
  await dbReady;
  const sql = `INSERT INTO audits (url, keyword, vitals_score, content_score, overall_score) VALUES (?, ?, ?, ?, ?)`;
  try {
    await runQuery(sql, [url, keyword, vitalsScore, contentScore, overallScore]);
    return true;
  } catch (error) {
    console.error('Failed to save audit:', error);
    return false;
  }
}

export async function getHistory(url = null) {
  await dbReady;
  try {
    if (url) {
      return await allQuery('SELECT * FROM audits WHERE url = ? ORDER BY timestamp ASC', [url]);
    }
    return await allQuery('SELECT * FROM audits ORDER BY timestamp DESC LIMIT 50');
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
}
