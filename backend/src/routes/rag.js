// backend/src/routes/rag.js
/**
 * Router RAG (Retrieval-Augmented Generation) para LILA.
 * Almacenamiento en SQLite con búsqueda full-text (FTS5).
 */

import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'rag.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ------------------------------------------------------------------
// Inicialización
// ------------------------------------------------------------------
db.exec(`
    CREATE TABLE IF NOT EXISTS fragmentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        texto TEXT NOT NULL,
        metadata TEXT,
        hash TEXT UNIQUE,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS fragmentos_fts
    USING fts5(texto, content='fragmentos', content_rowid='id');

    CREATE TRIGGER IF NOT EXISTS fragmentos_ai
    AFTER INSERT ON fragmentos BEGIN
        INSERT INTO fragmentos_fts(rowid, texto) VALUES (new.id, new.texto);
    END;

    CREATE TRIGGER IF NOT EXISTS fragmentos_ad
    AFTER DELETE ON fragmentos BEGIN
        INSERT INTO fragmentos_fts(fragmentos_fts, rowid, texto)
        VALUES('delete', old.id, old.texto);
    END;
`);

function hashTexto(t) {
    return crypto.createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 32);
}

function safeJson(s) {
    try { return JSON.parse(s); } catch { return {}; }
}

// ------------------------------------------------------------------
// POST /api/rag/add
// ------------------------------------------------------------------
router.post('/add', (req, res) => {
    const { text, metadata } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ detail: 'Texto vacío' });
    }

    const texto = text.trim();
    const h = hashTexto(texto);
    const metaJson = JSON.stringify(metadata || {});

    try {
        const stmt = db.prepare(
            'INSERT INTO fragmentos (texto, metadata, hash) VALUES (?, ?, ?)'
        );
        const info = stmt.run(texto, metaJson, h);
        const total = db.prepare('SELECT COUNT(*) AS c FROM fragmentos').get().c;
        return res.json({ id: info.lastInsertRowid, indexado: true, total });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            const row = db.prepare('SELECT id FROM fragmentos WHERE hash = ?').get(h);
            const total = db.prepare('SELECT COUNT(*) AS c FROM fragmentos').get().c;
            return res.json({ id: row ? row.id : 0, indexado: false, total });
        }
        console.error('[rag] add:', err);
        return res.status(500).json({ detail: 'Error indexando fragmento' });
    }
});

// ------------------------------------------------------------------
// GET /api/rag/search?q=<consulta>&top_k=<n>
// ------------------------------------------------------------------
router.get('/search', (req, res) => {
    const q = (req.query.q || '').trim();
    const topK = Math.min(Math.max(parseInt(req.query.top_k) || 5, 1), 50);

    if (!q) {
        return res.json({ query: q, total: 0, resultados: [] });
    }

    const qLimpia = q.replace(/["']/g, ' ').split(/\s+/).filter(Boolean).join(' ');
    if (!qLimpia) {
        return res.json({ query: q, total: 0, resultados: [] });
    }

    let filas;
    try {
        filas = db.prepare(`
            SELECT f.id, f.texto, f.metadata, f.creado_en,
                   bm25(fragmentos_fts) AS score
            FROM fragmentos_fts
            JOIN fragmentos f ON f.id = fragmentos_fts.rowid
            WHERE fragmentos_fts MATCH ?
            ORDER BY score
            LIMIT ?
        `).all(qLimpia, topK);
    } catch (err) {
        filas = db.prepare(`
            SELECT id, texto, metadata, creado_en, 0 AS score
            FROM fragmentos
            WHERE texto LIKE ?
            ORDER BY creado_en DESC
            LIMIT ?
        `).all(`%${q}%`, topK);
    }

    const resultados = filas.map(f => ({
        id: f.id,
        texto: f.texto,
        metadata: safeJson(f.metadata),
        creado_en: f.creado_en,
        score: f.score
    }));

    res.json({ query: q, total: resultados.length, resultados });
});

// ------------------------------------------------------------------
// GET /api/rag/stats
// ------------------------------------------------------------------
router.get('/stats', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) AS c FROM fragmentos').get().c;
    const rows = db.prepare('SELECT metadata FROM fragmentos').all();

    const fuentes = {};
    for (const r of rows) {
        const m = safeJson(r.metadata);
        const fuente = m.source || m.fuente || 'desconocida';
        fuentes[fuente] = (fuentes[fuente] || 0) + 1;
    }

    const ultimo = db.prepare('SELECT MAX(creado_en) AS u FROM fragmentos').get().u;

    res.json({ total, fuentes, ultimo_agregado: ultimo });
});

// ------------------------------------------------------------------
// DELETE /api/rag/clear
// ------------------------------------------------------------------
router.delete('/clear', (req, res) => {
    const antes = db.prepare('SELECT COUNT(*) AS c FROM fragmentos').get().c;
    db.prepare('DELETE FROM fragmentos').run();
    res.json({ deleted: antes });
});

export default router;