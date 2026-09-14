// frontend/js/openworker.js

// ============================================================
// MÓDULO OPENWORKER
// Depende de: config.js (API_BASE), chat.js (agregarMensaje),
// speech.js (hablar, vozActivada), dom.js (typingIndicator).
// ============================================================

const OPENWORKER_TIMEOUT_RUN      = 60000; // 60 s (planificar + ejecutar pasos)
const OPENWORKER_TIMEOUT_HISTORIAL = 10000; // 10 s
const OPENWORKER_TIMEOUT_LIMPIAR   = 10000; // 10 s

// ------------------------------------------------------------
// Utilidades internas
// ------------------------------------------------------------
// function _owApiBase() {
//     return (typeof window.API_BASE !== 'undefined' && window.API_BASE) ? window.API_BASE : '';
// }

function _owApiBase() {
    if (typeof window.API_BASE !== 'undefined' && window.API_BASE) return window.API_BASE;
    if (typeof API_BASE !== 'undefined' && API_BASE) return API_BASE;
    console.warn('[openworker] API_BASE no detectada, usando fallback hardcodeado');
    return 'http://127.0.0.1:8000';
}

function _owMostrarTyping(mostrar) {
    const el = document.getElementById('typingIndicator');
    if (el) el.style.display = mostrar ? 'flex' : 'none';
}

function _owHablarSiActivo(texto) {
    if (typeof window.vozActivada !== 'undefined' && window.vozActivada &&
        typeof window.hablar === 'function') {
        try { window.hablar(texto); } catch (e) { console.warn('TTS:', e); }
    }
}

async function _owFetchJSON(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(url, { ...options, signal: controller.signal });
        let data = null;
        try { data = await resp.json(); } catch { /* no JSON */ }
        if (!resp.ok) {
            const detail = data && (data.detail || data.mensaje || data.error || data.message);
            throw new Error(detail || `HTTP ${resp.status}`);
        }
        if (data === null) throw new Error('El servidor no devolvió JSON válido');
        return data;
    } catch (e) {
        if (e.name === 'AbortError') throw new Error(`Timeout tras ${timeoutMs / 1000}s`);
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

// ============================================================
// EJECUTAR TAREA
// ============================================================
async function ejecutarOpenWorker(tarea) {
    if (!tarea || !String(tarea).trim()) {
        agregarMensaje('assistant', '⚠️ Necesito una tarea para OpenWorker.');
        return;
    }

    const tareaLimpia = String(tarea).trim();
    agregarMensaje('assistant', `🤖 OpenWorker analizando: ${tareaLimpia}`);
    _owMostrarTyping(true);

    try {
        const data = await _owFetchJSON(
            `${_owApiBase()}/api/openworker/run`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: tareaLimpia })
            },
            OPENWORKER_TIMEOUT_RUN
        );

        if (!data || typeof data !== 'object') {
            throw new Error('Respuesta vacía o malformada del servidor');
        }

        // --- Plan ---
        if (Array.isArray(data.plan) && data.plan.length > 0) {
            const lineas = data.plan
                .map((p, i) => `${i + 1}. ${typeof p === 'string' ? p : (p?.descripcion || p?.step || JSON.stringify(p))}`)
                .join('\n');
            agregarMensaje('assistant', `📋 **Plan:**\n${lineas}`);
        }

        // --- Pasos ---
        if (Array.isArray(data.steps)) {
            for (const paso of data.steps) {
                if (!paso) continue;
                const step   = paso.step ?? paso.paso ?? paso.titulo ?? '';
                const result = paso.result ?? paso.resultado ?? paso.output ?? '';
                let bloque = '🔹';
                if (step)   bloque += ` ${step}`;
                if (result) bloque += `\n${result}`;
                agregarMensaje('assistant', bloque);
            }
        }

        // --- Resultado final ---
        const final = data.final ?? data.resultado ?? data.respuesta ?? data.result;
        if (final) {
            agregarMensaje('assistant', `✅ **Resultado final:**\n${final}`);
            _owHablarSiActivo(String(final));
        } else {
            agregarMensaje('assistant', '✅ OpenWorker terminó sin resultado final.');
        }
    } catch (e) {
        console.error('[openworker] ejecutar:', e);
        agregarMensaje('assistant', `❌ Error OpenWorker: ${e.message}`);
    } finally {
        _owMostrarTyping(false);
    }
}

// ============================================================
// HISTORIAL
// ============================================================
async function openworkerHistorial() {
    _owMostrarTyping(true);
    try {
        const data = await _owFetchJSON(
            `${_owApiBase()}/api/openworker/historial`,
            { method: 'GET' },
            OPENWORKER_TIMEOUT_HISTORIAL
        );

        const lista = Array.isArray(data) ? data
            : (data && Array.isArray(data.historial) ? data.historial : null);

        if (!lista) throw new Error('Formato inesperado (no es lista de historial)');
        if (lista.length === 0) {
            agregarMensaje('assistant', '📭 No hay historial de OpenWorker.');
            return;
        }

        const items = lista
            .map((m, i) => {
                const tarea = m?.task ?? m?.tarea ?? '(sin título)';
                const fecha = m?.created_at ?? m?.fecha ?? '';
                return `${i + 1}. ${tarea}${fecha ? ' — ' + fecha : ''}`;
            })
            .join('\n');

        agregarMensaje('assistant', `🗂️ **Historial OpenWorker (${lista.length}):**\n${items}`);
    } catch (e) {
        console.error('[openworker] historial:', e);
        agregarMensaje('assistant', `❌ Error historial: ${e.message}`);
    } finally {
        _owMostrarTyping(false);
    }
}

// ============================================================
// LIMPIAR
// ============================================================
async function openworkerLimpiar() {
    _owMostrarTyping(true);
    try {
        const data = await _owFetchJSON(
            `${_owApiBase()}/api/openworker/historial`,
            { method: 'DELETE' },
            OPENWORKER_TIMEOUT_LIMPIAR
        );

        const borrados = data?.deleted ?? data?.borrados ?? 0;
        agregarMensaje('assistant', `🗑️ Historial OpenWorker limpiado (${borrados} registros).`);
    } catch (e) {
        console.error('[openworker] limpiar:', e);
        agregarMensaje('assistant', `❌ Error limpiando historial: ${e.message}`);
    } finally {
        _owMostrarTyping(false);
    }
}

// ============================================================
// EXPOSICIÓN GLOBAL (CRÍTICO — sin esto /openworker no funciona)
// ============================================================
window.ejecutarOpenWorker   = ejecutarOpenWorker;
window.openworkerHistorial  = openworkerHistorial;
window.openworkerLimpiar    = openworkerLimpiar;