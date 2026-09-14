// frontend/js/websocket.js
if (typeof window.wsQueue === 'undefined') window.wsQueue = [];

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 15000;

let _respondiendoAuto = false;
const _colaRespuestas = [];

// ============================================================
// LÍMITE DE INTERACCIONES ENTRE INSTANCIAS
// Cada instancia corta después de mandar N respuestas.
// Como son 2 instancias, el máximo real de mensajes es ~2N.
// ============================================================
const MAX_PROFUNDIDAD_CADENA = 10;

let _profundidadCadena = 0;

// ============================================================
// HELPERS
// ============================================================
function _actualizarBotonDialogo(activo) {
    const btn = document.getElementById('footerDialogo');
    if (!btn) return;
    btn.classList.toggle('online', activo);
    btn.classList.toggle('offline', !activo);
}

function sanitizarParaWS(texto) {
    let t = String(texto || '').trim();
    if (t.startsWith('/')) {
        t = ' ' + t;
    }
    return t;
}

function resetearProfundidadCadena() {
    _profundidadCadena = 0;
}

// ============================================================
// GUARDAR EN HISTORIAL LOCAL (compartido con el chat normal)
// ============================================================
function _guardarEnHistorial(rol, contenido) {
    try {
        if (!Array.isArray(window.historialConversacion)) {
            window.historialConversacion = [];
        }
        window.historialConversacion.push({ role: rol, content: contenido });
        if (typeof window.guardarHistorialLocal === 'function') {
            window.guardarHistorialLocal();
        }
    } catch (e) {
        console.warn('[ws] No se pudo guardar en historial:', e.message);
    }
}

