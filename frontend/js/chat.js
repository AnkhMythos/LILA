// frontend/js/chat.js
let esperandoRespuesta = false;

const inputElement = document.getElementById('userInput');

// ============================================================
// INDICADOR "PENSANDO..."
// ============================================================
function _activarIndicadorPensando(mostrar) {
    const el = document.getElementById('typingIndicator');
    if (!el) return;
    try {
        el.style.setProperty('display', mostrar ? 'flex' : 'none', 'important');
    } catch (e) {
        el.style.display = mostrar ? 'flex' : 'none';
    }
    el.classList.toggle('visible', mostrar);
}

async function enviarMensaje(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }

    const texto = inputElement.value.trim();
    if (!texto || esperandoRespuesta) return;

    // === GUARDAR COMANDO EN HISTORIAL ===
    if (texto.length > 0) {
        const ultimo = historialComandos[historialComandos.length - 1];
        if (ultimo !== texto) {
            historialComandos.push(texto);
            if (typeof guardarHistorialComandos === 'function') {
                guardarHistorialComandos();
            }
        }
        indiceComando = historialComandos.length;
    }

    // 1. ESCANEAR DISPOSITIVOS
    if (texto.toLowerCase() === '/escanear' || texto.toLowerCase() === '/dispositivos') {
        agregarMensaje('user', '🔍 Escaneando hardware...');
        inputElement.value = '';
        inputElement.focus();
        try {
            const resp = await fetch(`${API_BASE}/api/hardware/dispositivos`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (!data || data.length === 0) {
                agregarMensaje('assistant', '⚠️ No se encontraron dispositivos USB. Verifica la conexión física y los permisos del sistema.');
            } else {
                let lista = '📡 **Dispositivos detectados:**\n\n';
                data.forEach((dev, index) => {
                    lista += `**${index + 1}.** ID: \`${dev.id}\` (Vendor: ${dev.vendor}, Product: ${dev.product})\n`;
                });
                lista += '\n💡 *Para controlar uno, escribe:* `/control-remoto <ID> <COMANDO>`\n*Ejemplo:* `/control-remoto 1a86:7523 ON`';
                agregarMensaje('assistant', lista);
            }
        } catch (err) {
            agregarMensaje('assistant', `❌ Error de red al contactar el módulo de hardware: ${err.message}`);
        }
        return;
    }

    // 2. CONTROL REMOTO
    if (texto.toLowerCase().startsWith('/control-remoto ')) {
        const partes = texto.split(' ');
        const dispositivo = partes[1];
        const comando = partes.slice(2).join(' ') || 'ON';
        if (!dispositivo) {
            agregarMensaje('assistant', '⚠️ Formato incorrecto. Usa: `/control-remoto <ID_DISPOSITIVO> <COMANDO>`');
            inputElement.value = '';
            return;
        }
        agregarMensaje('user', `[COMANDO] Enviando "${comando}" a ${dispositivo}`);
        inputElement.value = '';
        inputElement.focus();
        try {
            const resp = await fetch(`${API_BASE}/api/agentes/control-remoto/ejecutar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dispositivo, comando })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            agregarMensaje('assistant', data.respuesta || `❌ Error: ${data.error || 'sin detalle'}`);
        } catch (err) {
            agregarMensaje('assistant', `❌ Error de red al contactar el módulo de control: ${err.message}`);
        }
        return;
    }

    // ----- COMANDOS GENERALES -----
    if (texto.startsWith('/')) {
        _activarIndicadorPensando(true);
        let esComando = false;
        try {
            esComando = await procesarComando(texto);
        } catch (error) {
            console.error('Error al procesar comando:', error);
            agregarMensaje('assistant', `❌ Error interno: ${error.message}`);
            inputElement.value = '';
            inputElement.focus();
            _activarIndicadorPensando(false);
            return;
        }
        inputElement.value = '';
        inputElement.focus();
        _activarIndicadorPensando(false);
        if (esComando) return;
    }

    // Mostrar mensaje del usuario
    agregarMensaje('user', texto);
    historialConversacion.push({ role: 'user', content: texto });
    guardarHistorialLocal();

    if (dialogoActivo) {
        if (typeof window.resetearProfundidadCadena === 'function') {
            window.resetearProfundidadCadena();
        }
        enviarMensajeWS('mensaje', texto);
    }

    esperandoRespuesta = true;
    if (typeof mostrarPensando === 'function') mostrarPensando(true);

    let respuestaObtenida = false;

    // ============================================================
    // MODO MULTIAGENTE ACTIVO → derivar tareas complejas
    // ============================================================
    const palabrasClaveMulti = /(resolvé|resuelve|analizá|analiza|compará|compara|diseñá|diseña|explicá|explica|planificá|planifica|codigo|código|programa|debug|refactor|investigá|investiga|escribí|escribe|por qué|por que|cómo funciona|como funciona)/i;
    const esCompleja = texto.length > 80 || palabrasClaveMulti.test(texto);

    if (window.multiagenteActivo && !texto.startsWith('/') && esCompleja) {
        try {
            await coordinarAgentes(texto);
            respuestaObtenida = true;
        } catch (e) {
            console.warn('Multiagente falló, usando chat normal:', e);
        }
    }

    // ============================================================
    // ORQUESTADOR SIMPLE
    // ============================================================
    if (!respuestaObtenida && !texto.startsWith('/')) {
        try {
            const routerResp = await fetch(`${API_BASE}/api/router/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: texto })
            });
            if (routerResp.ok) {
                const routerData = await routerResp.json();
                const agente = routerData.agente;
                if (agente) {
                    const ejecResp = await fetch(`${API_BASE}/api/agentes/${encodeURIComponent(agente)}/ejecutar`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tarea: routerData.mensaje_para_agente || texto })
                    });
                    if (ejecResp.ok) {
                        const ejecData = await ejecResp.json();
                        if (ejecData.respuesta) {
                            const mensajeAgente = `🧠 **${ejecData.agente}** (${ejecData.modelo}):\n${ejecData.respuesta}`;
                            agregarMensaje('assistant', mensajeAgente);
                            historialConversacion.push({ role: 'assistant', content: mensajeAgente });
                            guardarHistorialLocal();
                            if (vozActivada && typeof hablar === 'function') {
                                hablar(ejecData.respuesta);
                            }
                            respuestaObtenida = true;
                        }
                    } else {
                        console.warn('El agente no pudo ejecutarse, usando chat normal.');
                    }
                }
            } else {
                console.warn('Router no disponible, usando chat normal.');
            }
        } catch (e) {
            console.warn('Error en orquestador, usando chat normal:', e);
        }
    }

    // ============================================================
    // CHAT NORMAL
    // ============================================================
    if (!respuestaObtenida) {
        try {
            const response = await fetch(`${API_BASE}/api/chat/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: USER_ID,
                    message: texto,
                    model: modeloActual,
                    temperature: temperatura,
                    use_rag: true,
                    max_tokens: 512,
                    history: historialConversacion
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            const respuesta = data.response;
            if (respuesta && respuesta.length > 0) {
                agregarMensaje('assistant', respuesta);
                historialConversacion.push({ role: 'assistant', content: respuesta });
                guardarHistorialLocal();
                if (vozActivada && typeof hablar === 'function') {
                    hablar(respuesta);
                }
            }
        } catch (error) {
            console.error(error);
            agregarMensaje('assistant', `❌ Error conectando con el backend: ${error.message}`);
        }
    }

    esperandoRespuesta = false;
    if (typeof mostrarPensando === 'function') mostrarPensando(false);
    inputElement.focus();
    inputElement.value = '';
}

async function generarRespuestaAutomatica(pregunta) {
    try {
        const response = await fetch(`${API_BASE}/api/chat/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: USER_ID,
                message: pregunta,
                model: modeloActual,
                temperature: temperatura,
                use_rag: true,
                max_tokens: 512,
                history: historialConversacion,
                skip_shortcuts: true
            })
        });
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data = await response.json();
        const respuesta = data.response || '';
        if (respuesta && vozActivada && typeof hablar === 'function') {
            hablar(respuesta);
        }
        return respuesta;
    } catch (error) {
        console.error('Error en respuesta automática:', error);
        throw error;
    }
}

