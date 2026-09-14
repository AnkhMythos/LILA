// backend/src/services/mcpClient.js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ============================================================
// ESTADO GLOBAL
// ============================================================
const clientes = new Map();
let inicializado = false;
let mcpActivo = false;   // Por defecto DESACTIVADO

// ============================================================
// CARGAR CONFIG
// ============================================================
function cargarConfig() {
    const configPath = path.join(__dirname, '..', '..', 'mcp-servers.json');
    if (!fs.existsSync(configPath)) {
        console.warn('[mcp] No existe mcp-servers.json');
        return { servers: {} };
    }
    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        console.error('[mcp] Error leyendo mcp-servers.json:', e.message);
        return { servers: {} };
    }
}

// ============================================================
// CONECTAR A UN SERVIDOR MCP
// ============================================================
async function conectarServidor(nombre, config) {
    if (!config.enabled) {
        console.log(`[mcp] ${nombre}: deshabilitado en config`);
        return;
    }
    try {
        console.log(`[mcp] Conectando a "${nombre}"...`);
        const backendDir = path.join(__dirname, '..', '..');
        const args = (config.args || []).map(a =>
            path.isAbsolute(a) ? a : path.join(backendDir, a)
        );
        const transport = new StdioClientTransport({
            command: config.command,
            args: args,
            env: { ...process.env, ...(config.env || {}) }
        });
        const client = new Client(
            { name: 'lila-client', version: '1.0.0' },
            { capabilities: {} }
        );
        await client.connect(transport);
        const toolsResp = await client.listTools();
        const tools = toolsResp.tools || [];
        clientes.set(nombre, { client, tools, transport });
        console.log(`[mcp] ✅ "${nombre}" conectado. ${tools.length} herramienta(s):`);
        tools.forEach(t => console.log(`      - ${t.name}: ${t.description || '(sin descripción)'}`));
    } catch (e) {
        console.error(`[mcp] ❌ Error conectando a "${nombre}":`, e.message);
    }
}

// ============================================================
// INICIALIZAR TODOS LOS SERVIDORES
// ============================================================
export async function initMCP() {
    if (inicializado) return;
    inicializado = true;
    const config = cargarConfig();
    const servers = config.servers || {};
    if (Object.keys(servers).length === 0) {
        console.log('[mcp] Sin servidores configurados');
        return;
    }
    console.log(`[mcp] Inicializando ${Object.keys(servers).length} servidor(es)...`);
    for (const [nombre, cfg] of Object.entries(servers)) {
        await conectarServidor(nombre, cfg);
    }
}

// ============================================================
// ESTADO DE ACTIVACIÓN
// ============================================================
export function estaActivoMCP() {
    return mcpActivo;
}
export function activarMCP() {
    mcpActivo = true;
    console.log('[mcp] 🟢 MCP ACTIVADO');
    return mcpActivo;
}
export function desactivarMCP() {
    mcpActivo = false;
    console.log('[mcp] 🔴 MCP DESACTIVADO');
    return mcpActivo;
}
export function toggleMCP() {
    mcpActivo = !mcpActivo;
    console.log(`[mcp] ${mcpActivo ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'}`);
    return mcpActivo;
}

// ============================================================
// LISTAR TOOLS
// ============================================================
export function listarToolsMCP() {
    const resultado = [];
    for (const [servidor, data] of clientes.entries()) {
        for (const tool of data.tools) {
            resultado.push({
                servidor,
                name: tool.name,
                description: tool.description || '',
                inputSchema: tool.inputSchema || { type: 'object', properties: {} },
                qualifiedName: `${servidor}.${tool.name}`
            });
        }
    }
    return resultado;
}

// ============================================================
// FORMATO PARA OLLAMA
// ============================================================
export function toolsParaOllama() {
    return listarToolsMCP().map(t => ({
        type: 'function',
        function: {
            name: t.qualifiedName.replace(/\./g, '__'),
            description: t.description || t.name,
            parameters: t.inputSchema
        }
    }));
}

// ============================================================
// INVOCAR UNA TOOL
// ============================================================
export async function ejecutarToolMCP(nombreCompleto, args = {}) {
    let servidor, toolName;
    if (nombreCompleto.includes('__')) {
        [servidor, toolName] = nombreCompleto.split('__', 2);
    } else if (nombreCompleto.includes('.')) {
        [servidor, toolName] = nombreCompleto.split('.', 2);
    } else {
        toolName = nombreCompleto;
        for (const [s, data] of clientes.entries()) {
            if (data.tools.some(t => t.name === toolName)) { servidor = s; break; }
        }
    }
    if (!servidor) return { error: `No se encontró ninguna tool llamada "${nombreCompleto}"` };
    const data = clientes.get(servidor);
    if (!data) return { error: `Servidor "${servidor}" no está conectado` };
    try {
        const resultado = await data.client.callTool({
            name: toolName,
            arguments: args
        });
        const content = resultado.content || [];
        const texto = content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        return { servidor, tool: toolName, resultado: texto, raw: resultado };
    } catch (e) {
        return { error: `Error invocando ${nombreCompleto}: ${e.message}` };
    }
}

// ============================================================
// ESTADO GENERAL
// ============================================================
export function estadoMCP() {
    const servidores = [];
    for (const [nombre, data] of clientes.entries()) {
        servidores.push({
            nombre,
            conectado: true,
            tools: data.tools.length,
            herramientas: data.tools.map(t => t.name)
        });
    }
    return {
        activo: mcpActivo,
        inicializado,
        servidores_conectados: servidores.length,
        servidores,
        total_tools: listarToolsMCP().length
    };
}

// ============================================================
// CERRAR
// ============================================================
export async function cerrarMCP() {
    for (const [nombre, data] of clientes.entries()) {
        try {
            await data.client.close();
            console.log(`[mcp] ${nombre} cerrado`);
        } catch (e) {
            console.warn(`[mcp] Error cerrando ${nombre}:`, e.message);
        }
    }
    clientes.clear();
}