// ============================================================
// CONEXIÓN WEBSOCKET
// ============================================================
function conectarWS() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
    console.log('🔄 Conectando WebSocket a:', WS_URL);
    ws = new WebSocket(WS_URL);

    ws.onopen = function() {
        console.log('✅ WebSocket conectado');
        reconnectAttempts = 0;
        while (window.wsQueue.length > 0) {
            const msg = window.wsQueue.shift();
            ws.send(JSON.stringify({ type: msg.type, content: msg.content }));
        }
        if (typeof window.actualizarFooterWs === 'function') window.actualizarFooterWs(true);
    };

    ws.onmessage = function(event) {
        let data;
        try { data = JSON.parse(event.data); }
        catch (e) { console.error('❌ JSON inválido:', event.data); return; }

        console.log('📩 WS recibido:', data.type, data);

        if (data.type === 'bienvenida') {
            window._miClienteId = data.clienteId;
            const total = (data.clientes || []).length;
            console.log(`🆔 Soy ${data.clienteId} | ${total} instancia(s)`);
            if (typeof window.actualizarInstancias === 'function') {
                window.actualizarInstancias(total);
            }
            return;
        }

        if (data.type === 'nueva_instancia') {
            const total = (data.clientes || []).length;
            console.log(`👋 Se conectó ${data.clienteId} | total: ${total}`);
            if (typeof window.actualizarInstancias === 'function') {
                window.actualizarInstancias(total);
            }
            return;
        }

        if (data.type === 'desconexion') {
            const total = (data.clientes || []).length;
            console.log(`👋 Se desconectó ${data.clienteId} | total: ${total}`);
            if (typeof window.actualizarInstancias === 'function') {
                window.actualizarInstancias(total);
            }
            return;
        }

        if (data.type === 'estado_dialogo') {
            if (data.content && typeof data.content.activo !== 'undefined') {
                dialogoActivo = data.content.activo;
                _actualizarBotonDialogo(dialogoActivo);
                console.log(`💬 Diálogo sincronizado desde otra instancia: ${dialogoActivo ? 'ON' : 'OFF'}`);
            }
            return;
        }

        // ============================================================
        // MENSAJE DE OTRA INSTANCIA
        // ============================================================
        if (data.type === 'mensaje') {
            const origenCorto = String(data.origen || 'otra').replace('inst_', '');
            const hora = new Date(data.timestamp || Date.now())
                .toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const contenido = String(data.content || '');

            console.log(`💬 [${origenCorto}] → "${contenido.slice(0, 80)}"`);

            const textoMostrar = `📨 **[Instancia ${origenCorto}]** (${hora}):\n${contenido}`;

            if (typeof agregarMensaje === 'function') {
                agregarMensaje('assistant', textoMostrar);
            }

            // GUARDAR EN HISTORIAL LOCAL
            _guardarEnHistorial('assistant', `📨 [Instancia ${origenCorto}]: ${contenido}`);

            // Si es comando o vacío, no auto-responder
            if (!contenido.trim() || contenido.trim().startsWith('/')) {
                console.log(`   ⏭️ ignorado (comando o vacío)`);
                return;
            }

            // Si Diálogo activo, encolar respuesta automática
            if (dialogoActivo && typeof window.generarRespuestaAutomatica === 'function') {
                _colaRespuestas.push({ contenido, origen: origenCorto });
                procesarColaRespuestas();
            }
            return;
        }

        console.log('📩 WS tipo desconocido:', data.type);
    };

    ws.onclose = function(event) {
        console.log(`🔌 WebSocket desconectado (Código: ${event.code})`);
        ws = null;
        if (typeof window.actualizarFooterWs === 'function') window.actualizarFooterWs(false);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Reintento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en ${RECONNECT_DELAY/1000}s`);
            if (!reconnectInterval) {
                reconnectInterval = setInterval(() => {
                    fetch(`${API_BASE}/api/health`)
                        .then(res => { if (res.ok) conectarWS(); })
                        .catch(() => {});
                }, RECONNECT_DELAY);
            }
        }
    };

    ws.onerror = function(error) {
        console.error('❌ Error WebSocket:', error);
    };
}

// ============================================================
// COLA DE RESPUESTAS AUTOMÁTICAS
// ============================================================
async function procesarColaRespuestas() {
    if (_respondiendoAuto) return;
    if (_colaRespuestas.length === 0) return;

    _respondiendoAuto = true;

    while (_colaRespuestas.length > 0) {
        // Límite de profundidad
        if (_profundidadCadena >= MAX_PROFUNDIDAD_CADENA) {
            console.log(`🛑 Cadena cortada en profundidad ${_profundidadCadena} (máx ${MAX_PROFUNDIDAD_CADENA})`);
            if (typeof agregarMensaje === 'function') {
                agregarMensaje('assistant', '🛑 Diálogo detenido automáticamente (se alcanzó el límite de respuestas encadenadas).');
            }
            _colaRespuestas.length = 0;
            _profundidadCadena = 0;
            break;
        }

        const tarea = _colaRespuestas.shift();
        const delay = 3000 + Math.floor(Math.random() * 2000);
        console.log(`💬 Diálogo → esperando ${delay}ms antes de responder a [${tarea.origen}] (profundidad ${_profundidadCadena + 1}/${MAX_PROFUNDIDAD_CADENA})`);
        await new Promise(res => setTimeout(res, delay));

        try {
            const respuesta = await window.generarRespuestaAutomatica(tarea.contenido);

            // Si el usuario apagó el diálogo mientras se generaba, descartar
            if (!dialogoActivo) {
                console.log(`🛑 Respuesta descartada (diálogo apagado durante la generación)`);
                continue;
            }

            if (respuesta && respuesta.trim()) {
                console.log(`💬 Respondiendo a [${tarea.origen}]: "${respuesta.slice(0, 60)}..."`);

                const respuestaSegura = sanitizarParaWS(respuesta);
                _profundidadCadena++;

                enviarMensajeWS('mensaje', respuestaSegura);

                if (typeof agregarMensaje === 'function') {
                    agregarMensaje('assistant', respuesta);
                }

                // GUARDAR EN HISTORIAL LOCAL (mi propia respuesta)
                _guardarEnHistorial('assistant', respuesta);
            }
        } catch (e) {
            console.error('❌ Error respuesta automática:', e.message);
            if (typeof agregarMensaje === 'function') {
                agregarMensaje('assistant', `⚠️ No pude responder: ${e.message}`);
            }
        }
        await new Promise(res => setTimeout(res, 1500));
    }
    _respondiendoAuto = false;
}

// ============================================================
// ENVIAR MENSAJE POR WS
// ============================================================
function enviarMensajeWS(tipo, contenido) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: tipo, content: contenido }));
        console.log(`📤 WS enviado [${tipo}]:`, contenido);
    } else {
        console.warn('⚠️ WS no conectado. Encolando mensaje.');
        window.wsQueue.push({ type: tipo, content: contenido });
        conectarWS();
    }
}

// ============================================================
// TOGGLE DIÁLOGO
// ============================================================
function toggleDialogo() {
    dialogoActivo = !dialogoActivo;
    _actualizarBotonDialogo(dialogoActivo);
    console.log(`💬 Diálogo local: ${dialogoActivo ? 'ON' : 'OFF'}`);
    enviarMensajeWS('estado_dialogo', { activo: dialogoActivo });
    resetearProfundidadCadena();

    // Al APAGAR el diálogo, vaciar la cola de respuestas pendientes
    if (!dialogoActivo) {
        const pendientes = _colaRespuestas.length;
        _colaRespuestas.length = 0;
        if (pendientes > 0) {
            console.log(`🛑 Diálogo desactivado → ${pendientes} respuesta(s) pendiente(s) descartadas`);
        }
    }

    if (typeof agregarMensaje === 'function') {
        agregarMensaje(
            'assistant',
            dialogoActivo
                ? '💬 **Diálogo activado.** Las instancias se responderán automáticamente entre sí.'
                : '💬 **Diálogo desactivado.**'
        );
    }
}

// ============================================================
// EXPOSICIÓN GLOBAL
// ============================================================
window.conectarWS = conectarWS;
window.enviarMensajeWS = enviarMensajeWS;
window.toggleDialogo = toggleDialogo;
window.sanitizarParaWS = sanitizarParaWS;
window.resetearProfundidadCadena = resetearProfundidadCadena;