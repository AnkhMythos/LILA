// backend/src/routes/phaseone.js
import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { chatWithOllama } from '../services/ollama.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

const MODELO = 'llama3.2:3b';

let phaseoneActivo = false;

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'phaseone.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS memoria (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

// GET /api/phaseone/status
router.get('/status', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) AS c FROM memoria').get().c;
    res.json({ activo: phaseoneActivo, memoria_claves: total, modelo: MODELO });
});

// POST /api/phaseone/toggle
router.post('/toggle', (req, res) => {
    phaseoneActivo = !phaseoneActivo;
    res.json({ activo: phaseoneActivo });
});

// POST /api/phaseone/pensar  { task }
router.post('/pensar', async (req, res) => {
    const { task } = req.body || {};
    if (!task || !String(task).trim()) {
        return res.status(400).json({ detail: 'Falta el campo "task"' });
    }
    try {
        const sys = `Sos PHASEONE, un modo de razonamiento profundo.
Antes de responder, pensá paso a paso. Devolvé:
1. Un razonamiento breve (2-3 líneas).
2. La respuesta final clara y concisa.`;
        const respuesta = await chatWithOllama(
            [
                { role: 'system', content: sys },
                { role: 'user',   content: task.trim() }
            ],
            MODELO
        );
        res.json({ task: task.trim(), final: respuesta });
    } catch (err) {
        console.error('[phaseone] pensar:', err);
        res.status(500).json({ detail: err.message || 'Error en PHASEONE' });
    }
});

// POST /api/phaseone/recordar  { clave, valor }
router.post('/recordar', (req, res) => {
    const { clave, valor } = req.body || {};
    if (!clave || valor === undefined) {
        return res.status(400).json({ detail: 'Faltan "clave" y "valor"' });
    }
    try {
        db.prepare(`
            INSERT INTO memoria (clave, valor, actualizado_en)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(clave) DO UPDATE SET
                valor = excluded.valor,
                actualizado_en = CURRENT_TIMESTAMP
        `).run(String(clave), String(valor));
        res.json({ success: true, clave, valor });
    } catch (err) {
        console.error('[phaseone] recordar:', err);
        res.status(500).json({ detail: 'Error guardando memoria' });
    }
});

// GET /api/phaseone/recall
router.get('/recall', (req, res) => {
    const filas = db.prepare(
        'SELECT clave, valor, actualizado_en FROM memoria ORDER BY actualizado_en DESC'
    ).all();
    res.json(filas);
});

// POST /api/phaseone/coordinar  { task }
router.post('/coordinar', async (req, res) => {
    const { task } = req.body || {};
    if (!task || !String(task).trim()) {
        return res.status(400).json({ detail: 'Falta el campo "task"' });
    }
    try {
        const memoria = db.prepare(
            'SELECT clave, valor FROM memoria ORDER BY actualizado_en DESC LIMIT 10'
        ).all();
        const contexto = memoria.length
            ? `Contexto recordado:\n${memoria.map(m => `- ${m.clave}: ${m.valor}`).join('\n')}`
            : 'No hay memoria previa.';

        const sys = `Sos PHASEONE, un coordinador con memoria persistente.
${contexto}

Analizá la tarea, usá el contexto si es relevante, y devolvé una respuesta final clara.`;

        const final = await chatWithOllama(
            [
                { role: 'system', content: sys },
                { role: 'user',   content: task.trim() }
            ],
            MODELO
        );

        res.json({
            dialogo: [memoria.length ? `🧠 Usando ${memoria.length} recuerdos` : '🧠 Sin memoria previa'],
            final
        });
    } catch (err) {
        console.error('[phaseone] coordinar:', err);
        res.status(500).json({ detail: err.message || 'Error coordinando PHASEONE' });
    }
});

export default router;