// backend/src/server.js
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';

import controlRemoto from './agents/control-remoto.js';

import noticiasRouter   from './routes/noticias.js';
import ragRouter        from './routes/rag.js';
import searchRouter     from './routes/search.js';
import memoryRouter     from './routes/memory.js';
import wikipediaRouter  from './routes/wikipedia.js';
import pythonRouter     from './routes/python.js';
import multiagentRouter from './routes/multiagent.js';
import chatRouter       from './routes/chat.js';
import mcpRouter        from './routes/mcp.js';
import { initMCP, cerrarMCP, estaActivoMCP, listarToolsMCP } from './services/mcpClient.js';

const app = express();
const PORT = 8000;
const OLLAMA_URL = 'http://127.0.0.1:11434';

app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ============================================================
// HEALTH BÁSICO
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend LILA está vivo' });
});

// ============================================================
// HEALTH COMPLETO — verifica TODOS los subsistemas
// ============================================================
app.get('/api/health/full', async (req, res) => {
    const resultado = {
        timestamp: new Date().toISOString(),
        backend: { ok: true },
        ollama:  { ok: false, url: OLLAMA_URL, modelos: 0, error: null },
        mcp:     { ok: false, activo: false, servidores: 0, tools: 0, error: null },
        websocket: { ok: true, clientes: 0 },
        routers: { ok: true, montados: [] },
        dbs:     { ok: true, archivos: [] }
    };

    // --- Ollama ---
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
        clearTimeout(timer);
        if (resp.ok) {
            const data = await resp.json();
            resultado.ollama.ok = true;
            resultado.ollama.modelos = (data.models || []).length;
        } else {
            resultado.ollama.error = `HTTP ${resp.status}`;
        }
    } catch (e) {
        resultado.ollama.error = e.message;
    }

    // --- MCP ---
    try {
        resultado.mcp.activo = estaActivoMCP();
        const tools = listarToolsMCP();
        resultado.mcp.tools = tools.length;
        const servidores = new Set(tools.map(t => t.servidor));
        resultado.mcp.servidores = servidores.size;
        resultado.mcp.ok = resultado.mcp.servidores > 0;
    } catch (e) {
        resultado.mcp.error = e.message;
    }

    // --- WebSocket ---
    try {
        resultado.websocket.clientes = wss.clients.size;
    } catch (e) {}

    // --- Routers ---
    const rutas = [
        '/api/noticias', '/api/rag', '/api/search', '/api/memory',
        '/api/wikipedia', '/api/python', '/api/multiagent', '/api/chat', '/api/mcp'
    ];
    resultado.routers.montados = rutas;

    // --- Bases de datos ---
    try {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const dataDir = path.join(__dirname, '..', 'data');
        if (fs.existsSync(dataDir)) {
            const archivos = fs.readdirSync(dataDir);
            resultado.dbs.archivos = archivos;
        }
    } catch (e) {}

    // Código HTTP según estado general
    const todoOk = resultado.ollama.ok && resultado.mcp.ok;
    res.status(todoOk ? 200 : 207).json(resultado);
});

// ============================================================
// ROUTERS
// ============================================================
app.use('/api/noticias',   noticiasRouter);
app.use('/api/rag',        ragRouter);
app.use('/api/search',     searchRouter);
app.use('/api/memory',     memoryRouter);
app.use('/api/wikipedia',  wikipediaRouter);
app.use('/api/python',     pythonRouter);
app.use('/api/multiagent', multiagentRouter);
app.use('/api/chat',       chatRouter);
app.use('/api/mcp',        mcpRouter);

// ============================================================
// HARDWARE
// ============================================================
app.get('/api/hardware/dispositivos', (req, res) => {
    try {
        const dispositivos = controlRemoto.devices.map(dev => ({
            id: `${dev.deviceDescriptor.idVendor}:${dev.deviceDescriptor.idProduct}`,
            vendor: `0x${dev.deviceDescriptor.idVendor.toString(16).toUpperCase()}`,
            product: `0x${dev.deviceDescriptor.idProduct.toString(16).toUpperCase()}`,
            bus: dev.busNumber,
            address: dev.deviceAddress
        }));
        res.json(dispositivos);
    } catch (error) {
        console.error('❌ Error al listar dispositivos:', error);
        res.status(500).json({ error: 'Fallo al leer dispositivos USB' });
    }
});

