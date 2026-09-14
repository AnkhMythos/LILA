// frontend/js/mcp.js

const MCP_TIMEOUT_TOGGLE = 5000;

function _mcpApiBase() {
    if (typeof window.API_BASE !== 'undefined' && window.API_BASE) return window.API_BASE;
    if (typeof API_BASE !== 'undefined' && API_BASE) return API_BASE;
    return 'http://127.0.0.1:8000';
}

async function toggleMCP() {
    const btn = document.getElementById('footerMcp');
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT_TOGGLE);
        const resp = await fetch(`${_mcpApiBase()}/api/mcp/toggle`, {
            method: 'POST',
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const activo = !!data.activo;
        window.mcpActivo = activo;
        if (btn) {
            btn.classList.toggle('online', activo);
            btn.classList.toggle('offline', !activo);
        }
        if (typeof agregarMensaje === 'function') {
            agregarMensaje(
                'assistant',
                activo
                    ? '🔌 **MCP activado.** Las herramientas externas están disponibles.'
                    : '🔌 **MCP desactivado.** El chat funciona sin herramientas externas.'
            );
        }
    } catch (e) {
        console.error('[mcp] toggle:', e);
        if (typeof agregarMensaje === 'function') {
            agregarMensaje('assistant', `❌ No se pudo cambiar el estado de MCP: ${e.message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT_TOGGLE);
        const resp = await fetch(`${_mcpApiBase()}/api/mcp/status`, {
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!resp.ok) return;
        const data = await resp.json();
        window.mcpActivo = !!data.activo;
        const btn = document.getElementById('footerMcp');
        if (btn) {
            btn.classList.toggle('online', window.mcpActivo);
            btn.classList.toggle('offline', !window.mcpActivo);
        }
        console.log('🔌 MCP estado inicial:', window.mcpActivo ? 'ON' : 'OFF');
    } catch (e) {
        console.warn('[mcp] No se pudo leer estado inicial:', e.message);
    }
});

window.toggleMCP = toggleMCP;
window.mcpActivo = false;