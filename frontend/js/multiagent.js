// frontend/js/multiagent.js

// ============================================================
// TIMEOUTS
// El pipeline completo (planificar + agentes + reintentos + juez) puede tardar
// hasta 4 minutos con llama3.2:3b en CPU. Damos 5 min de margen.
// ============================================================
const MULTIAGENT_TIMEOUT_COORDINAR = 300000;   // 5 min
const MULTIAGENT_TIMEOUT_LISTAR    = 10000;    // 10 s
const MULTIAGENT_TIMEOUT_TOGGLE    = 5000;     // 5 s

// ============================================================
// HELPERS INTERNOS
// ============================================================
function _multiMostrarTyping(m) {
    const el = document.getElementById('typingIndicator');
    if (!el) return;
    try {
        el.style.setProperty('display', m ? 'flex' : 'none', 'important');
    } catch (e) {
        el.style.display = m ? 'flex' : 'none';
    }
    el.classList.toggle('visible', m);
}

function _multiHablarSiActivo(texto) {
    if (typeof window.vozActivada !== 'undefined' && window.vozActivada &&
        typeof window.hablar === 'function') {
        try { window.hablar(texto); } catch (e) {}
    }
}

// Aviso progresivo: si la operación tarda más de 30s, avisa al usuario
let _multiTimeoutAviso = null;

function _multiProgramarAviso() {
    _multiCancelarAviso();
    _multiTimeoutAviso = setTimeout(() => {
        if (typeof window.agregarMensaje === 'function') {
            window.agregarMensaje(
                'assistant',
                '⏳ El multiagente está trabajando. Puede tardar 2-4 minutos con `llama3.2:3b`. Aguardá por favor...'
            );
        }
    }, 30000);
}

function _multiCancelarAviso() {
    if (_multiTimeoutAviso) {
        clearTimeout(_multiTimeoutAviso);
        _multiTimeoutAviso = null;
    }
}

// ============================================================
// TOGGLE MULTIAGENTE (botón del footer)
// ============================================================
async function toggleMultiagente() {
    try {
        const data = await _fetchJSON(
            `${_apiBase()}/api/multiagent/toggle`,
            { method: 'POST' },
            MULTIAGENT_TIMEOUT_TOGGLE
        );
        const activo = !!data.activo;
        window.multiagenteActivo = activo;

        const btn = document.getElementById('footerMultiagente');
        if (btn) {
            btn.classList.toggle('online', activo);
            btn.classList.toggle('offline', !activo);
        }

        if (typeof agregarMensaje === 'function') {
            agregarMensaje(
                'assistant',
                activo
                    ? '🧠 Modo **Multiagente** activado. Las tareas complejas se resolverán con varios agentes.'
                    : '🧠 Modo **Multiagente** desactivado.'
            );
        }
    } catch (e) {
        console.error('[multiagente] toggle:', e);
        if (typeof agregarMensaje === 'function') {
            agregarMensaje('assistant', `❌ No se pudo cambiar el modo: ${e.message}`);
        }
    }
}

// ============================================================
// COORDINAR
// ============================================================
async function coordinarAgentes(tarea) {
    if (!tarea || !String(tarea).trim()) {
        if (typeof agregarMensaje === 'function') {
            agregarMensaje('assistant', '⚠️ Necesito una tarea para coordinar agentes.');
        }
        return;
    }

    _multiMostrarTyping(true);
    _multiProgramarAviso();

    try {
        const data = await _fetchJSON(
            `${_apiBase()}/api/multiagent/coordinar`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: String(tarea).trim(),
                    model: window.modeloActual || 'llama3.2:3b'
                })
            },
            MULTIAGENT_TIMEOUT_COORDINAR
        );

        if (Array.isArray(data.dialogo)) {
            for (const paso of data.dialogo) {
                if (typeof agregarMensaje === 'function') {
                    agregarMensaje('assistant', `🔹 ${paso}`);
                }
            }
        }

        const final = data.final || 'Sin respuesta final';
        if (typeof agregarMensaje === 'function') {
            agregarMensaje('assistant', `🧠 **Respuesta final:**\n${final}`);
        }
        _multiHablarSiActivo(String(final));

    } catch (e) {
        console.error('[multiagente] coordinar:', e);

        const esTimeout = String(e.message || '').toLowerCase().includes('timeout');
        if (typeof agregarMensaje === 'function') {
            if (esTimeout) {
                agregarMensaje(
                    'assistant',
                    `⏱️ El multiagente tardó más de ${MULTIAGENT_TIMEOUT_COORDINAR / 60000} minutos y se canceló.\n\n` +
                    `**Posibles causas:**\n` +
                    `- El modelo es muy lento (el pipeline completo puede tardar 3-4 min)\n` +
                    `- Ollama está procesando otra petición en simultáneo\n` +
                    `- El backend está saturado\n\n` +
                    `**Sugerencias:**\n` +
                    `- Probá con \`/modelo phi3:mini\` (más rápido que llama3.2:3b)\n` +
                    `- Acortá o simplificá la tarea\n` +
                    `- Volvé a intentar en unos segundos`
                );
            } else {
                agregarMensaje('assistant', `❌ Error coordinando agentes: ${e.message}`);
            }
        }

    } finally {
        _multiMostrarTyping(false);
        _multiCancelarAviso();
    }
}

// ============================================================
// LISTAR AGENTES
// ============================================================
async function listarAgentes() {
    _multiMostrarTyping(true);
    try {
        const data = await _fetchJSON(
            `${_apiBase()}/api/multiagent/agentes`,
            { method: 'GET' },
            MULTIAGENT_TIMEOUT_LISTAR
        );

        if (!Array.isArray(data) || data.length === 0) {
            if (typeof agregarMensaje === 'function') {
                agregarMensaje('assistant', '🤖 No hay agentes registrados.');
            }
            return;
        }

        const lista = data
            .map(a => `- **${a.name}** (${a.role}): ${a.description}`)
            .join('\n');

        if (typeof agregarMensaje === 'function') {
            agregarMensaje('assistant', `🤖 **Agentes disponibles (${data.length}):**\n${lista}`);
        }

    } catch (e) {
        console.error('[multiagente] listar:', e);
        if (typeof agregarMensaje === 'function') {
            agregarMensaje('assistant', `❌ Error listando agentes: ${e.message}`);
        }
    } finally {
        _multiMostrarTyping(false);
    }
}

// ============================================================
// EXPOSICIÓN GLOBAL
// ============================================================
window.toggleMultiagente = toggleMultiagente;
window.coordinarAgentes  = coordinarAgentes;
window.listarAgentes     = listarAgentes;
window.multiagenteActivo = false;

// ============================================================
// INICIALIZACIÓN: leer estado del backend al cargar
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const data = await _fetchJSON(
            `${_apiBase()}/api/multiagent/status`,
            { method: 'GET' },
            MULTIAGENT_TIMEOUT_TOGGLE
        );
        window.multiagenteActivo = !!data.activo;

        const btn = document.getElementById('footerMultiagente');
        if (btn) {
            btn.classList.toggle('online', window.multiagenteActivo);
            btn.classList.toggle('offline', !window.multiagenteActivo);
        }

        console.log('🧠 Multiagente estado inicial:', window.multiagenteActivo ? 'ON' : 'OFF');
    } catch (e) {
        console.warn('[multiagente] No se pudo leer estado inicial:', e.message);
    }
});