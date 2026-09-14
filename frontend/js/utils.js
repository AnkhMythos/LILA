// frontend/js/utils.js

// ============================================
// 1. UTILIDADES BÁSICAS
// ============================================
function getTimestamp() {
    return new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function insertCommand(cmd) {
    const input = document.getElementById('userInput');
    if (input) {
        input.value = cmd;
        input.focus();
    }
}

function toggleMenu() {
    const menu = document.getElementById('dropdownMenu');
    if (menu) menu.classList.toggle('show');
}

// ============================================
// 2. MENSAJES Y PENSANDO
// ============================================
function agregarMensaje(rol, contenido, extra = {}) {
    const container = document.getElementById('messageContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message ${rol === 'user' ? 'user' : 'assistant'}`;

    if (rol === 'assistant') {
        const badge = document.createElement('div');
        badge.className = 'badge';
        badge.textContent = '🧉 LILA';
        div.appendChild(badge);
    }

    if (extra.archivo) {
        const badge = document.createElement('div');
        badge.className = 'file-badge';
        badge.textContent = `📎 ${extra.archivo}`;
        div.appendChild(badge);
    }

    if (extra.img) {
        const img = document.createElement('img');
        img.src = extra.img;
        img.alt = 'Imagen';
        div.appendChild(img);
    }

    // ============ CONTENIDO ============
    const esRespuestaIA = rol === 'assistant' || rol === 'bot' || rol === 'ai' || rol === 'model';
    let contenidoProcesado = String(contenido ?? '');
    let tieneCodigo = false;

    if (esRespuestaIA && contenidoProcesado && typeof procesarBloquesDeCodigo === 'function') {
        try {
            const antes = contenidoProcesado;
            contenidoProcesado = procesarBloquesDeCodigo(contenidoProcesado);
            tieneCodigo = contenidoProcesado !== antes;
        } catch (e) {
            console.warn('Error procesando bloques de código:', e);
            contenidoProcesado = String(contenido ?? '');
        }
    }

    if (tieneCodigo) {
        div.innerHTML = contenidoProcesado;
        try { linkificarNodosDeTexto(div); } catch (e) { /* noop */ }
    } else {
        const wrapper = document.createElement('div');
        wrapper.textContent = contenidoProcesado;
        try { linkificarNodosDeTexto(wrapper); } catch (e) { /* noop */ }
        while (wrapper.firstChild) {
            div.appendChild(wrapper.firstChild);
        }
    }
    // ===================================

    // ============ PIE: TIMESTAMP + BOTÓN DESCARGA (inline) ============
    const pieMensaje = document.createElement('div');
    pieMensaje.className = 'mensaje-pie';
    Object.assign(pieMensaje.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '6px',
        fontSize: '0.75rem',
        color: '#888'
    });

    const ts = document.createElement('span');
    ts.className = 'timestamp';
    ts.textContent = getTimestamp();
    pieMensaje.appendChild(ts);

    if (esRespuestaIA && contenido) {
        const btnDescarga = document.createElement('button');
        btnDescarga.textContent = '📥';
        btnDescarga.title = 'Descargar respuesta';
        btnDescarga.className = 'download-response-btn';
        Object.assign(btnDescarga.style, {
            background: 'transparent',
            color: '#888',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            padding: '0 4px',
            lineHeight: '1',
            opacity: '0.6',
            transition: 'opacity 0.2s'
        });
        btnDescarga.onmouseenter = () => { btnDescarga.style.opacity = '1'; };
        btnDescarga.onmouseleave = () => { btnDescarga.style.opacity = '0.6'; };

        btnDescarga.onclick = () => {
            const blob = new Blob([String(contenido)], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `respuesta_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        pieMensaje.appendChild(btnDescarga);
    }

    div.appendChild(pieMensaje);
    // ================================================================

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ============================================
// 2b. LINKIFICAR URLs
// ============================================
function linkificarNodosDeTexto(root) {
    const URL_REGEX = /(https?:\/\/[^\s<>"'()]+|www\.[^\s<>"'()]+)/gi;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (nodo) => {
            const valor = nodo.nodeValue || '';
            URL_REGEX.lastIndex = 0;
            if (!URL_REGEX.test(valor)) {
                URL_REGEX.lastIndex = 0;
                return NodeFilter.FILTER_REJECT;
            }
            URL_REGEX.lastIndex = 0;
            let p = nodo.parentElement;
            while (p && p !== root) {
                const tag = (p.tagName || '').toLowerCase();
                if (tag === 'a' || tag === 'pre' || tag === 'code') {
                    return NodeFilter.FILTER_REJECT;
                }
                p = p.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const nodos = [];
    let n;
    while ((n = walker.nextNode())) nodos.push(n);

    for (const nodo of nodos) {
        const texto = nodo.nodeValue || '';
        const frag = document.createDocumentFragment();
        let ultimo = 0;
        let m;
        URL_REGEX.lastIndex = 0;

        while ((m = URL_REGEX.exec(texto)) !== null) {
            const url = m[0];
            if (m.index > ultimo) {
                frag.appendChild(document.createTextNode(texto.substring(ultimo, m.index)));
            }
            const hrefCompleto = url.startsWith('http') ? url : `https://${url}`;
            const a = document.createElement('a');
            a.href = hrefCompleto;
            a.textContent = acortarUrlParaMostrar(url);
            a.title = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.color = '#4a9eff';
            a.style.textDecoration = 'underline';
            a.style.cursor = 'pointer';
            a.style.wordBreak = 'break-all';
            frag.appendChild(a);
            ultimo = m.index + url.length;
        }

        if (ultimo < texto.length) {
            frag.appendChild(document.createTextNode(texto.substring(ultimo)));
        }
        if (nodo.parentNode) {
            nodo.parentNode.replaceChild(frag, nodo);
        }
    }
}

// ============================================
// 2c. ACORTAR URL
// ============================================
function acortarUrlParaMostrar(url) {
    if (url.length <= 50) return url;
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        return u.hostname + '/…';
    } catch {
        return url.substring(0, 47) + '…';
    }
}

// ============================================
// 3. MOSTRAR PENSANDO
// ============================================
function mostrarPensando(mostrar) {
    const typingIndicator = document.getElementById('typingIndicator');
    const sendBtn = document.getElementById('sendBtn');
    const input = document.getElementById('userInput');

    if (typingIndicator) typingIndicator.style.display = mostrar ? 'flex' : 'none';
    if (sendBtn) sendBtn.disabled = mostrar;
    if (input) {
        input.disabled = mostrar;
        input.placeholder = mostrar ? 'Pensando...' : 'Escribí tu mensaje...';
    }
}

// ============================================
// 4. HISTORIAL LOCAL
// ============================================
function guardarHistorialLocal() {
    try {
        const data = {
            modelo: typeof modeloActual !== 'undefined' ? modeloActual : 'llama3.2:3b',
            temperatura: typeof temperatura !== 'undefined' ? temperatura : 0.7,
            mensajes: typeof historialConversacion !== 'undefined' ? historialConversacion : []
        };
        localStorage.setItem('lila_historial', JSON.stringify(data));
        const storageStatus = document.getElementById('storageStatus');
        if (storageStatus) {
            storageStatus.textContent = `💾 ${data.mensajes.length} msg`;
        }
    } catch (e) {
        console.warn('No se pudo guardar historial local:', e);
    }
}

function cargarHistorialLocal() {
    try {
        const raw = localStorage.getItem('lila_historial');
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data.modelo && typeof modeloActual !== 'undefined') {
            modeloActual = data.modelo;
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) modelSelect.value = modeloActual;
        }
        if (data.temperatura !== undefined && typeof temperatura !== 'undefined') {
            temperatura = data.temperatura;
        }
        if (Array.isArray(data.mensajes)) {
            historialConversacion = data.mensajes;
            const container = document.getElementById('messageContainer');
            if (container) {
                container.innerHTML = '';
                for (const msg of historialConversacion) {
                    agregarMensaje(msg.role, msg.content);
                }
            }
            return true;
        }
        return false;
    } catch (e) {
        console.warn('No se pudo cargar historial local:', e);
        return false;
    }
}

