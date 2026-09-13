import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'seo-history.db');

const db = new sqlite3.Database(dbPath);

export const dbReady = new Promise((resolve, reject) => {
  db.serialize(() => {
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
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS rank_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        keyword TEXT NOT NULL,
        target_url TEXT NOT NULL,
        position INTEGER,
        serp_features TEXT
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_audits_url ON audits(url)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON audits(timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rank_checked_at ON rank_history(checked_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rank_kw_url ON rank_history(keyword, target_url)`, (err) => {
      if (err) reject(err);
      else resolve();
    });
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

export async function saveRanking(keyword, targetUrl, position, serpFeatures = []) {
  await dbReady;
  const sql = `INSERT INTO rank_history (keyword, target_url, position, serp_features) VALUES (?, ?, ?, ?)`;
  try {
    const featuresJson = JSON.stringify(serpFeatures || []);
    await runQuery(sql, [keyword, targetUrl, position, featuresJson]);
    return true;
  } catch (error) {
    console.error('Failed to save ranking:', error);
    return false;
  }
}

export async function getRankHistory(keyword = null, targetUrl = null, days = 30) {
  await dbReady;
  try {
    let sql = `SELECT * FROM rank_history WHERE checked_at >= datetime('now', '-${parseInt(days)} days')`;
    const params = [];
    if (keyword) {
      sql += ` AND keyword = ?`;
      params.push(keyword);
    }
    if (targetUrl) {
      sql += ` AND target_url = ?`;
      params.push(targetUrl);
    }
    sql += ` ORDER BY checked_at ASC`;
    return await allQuery(sql, params);
  } catch (error) {
    console.error('Failed to get rank history:', error);
    return [];
  }
}
