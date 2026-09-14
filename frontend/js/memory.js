// frontend/js/memory.js
async function cargarMemoria() {
    try {
        const resp = await fetch(`${API_BASE}/api/memory/${USER_ID}`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        memoriaUsuario = data || {};
        console.log('🧠 Memoria cargada:', Object.keys(memoriaUsuario).length);
    } catch (e) {
        console.warn('No se pudo cargar memoria:', e.message);
        memoriaUsuario = {};
    }
}

async function guardarMemoriaBackend(clave, valor) {
    try {
        await fetch(`${API_BASE}/api/memory/${USER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: clave, value: valor })
        });
        memoriaUsuario[clave] = valor;
    } catch (e) {
        console.error('Error guardando memoria:', e);
    }
}

function obtenerHechosComoTexto() {
    const entries = Object.entries(memoriaUsuario);
    return entries.length ? entries.map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'No hay hechos guardados.';
}

window.cargarMemoria = cargarMemoria;
window.guardarMemoriaBackend = guardarMemoriaBackend;
window.obtenerHechosComoTexto = obtenerHechosComoTexto;