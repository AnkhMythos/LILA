// backend/src/routes/multiagent.js
import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { chatWithOllama, chatConTools } from '../services/ollama.js';
import { executeTool, listTools, TOOLS } from '../services/tools.js';
import { listarToolsMCP, ejecutarToolMCP, toolsParaOllama, estaActivoMCP } from '../services/mcpClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

console.log('📦 multiagent.js v3 cargado (respeta toggle MCP)');

const router = express.Router();
const MODELO_DEFAULT = 'llama3.2:3b';

// ============================================================
// BLACKLIST DE MODELOS
// ============================================================
const MODELOS_NO_CHAT = ['nomic', 'embed', 'minilm', 'bge-', 'e5-', 'gte-', 'jina'];

function sanitizarModelo(m) {
    if (!m || typeof m !== 'string') return MODELO_DEFAULT;
    const lower = m.toLowerCase();
    if (MODELOS_NO_CHAT.some(p => lower.includes(p))) {
        console.warn(`🚫 [multiagent] Modelo rechazado: "${m}" → ${MODELO_DEFAULT}`);
        return MODELO_DEFAULT;
    }
    return m;
}

// ============================================================
// ESTADO
// ============================================================
let multiagenteActivo = false;

// ============================================================
// SQLite
// ============================================================
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'multiagent.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS memoria (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS coordinaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tarea TEXT NOT NULL,
        plan TEXT,
        resultado TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

// ============================================================
// AGENTES
// ============================================================
const AGENTES = [
    { name: 'coder',      role: 'Programador',        description: 'Escribe, explica y depura código en cualquier lenguaje. Resuelve problemas técnicos.', tools: ['calculate'] },
    { name: 'analyst',    role: 'Analista',           description: 'Analiza datos, saca conclusiones y estructura información compleja.',                    tools: ['calculate'] },
    { name: 'writer',     role: 'Redactor',           description: 'Redacta con voseo rioplatense. Sumá lunfardo cuando encaje natural, sin caer en el cliché.', tools: [] },
    { name: 'critic',     role: 'Crítico',            description: 'Revisa, cuestiona y señala debilidades en las respuestas para mejorarlas.',              tools: [] },
    { name: 'researcher', role: 'Investigador',       description: 'Busca información actualizada en web, Wikipedia y MCP, sintetiza hallazgos.',            tools: ['buscarWeb', 'buscarWikipedia', 'getWeather', 'getDateTime', 'getLocation'] },
    { name: 'thinker',    role: 'Pensador Profundo',  description: 'Razona paso a paso antes de responder. Ideal para problemas filosóficos, matemáticos o de diseño.', tools: ['calculate', 'getDateTime'] }
];

// ============================================================
// MEMORIA
// ============================================================
function leerMemoria(limite = 15) {
    try { return db.prepare('SELECT clave, valor FROM memoria ORDER BY actualizado_en DESC LIMIT ?').all(limite); }
    catch { return []; }
}
function guardarMemoria(clave, valor) {
    try {
        db.prepare(`
            INSERT INTO memoria (clave, valor, actualizado_en)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = CURRENT_TIMESTAMP
        `).run(String(clave), String(valor));
    } catch (e) { console.warn('[multiagent] memoria:', e.message); }
}

// ============================================================
// PARSEO ROBUSTO DEL PLAN
// ============================================================
function extraerPlan(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    let m = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (m) {
        try {
            const parsed = JSON.parse(m[1].trim());
            if (parsed && Array.isArray(parsed.subtareas)) return parsed;
        } catch {}
    }

    const inicio = rawText.indexOf('{');
    if (inicio !== -1) {
        let depth = 0, fin = -1;
        for (let i = inicio; i < rawText.length; i++) {
            if (rawText[i] === '{') depth++;
            else if (rawText[i] === '}') { depth--; if (depth === 0) { fin = i; break; } }
        }
        if (fin !== -1) {
            try {
                const parsed = JSON.parse(rawText.substring(inicio, fin + 1));
                if (parsed && Array.isArray(parsed.subtareas)) return parsed;
            } catch {}
        }
    }

    const lineas = rawText.split('\n');
    const subtareas = [];
    for (const l of lineas) {
        const match = l.match(/^\s*\d+[.)]\s*([a-z]+)\s*[:=-]\s*(.+)$/i);
        if (match) {
            const agente = match[1].toLowerCase();
            const subtarea = match[2].trim();
            if (AGENTES.some(a => a.name === agente) && subtarea) {
                subtareas.push({ agente, subtarea });
            }
        }
    }
    if (subtareas.length > 0) return { subtareas };
    return null;
}