// ============================================
// 5. ARCHIVOS
// ============================================
function actualizarInfoArchivos() {
    const fileInfo = document.getElementById('fileInfo');
    const clearFileBtn = document.getElementById('clearFileBtn');
    const archivos = typeof archivosSubidos !== 'undefined' ? archivosSubidos : [];

    if (archivos.length === 0) {
        if (fileInfo) fileInfo.textContent = 'Ningún archivo';
        if (clearFileBtn) clearFileBtn.style.display = 'none';
    } else {
        const nombres = archivos.map(a => a.nombre).join(', ');
        if (fileInfo) fileInfo.textContent = `${archivos.length} archivo(s): ${nombres}`;
        if (clearFileBtn) clearFileBtn.style.display = 'inline';
    }
}

// ============================================
// 6. EXPORTAR CONVERSACIÓN
// ============================================
function exportarConversacion() {
    try {
        const data = {
            fecha: new Date().toISOString(),
            modelo: typeof modeloActual !== 'undefined' ? modeloActual : 'llama3.2:3b',
            temperatura: typeof temperatura !== 'undefined' ? temperatura : 0.7,
            mensajes: typeof historialConversacion !== 'undefined' ? historialConversacion : []
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lila_export_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        agregarMensaje('assistant', '✅ Conversación exportada.');
    } catch (e) {
        agregarMensaje('assistant', '❌ Error al exportar: ' + e.message);
    }
}

// ============================================
// 7. UBICACIÓN
// ============================================
function obtenerUbicacion() {
    const locationBadge = document.getElementById('locationBadge');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                try {
                    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=es`);
                    if (resp.ok) {
                        const data = await resp.json();
                        const address = data.address || {};
                        const city = address.city || address.town || address.village || address.municipality || address.county || '';
                        const country = address.country || '';
                        const ubicacion = `${city}, ${country}`.replace(/^, |, $/g, '').trim() || 'Ubicación desconocida';
                        if (locationBadge) locationBadge.textContent = `📍 ${ubicacion}`;
                        if (typeof ubicacionInfo !== 'undefined') ubicacionInfo = ubicacion;
                    } else {
                        const ubicacion = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
                        if (locationBadge) locationBadge.textContent = `📍 ${ubicacion}`;
                        if (typeof ubicacionInfo !== 'undefined') ubicacionInfo = ubicacion;
                    }
                } catch (e) {
                    const ubicacion = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
                    if (locationBadge) locationBadge.textContent = `📍 ${ubicacion}`;
                    if (typeof ubicacionInfo !== 'undefined') ubicacionInfo = ubicacion;
                }
            },
            () => {
                if (locationBadge) locationBadge.textContent = '📍 No disponible';
                if (typeof ubicacionInfo !== 'undefined') ubicacionInfo = 'No disponible';
            },
            { timeout: 5000 }
        );
    } else {
        if (locationBadge) locationBadge.textContent = '📍 No disponible';
        if (typeof ubicacionInfo !== 'undefined') ubicacionInfo = 'No disponible';
    }
}

// ============================================
// 8. VERIFICAR BACKEND
// ============================================
function verificarBackend() {
    const baseUrl = (typeof API_BASE !== 'undefined') ? API_BASE : 'http://127.0.0.1:8000';
    fetch(`${baseUrl}/api/models/`, { method: 'GET' })
        .then(resp => {
            const backendStatus = document.getElementById('backendStatus');
            const backendStatusText = document.getElementById('backendStatusText');
            if (resp.ok) {
                if (backendStatus) {
                    backendStatus.textContent = '🟢 Conectado';
                    backendStatus.className = 'ws-status conectado';
                }
                if (backendStatusText) {
                    backendStatusText.textContent = 'Conectado al backend';
                    backendStatusText.className = 'online';
                }
            } else {
                if (backendStatus) {
                    backendStatus.textContent = '🔴 Error';
                    backendStatus.className = 'ws-status';
                }
                if (backendStatusText) {
                    backendStatusText.textContent = `⚠️ Backend error ${resp.status}`;
                    backendStatusText.className = '';
                }
            }
        })
        .catch(() => {
            const backendStatus = document.getElementById('backendStatus');
            const backendStatusText = document.getElementById('backendStatusText');
            if (backendStatus) {
                backendStatus.textContent = '🔴 Desconectado';
                backendStatus.className = 'ws-status';
            }
            if (backendStatusText) {
                backendStatusText.textContent = '⚠️ No conectado al backend';
                backendStatusText.className = '';
            }
        });
}

// ============================================
// 9. HISTORIAL DE COMANDOS
// ============================================
function guardarHistorialComandos() {
    try {
        localStorage.setItem('lila_historial_comandos', JSON.stringify(historialComandos));
    } catch (e) {
        console.warn('No se pudo guardar historial de comandos:', e);
    }
}

function cargarHistorialComandos() {
    try {
        const raw = localStorage.getItem('lila_historial_comandos');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                historialComandos = parsed;
                indiceComando = historialComandos.length;
                return true;
            }
        }
        return false;
    } catch (e) {
        console.warn('No se pudo cargar historial de comandos:', e);
        return false;
    }
}

// ============================================
// 10. EXPOSICIÓN GLOBAL
// ============================================
window.getTimestamp = getTimestamp;
window.insertCommand = insertCommand;
window.toggleMenu = toggleMenu;
window.agregarMensaje = agregarMensaje;
window.linkificarNodosDeTexto = linkificarNodosDeTexto;
window.acortarUrlParaMostrar = acortarUrlParaMostrar;
window.mostrarPensando = mostrarPensando;
window.guardarHistorialLocal = guardarHistorialLocal;
window.cargarHistorialLocal = cargarHistorialLocal;
window.actualizarInfoArchivos = actualizarInfoArchivos;
window.exportarConversacion = exportarConversacion;
window.obtenerUbicacion = obtenerUbicacion;
window.verificarBackend = verificarBackend;
window.guardarHistorialComandos = guardarHistorialComandos;
window.cargarHistorialComandos = cargarHistorialComandos;