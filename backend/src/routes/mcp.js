// backend/src/routes/mcp.js
import express from 'express';
import {
    listarToolsMCP,
    ejecutarToolMCP,
    estadoMCP,
    toggleMCP,
    activarMCP,
    desactivarMCP
} from '../services/mcpClient.js';

const router = express.Router();

// GET /api/mcp/status
router.get('/status', (req, res) => {
    res.json(estadoMCP());
});

// GET /api/mcp/tools
router.get('/tools', (req, res) => {
    res.json(listarToolsMCP());
});

// POST /api/mcp/call  { tool, args }
router.post('/call', async (req, res) => {
    const { tool, args } = req.body || {};
    if (!tool) return res.status(400).json({ detail: 'Falta el campo "tool"' });
    const resultado = await ejecutarToolMCP(tool, args || {});
    if (resultado.error) return res.status(500).json(resultado);
    res.json(resultado);
});

// POST /api/mcp/toggle
router.post('/toggle', (req, res) => {
    const activo = toggleMCP();
    res.json({ activo });
});

// POST /api/mcp/activar
router.post('/activar', (req, res) => {
    const activo = activarMCP();
    res.json({ activo });
});

// POST /api/mcp/desactivar
router.post('/desactivar', (req, res) => {
    const activo = desactivarMCP();
    res.json({ activo });
});

export default router;