// ============================================================
// LIMPIAR JSON SUELTO
// ============================================================
function limpiarJSONsuelto(texto) {
    if (!texto || typeof texto !== 'string') return texto;
    let limpio = texto;
    limpio = limpio.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, '');
    limpio = limpio.replace(/\{\s*"type"\s*:\s*"function"[\s\S]*?\}\s*\}/gi, '');
    limpio = limpio.replace(/\{\s*"name"\s*:\s*"[^"]*__[^"]*"[\s\S]*?\}\s*\}/gi, '');
    limpio = limpio.replace(/\s{2,}/g, ' ').trim();
    return limpio;
}

// ============================================================
// PROCESAR HERRAMIENTAS DE TEXTO
// ============================================================
async function procesarHerramientasTexto(texto, permitidas = []) {
    if (!texto) return texto;
    const regex = /\[TOOL:\s*([\w.]+)\s*(\{[^}]*\})?\]/g;
    const matches = [...texto.matchAll(regex)];
    if (matches.length === 0) return texto;

    const mcpOn = estaActivoMCP();
    const mcpTools = mcpOn ? listarToolsMCP() : [];
    const mcpNames = new Set(mcpTools.map(t => t.name));
    const mcpQualified = new Set(mcpTools.map(t => t.qualifiedName));

    let resultado = texto;
    for (const m of matches) {
        const toolName = m[1];
        let params = {};
        if (m[2]) { try { params = JSON.parse(m[2]); } catch {} }

        if (permitidas.includes(toolName)) {
            const r = await executeTool(toolName, params);
            resultado = resultado.replace(m[0], `[Resultado ${toolName}: ${JSON.stringify(r).slice(0, 400)}]`);
            continue;
        }
        if (mcpOn && (mcpNames.has(toolName) || mcpQualified.has(toolName))) {
            const r = await ejecutarToolMCP(toolName, params);
            const txt = r.error ? `Error: ${r.error}` : (r.resultado || '');
            resultado = resultado.replace(m[0], `[Resultado MCP ${toolName}: ${txt.slice(0, 400)}]`);
            continue;
        }
        resultado = resultado.replace(m[0], `[herramienta ${toolName} no disponible]`);
    }
    return resultado;
}