// ============================================================
// HISTORIAL DE COMANDOS CON FLECHAS ↑ / ↓
// ============================================================
if (inputElement && !inputElement.dataset.historialAttached) {
    inputElement.dataset.historialAttached = '1';

    inputElement.addEventListener('keydown', (e) => {
        if (!Array.isArray(historialComandos) || historialComandos.length === 0) return;
        if (typeof indiceComando !== 'number' || indiceComando < 0) {
            indiceComando = historialComandos.length;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (indiceComando > 0) {
                indiceComando--;
                inputElement.value = historialComandos[indiceComando];
                requestAnimationFrame(() => {
                    inputElement.selectionStart = inputElement.selectionEnd = inputElement.value.length;
                });
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (indiceComando < historialComandos.length - 1) {
                indiceComando++;
                inputElement.value = historialComandos[indiceComando];
                requestAnimationFrame(() => {
                    inputElement.selectionStart = inputElement.selectionEnd = inputElement.value.length;
                });
            } else {
                indiceComando = historialComandos.length;
                inputElement.value = '';
            }
        } else if (e.key === 'Escape') {
            indiceComando = historialComandos.length;
            inputElement.value = '';
        }
    });
    console.log('⌨️ Historial de comandos con ↑ / ↓ activado');
}

window.enviarMensaje = enviarMensaje;
window.generarRespuestaAutomatica = generarRespuestaAutomatica;