// backend/src/routes/chat.js
import express from 'express';
import { chatWithOllama, chatConTools } from '../services/ollama.js';
import { executeTool } from '../services/tools.js';
import { toolsParaOllama, ejecutarToolMCP, listarToolsMCP, estaActivoMCP } from '../services/mcpClient.js';

console.log('📦 chat.js v5 cargado (MCP con toggle activo)');

const router = express.Router();

// ============================================================
// BLACKLIST DE MODELOS
// ============================================================
const MODELOS_NO_CHAT = ['nomic', 'embed', 'minilm', 'bge-', 'e5-', 'gte-', 'jina'];
const MODELO_SEGURO = 'llama3.2:3b';

const MODELOS_CON_TOOLS = ['llama3.1', 'qwen2.5', 'mistral:7b', 'llama3.2:3b'];

function esModeloDeChat(nombre) {
    if (!nombre || typeof nombre !== 'string') return false;
    const n = nombre.toLowerCase();
    return !MODELOS_NO_CHAT.some(p => n.includes(p));
}

function sanitizarModelo(modelo) {
    if (!esModeloDeChat(modelo)) {
        console.warn(`🚫 Modelo rechazado: "${modelo}" → sustituido por ${MODELO_SEGURO}`);
        return MODELO_SEGURO;
    }
    return modelo;
}

function soportaTools(modelo) {
    if (!modelo) return false;
    const n = modelo.toLowerCase();
    return MODELOS_CON_TOOLS.some(m => n.includes(m));
}

// ============================================================
// SHORTCUTS
// ============================================================
function detectarConsultaTemporal(msg) {
    const m = String(msg || '').toLowerCase().trim();
    if (/(fecha\s+y\s+hora|hora\s+y\s+fecha)/.test(m)) return 'ambos';
    if (/(qué|que)\s+(día|dia)\s+(de\s+la\s+semana|es\s+hoy)/.test(m)) return 'dia_semana';
    if (/(qué|que|cual|cuál)\s+(día|dia|fecha)\s+(es|estamos|hoy)/.test(m)) return 'fecha';
    if (/^¿?\s*(qué|que)\s+hora/.test(m)) return 'hora';
    if (/(dónde|donde)\s+(estoy|estamos|me encuentro)/.test(m)) return 'ubicacion';
    if (/(en\s+qué\s+ciudad|mi\s+ubicación|mi\s+ubicacion)/.test(m)) return 'ubicacion';
    return null;
}

function detectarConsultaClima(msg) {
    const m = String(msg || '').toLowerCase();
    return /(clima|tiempo\s+(que\s+hace|actual|hoy)|temperatura\s+(actual|de\s+hoy|ahora)|va\s+a\s+llover|está\s+lloviendo|esta\s+lloviendo|pronóstico|pronostico|hace\s+frío|hace\s+calor)/.test(m);
}

// Detecta si el mensaje consulta por productos de la despensa.
// ENDURECIDO: solo si el mensaje es corto (< 100 caracteres) Y tiene
// verbo de búsqueda + artículo conocido, o menciona "despensa"/"inventario".
// Ya NO se dispara con la sola palabra "producto" (evita el loop).
function detectarConsultaDespensa(msg) {
    const m = String(msg || '').toLowerCase().trim();

    // Si el mensaje es muy largo, probablemente sea una respuesta del LLM
    if (m.length > 100) return false;

    // Menciones explícitas → seguro
    if (m.includes('despensa') || m.includes('inventario')) return true;

    // Verbos de búsqueda + artículo conocido
    const verbosBusqueda = /(busca|buscá|buscar|buscame|ten[eé]s|tenes|hay|mostrame|mostrá|encontra|encontrá|fijate|fijá|quedó|queda)/i;
    const articulos = ['harina', 'arroz', 'leche', 'azúcar', 'azucar', 'yerba', 'aceite', 'fideos', 'polenta', 'sal', 'café', 'cafe', 'galletitas', 'pan'];

    return verbosBusqueda.test(m) && articulos.some(a => m.includes(a));
}

function extraerProductoDeConsulta(msg) {
    const m = String(msg || '').trim();

    // 1) Intenta extraer después de "buscar/busca/buscá/buscame X"
    const match = m.match(/(?:buscar|busca|buscá|buscame|ten[eé]s|hay|mostrame|encontra|encontrá)\s+(?:producto\s+)?(?:si\s+)?(?:hay\s+)?(?:de\s+)?([^\?\.]+)/i);
    if (match && match[1]) {
        let p = match[1].replace(/\s+en\s+(?:mi|la|el)?\s*(?:despensa|inventario).*$/i, '').trim();
        p = p.replace(/^producto\s+/i, '').trim();
        if (p) return p;
    }

    // 2) Fallback: buscar artículos conocidos
    const articulos = ['harina', 'arroz', 'leche', 'azúcar', 'azucar', 'yerba', 'aceite', 'fideos', 'polenta', 'sal', 'café', 'cafe', 'galletitas', 'pan'];
    for (const a of articulos) {
        if (m.toLowerCase().includes(a)) return a;
    }

    // 3) Último fallback
    return m;
}