// ============================================================
// VERIFICACIÓN HEURÍSTICA
// ============================================================
function verificarHeuristico(respuesta) {
    if (!respuesta || typeof respuesta !== 'string') {
        return { ok: false, motivo: 'Respuesta vacía o inválida' };
    }
    const limpio = respuesta.trim();
    if (limpio.length < 20) {
        return { ok: false, motivo: 'La respuesta es demasiado corta' };
    }
    const frasesMalas = [
        'no puedo ayudar', 'no puedo responder', 'no tengo información',
        'no sé cómo', 'no estoy seguro', 'lo siento, no', 'error al',
        'no pude procesar', 'no encontré información', '[herramienta', 'undefined'
    ];
    const lower = limpio.toLowerCase();
    for (const frase of frasesMalas) {
        if (lower.includes(frase)) {
            return { ok: false, motivo: `Contiene frase de fallo: "${frase}"` };
        }
    }
    if (/^\s*\{\s*"type"\s*:\s*"function"/.test(limpio)) {
        return { ok: false, motivo: 'La respuesta es un schema de tool, no una respuesta real' };
    }
    return { ok: true };
}

// ============================================================
// EJECUTAR AGENTE CON REINTENTO
// ============================================================
async function ejecutarAgenteConReintento(agente, subtarea, modelo, fechaHora, maxIntentos = 2) {
    const mcpOn = estaActivoMCP();
    const mcpTools = mcpOn ? listarToolsMCP() : [];
    const tieneToolsMCP = mcpOn && mcpTools.length > 0;

    const herramientasInternas = agente.tools.length
        ? `\nHerramientas internas que podés pedir con [TOOL: nombre {"param":"valor"}]: ${agente.tools.join(', ')}.`
        : '';

    const sys = `Sos un ${agente.role}. ${agente.description}
Fecha y hora: ${fechaHora}.${herramientasInternas}
Respondé conciso y útil en español rioplatense.`;

    let respuesta = '';
    let verificacion = null;
    let intento = 0;

    while (intento < maxIntentos) {
        intento++;
        const mensajes = [
            { role: 'system', content: sys },
            { role: 'user',   content: subtarea }
        ];

        if (intento > 1 && verificacion) {
            mensajes.push({ role: 'assistant', content: respuesta });
            mensajes.push({
                role: 'user',
                content: `Tu respuesta anterior tuvo este problema: "${verificacion.motivo}".
Por favor, mejorala. Sé más completo, específico y útil. NO devuelvas JSON de schemas.`
            });
        }

        if (tieneToolsMCP) {
            const toolsOllama = toolsParaOllama();
            console.log(`   🔧 Agente ${agente.name} → chatConTools (${toolsOllama.length} tools)`);
            let respuestaConTools = await chatConTools(
                mensajes,
                modelo,
                toolsOllama,
                0.7,
                512
            );
            let iteraciones = 0;
            const maxIteraciones = 4;

            while (respuestaConTools.tool_calls && respuestaConTools.tool_calls.length > 0 && iteraciones < maxIteraciones) {
                iteraciones++;
                console.log(`      🔧 Iteración ${iteraciones}: ${respuestaConTools.tool_calls.length} tool_call(s)`);
                mensajes.push(respuestaConTools);
                for (const tc of respuestaConTools.tool_calls) {
                    const nombreTool = tc.function.name;
                    let args = {};
                    try {
                        args = typeof tc.function.arguments === 'string'
                            ? JSON.parse(tc.function.arguments || '{}')
                            : (tc.function.arguments || {});
                    } catch (e) {
                        console.warn('      ⚠️ Args inválidos:', tc.function.arguments);
                    }
                    console.log(`         → ${nombreTool}(${JSON.stringify(args).slice(0, 100)})`);
                    const r = await ejecutarToolMCP(nombreTool, args);
                    mensajes.push({
                        role: 'tool',
                        content: r.error ? `Error: ${r.error}` : (r.resultado || '')
                    });
                }
                respuestaConTools = await chatConTools(
                    mensajes,
                    modelo,
                    toolsOllama,
                    0.7,
                    512
                );
            }
            respuesta = respuestaConTools.content || '';
            respuesta = limpiarJSONsuelto(respuesta);
        } else {
            respuesta = await chatWithOllama(mensajes, modelo);
            if (respuesta.includes('[TOOL:')) {
                const conHerramientas = await procesarHerramientasTexto(respuesta, agente.tools);
                if (conHerramientas !== respuesta) {
                    respuesta = await chatWithOllama(
                        [
                            { role: 'system', content: sys },
                            { role: 'user',   content: subtarea },
                            { role: 'assistant', content: respuesta },
                            { role: 'user',   content: `Resultados de herramientas:\n${conHerramientas}\n\nAhora respondé definitivamente, sin mencionar las herramientas.` }
                        ],
                        modelo
                    );
                }
            }
            respuesta = limpiarJSONsuelto(respuesta);
        }

        verificacion = verificarHeuristico(respuesta);
        if (verificacion.ok) {
            return { respuesta, intentos: intento };
        }
        console.log(`   ⚠️ Intento ${intento} rechazado: ${verificacion.motivo}`);
    }

    return { respuesta, intentos: intento, deficiente: true, motivo: verificacion?.motivo };
}

// ============================================================
// JUEZ FINAL
// ============================================================
async function juzgarRespuestaFinal(tarea, respuestaFinal, modelo) {
    try {
        const prompt = `Sos un JUEZ que evalúa si una RESPUESTA EN TEXTO LIBRE cumple con una TAREA.

IMPORTANTE:
- La respuesta a evaluar es texto humano normal, NO tiene que ser JSON.
- Vos SOLO devolvés un veredicto en formato JSON.
- No confundas el formato de tu respuesta con el formato de lo que evaluás.

TAREA ORIGINAL:
${tarea}

RESPUESTA A EVALUAR:
"""
${respuestaFinal}
"""

Criterios:
1. ¿Responde a lo que pide la tarea?
2. ¿Es completa (no le falta información clave)?
3. ¿Es coherente y no tiene errores graves?

Devolvé EXCLUSIVAMENTE este JSON (sin texto extra, sin markdown):
{"aprobado": true, "motivo": "breve explicación"}
o
{"aprobado": false, "motivo": "qué le falta o qué está mal"}`;

        const raw = await chatWithOllama(
            [
                { role: 'system', content: prompt },
                { role: 'user',   content: 'Devolvé el JSON del veredicto.' }
            ],
            modelo
        );
        const match = raw.match(/\{[\s\S]*?"aprobado"[\s\S]*?\}/i);
        if (!match) {
            console.warn('[juez] No se pudo extraer JSON. Raw:', raw.slice(0, 200));
            return { aprobado: true, motivo: 'No se pudo parsear la evaluación (asumo aprobado)' };
        }
        try {
            const parsed = JSON.parse(match[0]);
            return {
                aprobado: parsed.aprobado !== false,
                motivo: parsed.motivo || ''
            };
        } catch (e) {
            console.warn('[juez] Error parseando JSON:', e.message);
            return { aprobado: true, motivo: 'Error parseando evaluación' };
        }
    } catch (e) {
        console.warn('[juez] Error evaluando:', e.message);
        return { aprobado: true, motivo: 'Error en la evaluación' };
    }
}

// ============================================================
// SÍNTESIS CON VERIFICACIÓN
// ============================================================
async function sintetizarConVerificacion(resultados, tarea, fechaHora, modelo) {
    const contexto = resultados.map(r => `[${r.agente}] ${r.subtarea}\n${r.respuesta}`).join('\n\n');
    let final = await chatWithOllama(
        [
            { role: 'system', content: `Sos un coordinador. Sintetizá una respuesta final clara para el usuario, combinando los aportes de los agentes. Fecha actual: ${fechaHora}. Respondé en español rioplatense, breve y útil.` },
            { role: 'user',   content: `Tarea original: ${tarea}\n\nAportes:\n${contexto}` }
        ],
        modelo
    );
    final = limpiarJSONsuelto(final);
    const evaluacion = await juzgarRespuestaFinal(tarea, final, modelo);
    console.log(`   🧑⚖️ Juez: ${evaluacion.aprobado ? 'APROBADO' : 'RECHAZADO: ' + evaluacion.motivo}`);

    if (!evaluacion.aprobado) {
        console.log('   🔄 Re-sintetizando con feedback del juez...');
        final = await chatWithOllama(
            [
                { role: 'system', content: `Sos un coordinador. Tu respuesta anterior fue rechazada por un juez con este motivo: "${evaluacion.motivo}". Mejorala y devolvé una respuesta final más completa y útil. Español rioplatense.` },
                { role: 'user',   content: `Tarea original: ${tarea}\n\nAportes:\n${contexto}\n\nRespuesta anterior:\n${final}\n\nMejorala.` }
            ],
            modelo
        );
        final = limpiarJSONsuelto(final);
    }
    return { final, evaluacion };
}

// ============================================================
// ENDPOINTS
// ============================================================
router.get('/agentes', (req, res) => {
    res.json(AGENTES.map(a => ({ name: a.name, role: a.role, description: a.description })));
});

router.get('/tools', (req, res) => {
    const internas = listTools();
    const mcpOn = estaActivoMCP();
    const mcp = mcpOn
        ? listarToolsMCP().map(t => ({
            name: t.qualifiedName,
            description: `[MCP:${t.servidor}] ${t.description}`
        }))
        : [];
    res.json([...internas, ...mcp]);
});

router.get('/status', (req, res) => {
    const mcpOn = estaActivoMCP();
    res.json({
        activo: multiagenteActivo,
        agentes: AGENTES.length,
        herramientas: Object.keys(TOOLS).length,
        herramientas_mcp: mcpOn ? listarToolsMCP().length : 0,
        mcp_activo: mcpOn,
        memoria_claves: leerMemoria(999).length
    });
});

router.post('/toggle', (req, res) => {
    multiagenteActivo = !multiagenteActivo;
    res.json({ activo: multiagenteActivo });
});

router.post('/activar', (req, res) => {
    multiagenteActivo = true;
    res.json({ activo: true });
});

router.post('/desactivar', (req, res) => {
    multiagenteActivo = false;
    res.json({ activo: false });
});

router.get('/memoria', (req, res) => res.json(leerMemoria(50)));

router.post('/memoria', (req, res) => {
    const { clave, valor } = req.body || {};
    if (!clave || valor === undefined) return res.status(400).json({ detail: 'Faltan clave y valor' });
    guardarMemoria(clave, valor);
    res.json({ success: true, clave, valor });
});

router.get('/historial', (req, res) => {
    try {
        res.json(db.prepare('SELECT id, tarea, resultado, creado_en FROM coordinaciones ORDER BY id DESC LIMIT 20').all());
    } catch { res.json([]); }
});

// ============================================================
// COORDINAR
// ============================================================
router.post('/coordinar', async (req, res) => {
    const { task, model } = req.body || {};
    if (!task || typeof task !== 'string' || !task.trim()) {
        return res.status(400).json({ detail: 'Falta el campo "task"' });
    }
    const tarea = task.trim();
    const modelo = sanitizarModelo(model);
    const dialogo = [];
    const mcpOn = estaActivoMCP();

    try {
        const memoria = leerMemoria(15);
        const memoriaTexto = memoria.length
            ? `Memoria reciente:\n${memoria.map(m => `- ${m.clave}: ${m.valor}`).join('\n')}`
            : 'Sin memoria previa.';

        const ahora = new Date();
        const fechaHora = `${ahora.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;

        const mcpTexto = mcpOn
            ? `\n\nHERRAMIENTAS MCP DISPONIBLES:\n${listarToolsMCP().map(t => `- ${t.qualifiedName}: ${t.description}`).join('\n')}`
            : '';

        const agentesTexto = AGENTES.map(a => {
            const tools = a.tools.length ? ` [herramientas: ${a.tools.join(', ')}]` : '';
            return `- ${a.name} (${a.role}): ${a.description}${tools}`;
        }).join('\n');

        const promptCoord = `Sos un coordinador multiagente. Tenés que elegir entre 1 y 3 agentes para resolver una tarea.

Fecha y hora actual: ${fechaHora}

${memoriaTexto}

AGENTES DISPONIBLES:
${agentesTexto}${mcpTexto}

REGLAS:
1. Respondé SIEMPRE con un objeto JSON válido, nada más.
2. Formato exacto: {"subtareas":[{"agente":"NOMBRE","subtarea":"DESCRIPCIÓN"}]}
3. El campo "agente" debe ser uno de: coder, analyst, writer, critic, researcher, thinker
4. Si la tarea es simple, devolvé UNA sola subtarea.
5. NO agregues texto antes ni después del JSON. NO uses bloques de código.
6. El agente "researcher" tiene acceso a herramientas MCP. Si la tarea requiere buscar info externa, asignala a "researcher".

Ejemplo:
{"subtareas":[{"agente":"researcher","subtarea":"Buscar información de Elon Musk en Wikipedia"}]}`;

        const rawPlan = await chatWithOllama(
            [
                { role: 'system', content: promptCoord },
                { role: 'user',   content: `Tarea: ${tarea}` }
            ],
            modelo
        );

        let plan = extraerPlan(rawPlan);
        if (!plan) {
            console.warn('[multiagent] Plan inválido. Raw:', rawPlan.slice(0, 300));
            plan = { subtareas: [{ agente: 'researcher', subtarea: tarea }] };
            dialogo.push(`⚠️ El coordinador no devolvió un plan claro. Uso *researcher* por defecto.`);
        }

        plan.subtareas = plan.subtareas
            .filter(st => st && st.subtarea)
            .map(st => {
                const agenteEncontrado = AGENTES.find(a => a.name === (st.agente || '').toLowerCase());
                return {
                    agente: agenteEncontrado ? agenteEncontrado.name : 'researcher',
                    subtarea: String(st.subtarea).trim()
                };
            })
            .slice(0, 5);

        if (plan.subtareas.length === 0) {
            throw new Error('El plan no contiene subtareas válidas');
        }

        dialogo.push(`📋 Plan: ${plan.subtareas.length} subtarea${plan.subtareas.length !== 1 ? 's' : ''}`);

        const resultados = [];
        for (const st of plan.subtareas) {
            const agente = AGENTES.find(a => a.name === st.agente) || AGENTES[0];
            dialogo.push(`🔹 ${agente.role} procesando: ${st.subtarea}`);

            const { respuesta, intentos, deficiente } = await ejecutarAgenteConReintento(
                agente, st.subtarea, modelo, fechaHora, 2
            );

            if (intentos > 1) {
                dialogo.push(`   ↻ Reintentado (${intentos} intentos)`);
            }
            if (deficiente) {
                dialogo.push(`   ⚠️ Respuesta entregada con reservas`);
            }
            resultados.push({ agente: agente.name, subtarea: st.subtarea, respuesta, intentos });
        }

        let final;
        let evaluacion = { aprobado: true, motivo: '' };

        if (resultados.length === 1) {
            final = resultados[0].respuesta;
        } else {
            const r = await sintetizarConVerificacion(resultados, tarea, fechaHora, modelo);
            final = r.final;
            evaluacion = r.evaluacion;
            if (!evaluacion.aprobado) {
                dialogo.push(`🧑‍⚖️ Respuesta revisada y mejorada por el juez`);
            }
        }

        guardarMemoria(`coord_${Date.now()}`, `${tarea.slice(0, 80)} → ${final.slice(0, 120)}`);
        try {
            db.prepare('INSERT INTO coordinaciones (tarea, plan, resultado) VALUES (?, ?, ?)')
                .run(tarea, JSON.stringify(plan), final);
        } catch {}

        res.json({ dialogo, final, subtareas: resultados, modelo });
    } catch (err) {
        console.error('[multiagent]', err);
        res.status(500).json({ detail: err.message || 'Error coordinando agentes' });
    }
});

export default router;