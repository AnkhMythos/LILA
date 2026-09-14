// frontend/js/models.js

// ============================================================
// INTERRUPTOR DE FILTRADO
// true = oculta embeddings (nomic, etc.) del selector
// false = los muestra con sufijo "— embeddings"
// ============================================================
const FILTRAR_EMBEDDINGS = false;

// ============================================================
// MODELOS NO-CHAT
// ============================================================
const MODELOS_NO_CHAT = [
    'nomic', 'embed', 'minilm', 'bge-', 'e5-', 'gte-', 'jina'
];

function esModeloDeChat(nombre) {
    if (!FILTRAR_EMBEDDINGS) return true;
    if (!nombre || typeof nombre !== 'string') return false;
    const n = nombre.toLowerCase();
    return !MODELOS_NO_CHAT.some(p => n.includes(p));
}

// ============================================================
// LIMPIEZA FORZADA AL CARGAR
// ============================================================
(function limpiarModeloGuardado() {
    const guardado = localStorage.getItem('lila_modelo');
    console.log(`[models] localStorage.lila_modelo =`, guardado);
    if (!guardado || typeof guardado !== 'string' || guardado.trim() === '') {
        localStorage.setItem('lila_modelo', 'llama3.2:3b');
        console.log(`[models] Sin modelo guardado, seteo llama3.2:3b`);
    }
})();

// ============================================================
// CARGAR MODELOS
// ============================================================
async function cargarModelos() {
    console.log(`[models] Iniciando carga desde ${API_BASE}/api/models/`);
    try {
        const response = await fetch(`${API_BASE}/api/models/`);
        console.log(`[models] Respuesta HTTP: ${response.status} ${response.statusText}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log(`[models] Datos recibidos del backend:`, data);

        if (Array.isArray(data) && data.length > 0) {
            const soloChat = data.filter(m => esModeloDeChat(m.name || m.model || m.id));
            listaModelos = soloChat.length > 0 ? soloChat : data;
            console.log(`[models] Modelos tras filtrar: ${listaModelos.length}`);
        } else {
            console.warn(`[models] Backend devolvió lista vacía o no-array. Usando fallback.`);
            listaModelos = [
                { name: 'llama3.2:3b', size: '2.0 GB' },
                { name: 'phi3:mini', size: '2.2 GB' },
                { name: 'gemma3:latest', size: '3.3 GB' },
                { name: 'deepseek-coder:6.7b', size: '3.8 GB' },
                { name: 'mistral:7b', size: '4.4 GB' },
                { name: 'mistral:7b-instruct-q4_K_M', size: '4.4 GB' },
                { name: 'deepseek-r1:7b', size: '4.7 GB' },
                { name: 'qwen2.5:7b', size: '4.7 GB' },
                { name: 'llama3:latest', size: '4.7 GB' },
                { name: 'llama3.1:8b', size: '4.9 GB' },
                { name: 'nomic-embed-text:latest', size: '274 MB' }
            ];
        }
        actualizarSelectModelos();
    } catch (error) {
        console.error('[models] Error cargando modelos:', error);
        listaModelos = [
            { name: 'llama3.2:3b', size: '2.0 GB' },
            { name: 'llama3.1:8b', size: '4.9 GB' },
            { name: 'qwen2.5:7b', size: '4.7 GB' }
        ];
        actualizarSelectModelos();
    }
}

function actualizarSelectModelos() {
    const select = document.getElementById('modelSelect');
    if (!select) {
        console.warn('[models] No se encontró #modelSelect en el DOM');
        return;
    }

    console.log(`[models] actualizarSelectModelos: ${listaModelos.length} modelos`);

    const guardado = localStorage.getItem('lila_modelo');
    if (guardado && esModeloDeChat(guardado)) {
        modeloActual = guardado;
    } else {
        modeloActual = 'llama3.2:3b';
        localStorage.setItem('lila_modelo', modeloActual);
    }

    select.innerHTML = '';
    listaModelos.forEach(model => {
        const option = document.createElement('option');
        const modelName = model.name || model.model || model.id || 'unknown';
        option.value = modelName;

        const esEmbedding = MODELOS_NO_CHAT.some(p => modelName.toLowerCase().includes(p));
        const sufijo = esEmbedding ? ' — embeddings' : '';
        option.textContent = modelName + (model.size ? ` (${model.size})` : '') + sufijo;

        select.appendChild(option);
    });

    if (modeloActual && listaModelos.some(m => (m.name || m.model || m.id) === modeloActual)) {
        select.value = modeloActual;
    } else if (listaModelos.length > 0) {
        modeloActual = listaModelos[0].name || listaModelos[0].model || listaModelos[0].id;
        select.value = modeloActual;
    }

    if (!select.dataset.listenerAttached) {
        select.addEventListener('change', (e) => {
            const nuevo = e.target.value;
            if (nuevo && nuevo !== modeloActual) {
                cambiarModelo(nuevo);
            }
        });
        select.dataset.listenerAttached = '1';
    }

    if (typeof window.actualizarBadgeModelo === 'function') {
        window.actualizarBadgeModelo(select.value);
    }
    localStorage.setItem('lila_modelo', modeloActual);
    console.log(`[models] ✅ Modelo actual: ${modeloActual} (${listaModelos.length} opciones en el select)`);
}

function actualizarBadgeModelo(modelName) {
    // El badge del footer ya no existe (fue reemplazado por botones).
    // Esta función se mantiene como no-op por si algún otro script la llama.
    console.log(`[models] actualizarBadgeModelo(${modelName}) — no-op`);
}

function cambiarModelo(nuevoModelo) {
    if (!nuevoModelo) return;
    if (!esModeloDeChat(nuevoModelo)) {
        console.warn(`[models] "${nuevoModelo}" no es un modelo de chat, ignorado`);
        const select = document.getElementById('modelSelect');
        if (select) select.value = modeloActual;
        return;
    }
    modeloActual = nuevoModelo;
    window.modeloActual = nuevoModelo;
    localStorage.setItem('lila_modelo', nuevoModelo);
    console.log(`[models] ✅ Modelo cambiado a: ${nuevoModelo}`);
}

window.cargarModelos = cargarModelos;
window.cambiarModelo = cambiarModelo;
window.esModeloDeChat = esModeloDeChat;