function responderTemporal(tipo, ubicacion) {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-AR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    switch (tipo) {
        case 'fecha':
        case 'dia_semana':
            return `📅 Hoy es **${fecha}**.`;
        case 'hora':
            return `🕐 Son las **${hora}** (${tz}).`;
        case 'ambos':
            return `📅 Hoy es **${fecha}**.\n🕐 Son las **${hora}** (${tz}).`;
        case 'ubicacion': {
            const u = ubicacion || {};
            if (u.ciudad || u.pais) {
                const partes = [u.ciudad, u.region, u.pais].filter(Boolean).join(', ');
                return `📍 Estás aproximadamente en **${partes}**.`;
            }
            return `📍 No pude determinar tu ubicación.`;
        }
        default:
            return null;
    }
}

// ============================================================
// UBICACIÓN
// ============================================================
let _ubicacionCache = null;
let _ubicacionCacheTs = 0;
let _ubicacionFalloTs = 0;
const UBICACION_TTL   = 30 * 60 * 1000;
const UBICACION_FALLO =  5 * 60 * 1000;

async function obtenerUbicacion() {
    if (_ubicacionCache && (Date.now() - _ubicacionCacheTs) < UBICACION_TTL) return _ubicacionCache;
    if (_ubicacionFalloTs && (Date.now() - _ubicacionFalloTs) < UBICACION_FALLO) return _ubicacionCache;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const d = await resp.json();
        _ubicacionCache = {
            ciudad: d.city || '',
            region: d.region || '',
            pais:   d.country_name || '',
            timezone: d.timezone || ''
        };
        _ubicacionCacheTs = Date.now();
        _ubicacionFalloTs = 0;
        return _ubicacionCache;
    } catch (e) {
        console.warn('[ubicacion]', e.message);
        _ubicacionFalloTs = Date.now();
        return _ubicacionCache;
    }
}

// ============================================================
// SYSTEM PROMPT
// ============================================================
function construirSystemPrompt(fecha, hora, tz, toolsDisponibles) {
    const toolsInfo = toolsDisponibles.length > 0
        ? `\n\nHERRAMIENTAS QUE PODÉS USAR (invocalas con function calling cuando corresponda):
${toolsDisponibles.map(t => `- ${t.name}: ${t.description}`).join('\n')}

CUÁNDO USAR CADA HERRAMIENTA:
- Si el usuario menciona "despensa", "inventario", "producto", "stock" o pregunta por artículos (harina, arroz, leche, yerba, etc.) → usá la tool de búsqueda de productos.
- Si el usuario pregunta por el clima, temperatura, si va a llover → usá la tool de clima.
- Si el usuario pregunta por hora, fecha o ubicación → ya tenés esa info acá arriba. NO llames tools.`
        : '';

    return `INFORMACIÓN ACTUAL DEL SISTEMA:
- Fecha de hoy: ${fecha}
- Hora actual: ${hora}
- Zona horaria: ${tz}

Respondé en español rioplatense, breve y al punto. Máximo 4 o 5 líneas.${toolsInfo}`;
}