// ============================================================
// MODELOS
// ============================================================
app.get('/api/models', async (req, res) => {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`);
        const data = await response.json();

        if (!Array.isArray(data.models) || data.models.length === 0) {
            return res.json([{ name: 'llama3.2:3b', id: 'llama3.2:3b', size: '2.0 GB' }]);
        }

        const formatearBytes = (bytes) => {
            if (!bytes || typeof bytes !== 'number') return '';
            const GB = 1e9, MB = 1e6;
            if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
            if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
            return `${bytes} B`;
        };

        const modelos = data.models
            .map(m => ({
                name: m.name,
                id: m.name,
                size: formatearBytes(m.size),
                _bytes: m.size || 0
            }))
            .sort((a, b) => a._bytes - b._bytes)
            .map(({ name, id, size }) => ({ name, id, size }));

        res.json(modelos);
    } catch (e) {
        console.error('[models] Error:', e.message);
        res.json([{ name: 'llama3.2:3b', id: 'llama3.2:3b', size: '2.0 GB' }]);
    }
});

// ============================================================
// ORQUESTADOR
// ============================================================
app.post('/api/router/', async (req, res) => {
    const { mensaje } = req.body;
    const lowerMsg = String(mensaje || '').toLowerCase();
    let agente = null;
    let mensaje_para_agente = mensaje;

    if (lowerMsg.includes('código') || lowerMsg.includes('programar') || lowerMsg.includes('python') || lowerMsg.includes('javascript')) {
        agente = 'coder';
        mensaje_para_agente = `Actúa como un experto programador. Tarea: ${mensaje}`;
    } else if (lowerMsg.includes('resumen') || lowerMsg.includes('analiza')) {
        agente = 'analyst';
        mensaje_para_agente = `Actúa como un analista experto. Tarea: ${mensaje}`;
    } else if (lowerMsg.includes('control') || lowerMsg.includes('enciende') || lowerMsg.includes('apaga')) {
        agente = 'control-remoto';
        mensaje_para_agente = mensaje;
    }

    res.json({ agente, mensaje_para_agente });
});

// ============================================================
// AGENTES
// ============================================================
app.post('/api/agentes/:agente/ejecutar', async (req, res) => {
    const { agente } = req.params;
    const { tarea, dispositivo, comando } = req.body;

    if (agente === 'control-remoto') {
        try {
            let targetDevice = dispositivo || 'default_device';
            let actionCommand = comando;
            if (!actionCommand && tarea) {
                const t = tarea.toLowerCase();
                if (t.includes('enciende') || t.includes('activar')) actionCommand = 'ON';
                else if (t.includes('apaga') || t.includes('desactivar')) actionCommand = 'OFF';
                else actionCommand = tarea;
            }
            if (!actionCommand) return res.status(400).json({ error: 'No se pudo determinar el comando.' });
            const exito = controlRemoto.sendCommand(targetDevice, actionCommand);
            if (exito) {
                return res.json({ agente: 'control-remoto', modelo: 'Hardware-Interface-v1',
                    respuesta: `✅ Comando "${actionCommand}" enviado a ${targetDevice}.` });
            }
            return res.status(500).json({ agente: 'control-remoto',
                respuesta: `❌ Sin conexión activa con ${targetDevice}.` });
        } catch (error) {
            console.error('❌ Error Control Remoto:', error);
            return res.status(500).json({ error: 'Error interno del agente de control.' });
        }
    }

    const modelo = 'llama3.2:3b';
    try {
        const systemPrompt = agente === 'coder'
            ? 'Eres un asistente experto en programación. Responde siempre con código limpio y explicaciones breves.'
            : 'Eres un asistente analítico y detallado.';
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelo,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: tarea }
                ],
                stream: false
            })
        });
        const data = await response.json();
        res.json({ agente, modelo, respuesta: data.message.content });
    } catch (error) {
        console.error('Error en agente LLM:', error);
        res.status(500).json({ error: 'Fallo en la ejecución del agente' });
    }
});

// ============================================================
// WEBSOCKET CON BROADCAST
// ============================================================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/instances/ws' });

function heartbeat() { this.isAlive = true; }

function listaClientes() {
    const ids = [];
    wss.clients.forEach((c) => { if (c.clienteId) ids.push(c.clienteId); });
    return ids;
}

function broadcast(emisor, payload) {
    const mensaje = JSON.stringify(payload);
    let contador = 0;
    wss.clients.forEach((client) => {
        if (client !== emisor && client.readyState === 1) {
            try { client.send(mensaje); contador++; } catch (e) {}
        }
    });
    return contador;
}

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('connection', (ws, req) => {
    const clienteId = 'inst_' + Math.random().toString(36).substring(2, 8);
    ws.clienteId = clienteId;
    console.log(`✅ Cliente WS conectado (${clienteId}) desde: ${req.headers.origin}`);

    ws.isAlive = true;
    ws.on('pong', heartbeat);

    const clientes = listaClientes();
    console.log(`   📋 Clientes actuales: [${clientes.join(', ')}]`);

    try {
        ws.send(JSON.stringify({ type: 'bienvenida', clienteId, clientes }));
    } catch (e) {}

    const enviados = broadcast(ws, {
        type: 'nueva_instancia',
        clienteId,
        clientes: listaClientes()
    });
    console.log(`   → Notificado a ${enviados} cliente(s)`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'estado_dialogo') {
                console.log(`📩 [${clienteId}] estado_dialogo → ${data.content && data.content.activo ? 'ON' : 'OFF'}`);
                const n = broadcast(ws, {
                    type: 'estado_dialogo',
                    content: data.content,
                    origen: clienteId
                });
                console.log(`   → Retransmitido a ${n} cliente(s)`);
                return;
            }

            if (data.type === 'mensaje') {
                console.log(`📨 [${clienteId}] MENSAJE: "${String(data.content || '').slice(0, 80)}"`);
                const n = broadcast(ws, {
                    type: 'mensaje',
                    content: data.content,
                    origen: clienteId,
                    timestamp: new Date().toISOString()
                });
                console.log(`   → Retransmitido a ${n} cliente(s)`);
                return;
            }

            console.log(`📩 [${clienteId}] ${data.type}`);
            const n = broadcast(ws, { ...data, origen: clienteId });
            console.log(`   → Retransmitido a ${n} cliente(s)`);
        } catch (e) {
            console.error('❌ Error WS:', e);
        }
    });

    ws.on('close', () => {
        console.log(`🔌 Cliente WS desconectado (${clienteId})`);
        const n = broadcast(ws, {
            type: 'desconexion',
            clienteId,
            clientes: listaClientes()
        });
        console.log(`   → Notificado a ${n} cliente(s)`);
    });

    ws.on('error', (error) => console.error(`❌ Error WS [${clienteId}]:`, error));
});

server.on('close', () => {
    clearInterval(interval);
    cerrarMCP().catch(() => {});
});

// ============================================================
// ARRANQUE
// ============================================================
initMCP().catch(e => console.error('[mcp] Falló init:', e.message));

server.listen(PORT, () => {
    console.log(`🚀 Backend LILA corriendo en: http://127.0.0.1:${PORT}`);
    console.log(`🔌 WebSocket:      ws://127.0.0.1:${PORT}/api/instances/ws`);
    console.log(`💬 WS multi-chat:  broadcast entre instancias activado`);
    console.log(`📦 Ollama URL:     ${OLLAMA_URL}`);
    console.log(`🔌 MCP:            /api/mcp/status`);
    console.log(`🩺 Health completo: /api/health/full`);
    console.log('🔌 Control Remoto: desactivado (activar manualmente).');
});