// backend/src/routes/python.js
import express from 'express';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const TIMEOUT_MS = 15000;

// POST /api/python/ejecutar  { codigo: "..." }
router.post('/ejecutar', async (req, res) => {
    const { codigo } = req.body || {};
    if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
        return res.status(400).json({ detail: 'Falta el campo "codigo"' });
    }

    const tmpFile = path.join(os.tmpdir(), `lila_${uuidv4()}.py`);

    try {
        await fs.writeFile(tmpFile, codigo, 'utf-8');

        exec(
            `${PYTHON_BIN} "${tmpFile}"`,
            { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => {
                fs.unlink(tmpFile).catch(() => {});

                if (error && error.killed) {
                    return res.json({
                        stdout: stdout || '',
                        stderr: `⏱️ Timeout tras ${TIMEOUT_MS / 1000}s`,
                        exit_code: -1
                    });
                }

                res.json({
                    stdout: stdout || '',
                    stderr: stderr || '',
                    exit_code: error ? (error.code || 1) : 0
                });
            }
        );
    } catch (err) {
        fs.unlink(tmpFile).catch(() => {});
        console.error('[python]', err);
        res.status(500).json({ detail: err.message });
    }
});

export default router;