// ============================================================
// POST /api/chat/
// ============================================================
router.post('/', async (req, res) => {
    const { user_id, message, model, temperature, use_rag, max_tokens, history, skip_shortcuts } = req.body;

    const modeloSeguro = sanitizarModelo(model);
    const saltarShortcuts = skip_shortcuts === true;
    const mcpOn = estaActivoMCP();

    console.log(`💬 Chat: "${String(message).slice(0, 80)}" (pedido: ${model} | usado: ${modeloSeguro} | MCP: ${mcpOn ? 'ON' : 'OFF'} | skip_shortcuts: ${saltarShortcuts})`);

    // ============================================================
    // SHORTCUTS (solo si NO es respuesta automática del diálogo)
    // ============================================================
    if (!saltarShortcuts) {

        // ----- Shortcut 1: fecha / hora / ubicación -----
        const tipoTemporal = detectarConsultaTemporal(message);
        if (tipoTemporal) {
            const ubicacion = tipoTemporal === 'ubicacion' ? await obtenerUbicacion() : null;
            const respuesta = responderTemporal(tipoTemporal, ubicacion);
            if (respuesta) {
                console.log(`   ⚡ Shortcut temporal (${tipoTemporal})`);
                return res.json({ response: respuesta });
            }
        }

        // ----- Shortcut 2: clima (usa tool interna, funciona siempre) -----
        if (detectarConsultaClima(message)) {
            try {
                const r = await executeTool('getWeather', {});
                if (r && !r.error) {
                    const respuesta =
                        `🌤️ **Clima actual**\n` +
                        `- Temperatura: **${r.temperatura}${r.unidad || '°C'}**\n` +
                        `- Condición: ${r.condicion}\n` +
                        `- Humedad: ${r.humedad}%\n` +
                        `- Viento: ${r.viento} km/h`;
                    console.log('   ⚡ Shortcut clima');
                    return res.json({ response: respuesta });
                }
            } catch (e) {
                console.warn('[chat] Shortcut clima falló:', e.message);
            }
        }

        // ----- Shortcut 3: despensa (solo si MCP está activo) -----
        if (mcpOn && detectarConsultaDespensa(message)) {
            const producto = extraerProductoDeConsulta(message);
            console.log(`   ⚡ Shortcut despensa → buscar "${producto}"`);
            try {
                const r = await ejecutarToolMCP('buscar_producto', { nombre: producto });
                if (!r.error && r.resultado) {
                    console.log(`   ✅ Shortcut despensa OK`);
                    return res.json({ response: r.resultado });
                } else if (r.error) {
                    console.warn('   ⚠️ Shortcut despensa devolvió error:', r.error);
                }
            } catch (e) {
                console.warn('   ⚠️ Shortcut despensa excepción:', e.message);
            }
        }

    } else {
        console.log('   ⏭️ Shortcuts saltados (respuesta automática del diálogo)');
    }

    // ============================================================
    // CHAT NORMAL (con o sin tools MCP)
    // ============================================================
    const messages = [];

    const now = new Date();
    const fecha = now.toLocaleDateString('es-AR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const toolsDisponibles = mcpOn
        ? listarToolsMCP().map(t => ({ name: t.name, description: t.description }))
        : [];

    messages.push({
        role: 'system',
        content: construirSystemPrompt(fecha, hora, tz, toolsDisponibles)
    });

    if (history && Array.isArray(history) && history.length > 0) {
        for (const msg of history) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({ role: msg.role, content: msg.content });
            }
        }
    }
    messages.push({ role: 'user', content: message });

    try {
        const tools = mcpOn ? toolsParaOllama() : [];
        const usarTools = mcpOn && soportaTools(modeloSeguro) && tools.length > 0 && !saltarShortcuts;

        if (!usarTools) {
            console.log(`   (chat normal: MCP=${mcpOn} soportaTools=${soportaTools(modeloSeguro)} saltarShortcuts=${saltarShortcuts})`);
            const respuesta = await chatWithOllama(
                messages,
                modeloSeguro,
                temperature || 0.7,
                max_tokens || 512
            );
            return res.json({ response: respuesta });
        }

        console.log(`   🛠️ ${tools.length} tools MCP disponibles`);

        let respuesta = await chatConTools(
            messages,
            modeloSeguro,
            tools,
            temperature || 0.7,
            max_tokens || 512
        );

        if (respuesta.tool_calls && respuesta.tool_calls.length > 0) {
            console.log(`   ✅ LLM emitió ${respuesta.tool_calls.length} tool_call(s)`);
        } else {
            console.log(`   ℹ️ LLM respondió texto (sin tool_calls)`);
        }

        let iteraciones = 0;
        const maxIteraciones = 5;

        while (respuesta.tool_calls && respuesta.tool_calls.length > 0 && iteraciones < maxIteraciones) {
            iteraciones++;
            console.log(`   🔧 Iteración ${iteraciones}: ${respuesta.tool_calls.length} tool(s)`);

            messages.push(respuesta);

            for (const tc of respuesta.tool_calls) {
                const nombreTool = tc.function.name;
                let args = {};
                try {
                    args = typeof tc.function.arguments === 'string'
                        ? JSON.parse(tc.function.arguments || '{}')
                        : (tc.function.arguments || {});
                } catch (e) {
                    console.warn('   ⚠️ Args inválidos:', tc.function.arguments);
                }

                console.log(`      → ${nombreTool}(${JSON.stringify(args).slice(0, 80)})`);

                const r = await ejecutarToolMCP(nombreTool, args);
                messages.push({
                    role: 'tool',
                    content: r.error ? `Error: ${r.error}` : (r.resultado || '')
                });
            }

            respuesta = await chatConTools(
                messages,
                modeloSeguro,
                tools,
                temperature || 0.7,
                max_tokens || 512
            );

            if (respuesta.tool_calls && respuesta.tool_calls.length > 0) {
                console.log(`   ✅ LLM emitió ${respuesta.tool_calls.length} tool_call(s) más`);
            }
        }

        if (iteraciones >= maxIteraciones) {
            console.warn('   ⚠️ Límite de iteraciones alcanzado');
        }

        res.json({ response: respuesta.content || 'Sin respuesta' });
    } catch (error) {
        console.error('❌ Error chat:', error.message);
        if (error.message && error.message.includes('timeout')) {
            return res.status(500).json({
                error: 'Ollama tardó demasiado. Probá con un modelo más liviano (llama3.2:3b o phi3:mini) o esperá unos segundos.'
            });
        }
        res.status(500).json({ error: 'No se pudo obtener respuesta de la IA. ¿Está Ollama corriendo?' });
    }
});

export default router;