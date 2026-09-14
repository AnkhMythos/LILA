// frontend/js/commands.js

// ============================================================
// UTILIDADES INTERNAS
// ============================================================
function _apiBase() {
    if (typeof window.API_BASE !== 'undefined' && window.API_BASE) return window.API_BASE;
    if (typeof API_BASE !== 'undefined' && API_BASE) return API_BASE;
    console.warn('[commands] API_BASE no detectada, usando fallback');
    return 'http://127.0.0.1:8000';
}

function _mostrarTyping(mostrar) {
    const el = document.getElementById('typingIndicator');
    if (el) el.style.display = mostrar ? 'flex' : 'none';
}

function _hablarSiActivo(texto) {
    if (typeof window.vozActivada !== 'undefined' && window.vozActivada &&
        typeof window.hablar === 'function') {
        try { window.hablar(texto); } catch (e) {}
    }
}

async function _fetchJSON(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(url, { ...options, signal: controller.signal });
        let data = null;
        try { data = await resp.json(); } catch {}
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

// Traducir errores de red a mensajes amigables
function _errorAmigable(e, contexto = 'la operación') {
    const msg = String(e && e.message || '');
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        return `No se pudo conectar con el backend. Verificá que esté corriendo (npm start).`;
    }
    if (msg.includes('Timeout')) {
        return `${msg} al ejecutar ${contexto}.`;
    }
    if (msg.includes('HTTP 404')) {
        return `El endpoint no existe en el backend. Puede que falte actualizar algún archivo.`;
    }
    if (msg.includes('HTTP 500')) {
        return `El backend tuvo un error interno al procesar ${contexto}.`;
    }
    return msg || `Error desconocido en ${contexto}`;
}

// ============================================================
// PROCESADOR PRINCIPAL
// ============================================================
async function procesarComando(texto) {
    const textoLimpio = texto.trim();
    const partes = textoLimpio.split(' ');
    const comando = partes[0].toLowerCase();
    const resto = textoLimpio.substring(comando.length).trim();

    const agregarMensaje = window.agregarMensaje || console.log;

    // ===== AYUDA =====
    if (comando === '/ayuda' || comando === '/help') {
        agregarMensaje('assistant',
            `📋 **Comandos disponibles**\n\n` +
            `🗣️ **Voz y escucha**\n` +
            `- \`/voz on|off|info|<n>\` — gestiona la voz\n` +
            `- \`/voces\` — lista voces del sistema\n` +
            `- \`/velocidad <n>\` · \`/tono <n>\` · \`/volumen <n>\`\n` +
            `- \`/escuchar\` · \`/parescuchar\` — activa/desactiva micrófono\n\n` +
            `🧠 **Inteligencia artificial**\n` +
            `- \`/modelo <nombre>\` — cambia el modelo de Ollama\n` +
            `- \`/temperatura <0-1>\` — ajusta creatividad\n` +
            `- \`/coordinar <tarea>\` — orquesta varios agentes\n` +
            `- \`/agentes\` — lista los agentes disponibles\n` +
            `- \`/ejecutar <agente> <tarea>\` — ejecuta un agente puntual\n` +
            `- \`/multiagente\` — activa/desactiva el modo multiagente\n` +
            `- \`/tools\` — herramientas de los agentes\n\n` +
            `🔌 **MCP (Model Context Protocol)**\n` +
            `- \`/mcp status\` — estado de servidores MCP\n` +
            `- \`/mcp tools\` — herramientas MCP disponibles\n` +
            `- \`/mcp call <tool> <json>\` — invoca una tool MCP\n\n` +
            `🧠 **Memoria compartida**\n` +
            `- \`/recordar <clave>: <valor>\` — guarda un hecho\n` +
            `- \`/olvidar <clave>|todo\` — elimina hechos\n` +
            `- \`/memoria\` — ve la memoria del multiagente\n` +
            `- \`/yo\` — muestra lo que recuerdo de vos\n` +
            `- \`/historialma\` — historial de coordinaciones del multiagente\n\n` +
            `🔍 **Búsqueda e información**\n` +
            `- \`/buscar <texto>\` — busca en la web\n` +
            `- \`/wikipedia <término>\` · \`/wikidata <término>\`\n` +
            `- \`/noticias [tema]\` — últimas noticias\n\n` +
            `💬 **Conversación**\n` +
            `- \`/historial\` — últimos mensajes\n` +
            `- \`/borrar\` — reinicia la conversación\n` +
            `- \`/exportar\` · \`/importar\` — JSON de la conversación\n` +
            `- \`/version\` — versión y estado\n\n` +
            `⚙️ **Utilidades**\n` +
            `- \`/archivos\` — archivos subidos\n` +
            `- \`/python <código>\` — ejecuta Python en el backend\n` +
            `- \`/dialogo\` — activa diálogo entre instancias\n` +
            `- \`/conectar\` — reconecta WebSocket\n` +
            `- \`/enviar <mensaje>\` — envía a otras instancias`
        );
        return true;
    }

    // ===== VOZ Y ESCUCHA =====
    if (comando === '/escuchar') {
        if (typeof window.toggleEscucha === 'function') {
            window.toggleEscucha();
            setTimeout(() => {
                agregarMensaje('assistant',
                    window.escuchando ? '🎙️ Escuchando...' : '🎙️ Dejé de escuchar.');
            }, 50);
        } else {
            agregarMensaje('assistant', '⚠️ Función de escucha no disponible.');
        }
        return true;
    }

    if (comando === '/parescuchar') {
        if (typeof window.detenerReconocimiento === 'function') {
            window.detenerReconocimiento();
            agregarMensaje('assistant', '🎙️ Dejé de escuchar.');
        } else {
            agregarMensaje('assistant', '⚠️ Función no disponible.');
        }
        return true;
    }

    if (comando === '/voces') {
        if (typeof window.listarVoces === 'function') window.listarVoces();
        else agregarMensaje('assistant', '⚠️ Función de voces no disponible.');
        return true;
    }

    if (comando === '/voz') {
        const arg = resto.toLowerCase();
        if (arg === 'on') {
            if (window.vozActivada) {
                agregarMensaje('assistant', '🔊 La voz ya está activada.');
            } else if (typeof window.toggleVoz === 'function') {
                window.toggleVoz();
            } else {
                window.vozActivada = true;
                const btnVoz = document.getElementById('btnVoz');
                if (btnVoz) { btnVoz.textContent = '🔊 Voz: ON'; btnVoz.classList.add('activo'); }
                const f = document.getElementById('footerVoz');
                if (f) { f.classList.remove('offline'); f.classList.add('online'); }
                agregarMensaje('assistant', '🔊 Voz activada.');
            }
        } else if (arg === 'off') {
            if (!window.vozActivada) {
                agregarMensaje('assistant', '🔇 La voz ya está desactivada.');
            } else if (typeof window.toggleVoz === 'function') {
                window.toggleVoz();
            } else {
                window.vozActivada = false;
                if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
                const btnVoz = document.getElementById('btnVoz');
                if (btnVoz) { btnVoz.textContent = '🔊 Voz: OFF'; btnVoz.classList.remove('activo'); }
                const f = document.getElementById('footerVoz');
                if (f) { f.classList.remove('online'); f.classList.add('offline'); }
                agregarMensaje('assistant', '🔇 Voz desactivada.');
            }
        } else if (arg === 'info') {
            agregarMensaje('assistant',
                `🔊 Voz: ${window.vozSeleccionada ? window.vozSeleccionada.name : 'Ninguna'}\n` +
                `Velocidad: ${window.velocidadVoz}\n` +
                `Tono: ${window.tonoVoz}\n` +
                `Volumen: ${window.volumenVoz}`);
        } else if (!isNaN(arg) && arg !== '') {
            if (typeof window.seleccionarVoz === 'function') window.seleccionarVoz(arg);
            else agregarMensaje('assistant', '⚠️ Función de selección de voz no disponible.');
        } else {
            agregarMensaje('assistant', '⚠️ Usá: /voz on, /voz off, /voz <número>, /voz info o /voces');
        }
        return true;
    }

    if (comando === '/velocidad' && resto) {
        if (typeof window.cambiarVelocidad === 'function') window.cambiarVelocidad(resto);
        return true;
    }
    if (comando === '/tono' && resto) {
        if (typeof window.cambiarTono === 'function') window.cambiarTono(resto);
        return true;
    }
    if (comando === '/volumen' && resto) {
        if (typeof window.cambiarVolumen === 'function') window.cambiarVolumen(resto);
        return true;
    }

    // ===== MODELO Y TEMPERATURA =====
    if (comando === '/modelo') {
        if (!resto) {
            agregarMensaje('assistant', '⚠️ Usá: /modelo <nombre>');
            return true;
        }
        window.modeloActual = resto;
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) modelSelect.value = resto;
        if (typeof window.actualizarBadgeModelo === 'function') window.actualizarBadgeModelo(resto);
        agregarMensaje('assistant', `✅ Modelo cambiado a **${resto}**.`);
        if (typeof window.guardarHistorialLocal === 'function') window.guardarHistorialLocal();
        return true;
    }

    if (comando === '/temperatura') {
        const val = parseFloat(resto);
        if (!isNaN(val) && val >= 0 && val <= 1) {
            window.temperatura = val;
            agregarMensaje('assistant', `🌡️ Temperatura ajustada a **${val}**.`);
            if (typeof window.guardarHistorialLocal === 'function') window.guardarHistorialLocal();
        } else {
            agregarMensaje('assistant', '⚠️ Usá: /temperatura <0-1>');
        }
        return true;
    }

    // ===== CONVERSACIÓN =====
    if (comando === '/historial') {
        const hist = window.historialConversacion || [];
        const total = hist.length;
        if (total === 0) {
            agregarMensaje('assistant', '📭 No hay mensajes.');
        } else {
            const resumen = hist
                .filter(m => m.role !== 'system')
                .slice(-10)
                .map((m, i) => `${i + 1}. ${m.role === 'user' ? '👤' : '🧉'} ${String(m.content || '').substring(0, 55)}${String(m.content || '').length > 55 ? '...' : ''}`)
                .join('\n');
            agregarMensaje('assistant', `📜 **Últimos ${Math.min(10, total)} mensajes:**\n${resumen}`);
        }
        return true;
    }

    if (comando === '/borrar') {
        window.historialConversacion = [];
        const container = document.getElementById('messageContainer');
        if (container) container.innerHTML = '';
        if (typeof window.guardarHistorialLocal === 'function') window.guardarHistorialLocal();
        agregarMensaje('assistant', '🧉 Historial borrado.');
        return true;
    }

    if (comando === '/exportar') {
        if (typeof window.exportarConversacion === 'function') window.exportarConversacion();
        else agregarMensaje('assistant', '⚠️ Función de exportación no disponible.');
        return true;
    }

    if (comando === '/importar') {
        const input = document.getElementById('importInput');
        if (!input) {
            agregarMensaje('assistant', '⚠️ No hay input de importación disponible.');
            return true;
        }
        const onImport = async (ev) => {
            input.removeEventListener('change', onImport);
            const file = ev.target?.files?.[0];
            if (!file) return;
            try {
                const texto = await file.text();
                let data;
                try { data = JSON.parse(texto); }
                catch { throw new Error('El archivo no es JSON válido'); }

                const mensajes = Array.isArray(data)
                    ? data
                    : (data.mensajes || data.historial || data.messages || data.conversacion || []);

                if (!Array.isArray(mensajes) || mensajes.length === 0) {
                    console.warn('[importar] No hay mensajes para indexar en RAG');
                    return;
                }
                await _indexarEnRAG(mensajes);
            } catch (err) {
                console.error('[importar] Error indexando RAG:', err);
                agregarMensaje('assistant', `⚠️ No se pudo actualizar el RAG: ${err.message}`);
            } finally {
                input.value = '';
            }
        };
        input.addEventListener('change', onImport);
        input.click();
        agregarMensaje('assistant', '📥 Seleccioná el archivo JSON. Se indexará automáticamente en el RAG.');
        return true;
    }

    if (comando === '/yo') {
        const hechos = typeof window.obtenerHechosComoTexto === 'function'
            ? window.obtenerHechosComoTexto()
            : 'No tengo recuerdos.';
        agregarMensaje('assistant', `🧠 **Lo que recuerdo de vos:**\n${hechos}`);
        return true;
    }

    if (comando === '/version') {
        agregarMensaje('assistant',
            `🧉 **LILA v${window.LILA_VERSION || '1.0.0'}**\n` +
            `📍 Ubicación: ${window.ubicacionInfo || 'desconocida'}\n` +
            `⚙️ Modelo: ${window.modeloActual || 'default'}\n` +
            `📚 Memoria: ${Object.keys(window.memoriaUsuario || {}).length} hechos.`);
        return true;
    }

    if (comando === '/archivos') {
        const archivos = window.archivosSubidos || [];
        if (archivos.length === 0) {
            agregarMensaje('assistant', '📭 No hay archivos.');
        } else {
            const lista = archivos.map(a => `- ${a.nombre || a.name}`).join('\n');
            agregarMensaje('assistant', `📎 **Archivos subidos:**\n${lista}`);
        }
        return true;
    }

    // ===== BÚSQUEDA WEB =====
    if (comando === '/buscar') {
        if (!resto) {
            agregarMensaje('assistant', '⚠️ Escribí algo para buscar: /buscar <texto>');
            return true;
        }
        agregarMensaje('user', `🔍 Buscando: ${resto}`);
        _mostrarTyping(true);
        try {
            const data = await _fetchJSON(`${_apiBase()}/api/search/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: resto })
            }, 20000);
            const results = data?.results || [];
            if (results.length > 0) {
                const lista = results.map((r, i) => `${i + 1}. ${r.title}: ${r.link}`).join('\n');
                agregarMensaje('assistant', `🔍 **Resultados para "${resto}":**\n${lista}`);
            } else {
                agregarMensaje('assistant', `🔍 No se encontraron resultados para "${resto}".`);
            }
        } catch (error) {
            agregarMensaje('assistant', `❌ Error al buscar: ${_errorAmigable(error, 'la búsqueda')}`);
        } finally {
            _mostrarTyping(false);
        }
        return true;
    }

    // ===== NOTICIAS =====
    if (comando === '/noticias') {
        const tema = resto.trim();
        agregarMensaje('user', tema ? `📰 Buscando noticias sobre: ${tema}` : '📰 Buscando noticias recientes');
        _mostrarTyping(true);
        try {
            const url = tema
                ? `${_apiBase()}/api/noticias/buscar?q=${encodeURIComponent(tema)}`
                : `${_apiBase()}/api/noticias/ultimas`;
            const data = await _fetchJSON(url, { method: 'GET' }, 20000);

            const noticias = Array.isArray(data)
                ? data
                : (data?.noticias || data?.articles || data?.results || []);

            if (!Array.isArray(noticias) || noticias.length === 0) {
                agregarMensaje('assistant', `📭 No se encontraron noticias${tema ? ` sobre "${tema}"` : ''}.`);
                return true;
            }

            const top = noticias.slice(0, 5);
            let msg = `📰 **Noticias${tema ? ` sobre "${tema}"` : ' recientes'}:**\n\n`;
            top.forEach((n, i) => {
                const titulo = n.titulo || n.title || 'Sin título';
                const fuente = n.fuente || n.source || n.autor || '';
                const fecha = n.fecha || n.publishedAt || n.date || '';
                const link = n.url || n.link || '';
                msg += `**${i + 1}. ${titulo}**\n`;
                if (fuente || fecha) {
                    msg += `   `;
                    if (fuente) msg += `📍 ${fuente}`;
                    if (fuente && fecha) msg += ' — ';
                    if (fecha) msg += `${fecha}`;
                    msg += '\n';
                }
                if (link) msg += `   🔗 ${link}\n`;
                msg += '\n';
            });
            agregarMensaje('assistant', msg);
            _hablarSiActivo(`Encontré ${top.length} noticias${tema ? ' sobre ' + tema : ''}.`);
        } catch (e) {
            agregarMensaje('assistant', `❌ Error buscando noticias: ${_errorAmigable(e, 'la búsqueda de noticias')}`);
        } finally {
            _mostrarTyping(false);
        }
        return true;
    }

    // ===== WIKIPEDIA Y WIKIDATA =====
    if (comando === '/wikipedia') {
        if (resto) {
            if (typeof window.buscarWikipedia === 'function') await window.buscarWikipedia(resto);
            else agregarMensaje('assistant', '⚠️ Búsqueda en Wikipedia no disponible.');
        } else {
            agregarMensaje('assistant', '📚 Usá: /wikipedia <término>');
        }
        return true;
    }

    if (comando === '/wikidata') {
        if (resto) {
            if (typeof window.buscarWikidata === 'function') await window.buscarWikidata(resto);
            else agregarMensaje('assistant', '⚠️ Búsqueda en Wikidata no disponible.');
        } else {
            agregarMensaje('assistant', '📚 Usá: /wikidata <término>');
        }
        return true;
    }

    // ===== MEMORIA (usuario) =====
    if (comando === '/recordar') {
        const separador = resto.indexOf(':');
        if (separador === -1) {
            agregarMensaje('assistant', '⚠️ Formato: /recordar <clave>: <valor>');
            return true;
        }
        const clave = resto.substring(0, separador).trim();
        const valor = resto.substring(separador + 1).trim();
        if (!clave || !valor) {
            agregarMensaje('assistant', '⚠️ Formato: /recordar <clave>: <valor>');
            return true;
        }
        if (typeof window.guardarMemoriaBackend === 'function') await window.guardarMemoriaBackend(clave, valor);
        agregarMensaje('assistant', `🧠 Recordé: **${clave}** = ${valor}`);
        return true;
    }

    if (comando === '/olvidar') {
        if (resto.toLowerCase() === 'todo') {
            _mostrarTyping(true);
            try {
                const data = await _fetchJSON(
                    `${_apiBase()}/api/memory/${window.USER_ID}`,
                    { method: 'DELETE' }, 10000);
                window.memoriaUsuario = {};
                if (typeof window.cargarMemoria === 'function') await window.cargarMemoria();
                agregarMensaje('assistant', `🗑️ Memoria completa borrada (${data?.deleted || 'varias'} claves).`);
            } catch (e) {
                agregarMensaje('assistant', `❌ No se pudo borrar toda la memoria: ${_errorAmigable(e, 'olvidar todo')}`);
            } finally {
                _mostrarTyping(false);
            }
        } else if (resto) {
            _mostrarTyping(true);
            try {
                const resp = await fetch(
                    `${_apiBase()}/api/memory/${window.USER_ID}/${encodeURIComponent(resto)}`,
                    { method: 'DELETE' });
                if (!resp.ok && resp.status !== 404) throw new Error(`HTTP ${resp.status}`);
                if (resp.status === 404) {
                    agregarMensaje('assistant', `🗑️ La clave **${resto}** no estaba en el backend.`);
                } else {
                    agregarMensaje('assistant', `🗑️ Olvidé **${resto}** correctamente.`);
                }
                if (window.memoriaUsuario) delete window.memoriaUsuario[resto];
                if (typeof window.cargarMemoria === 'function') await window.cargarMemoria();
            } catch (e) {
                agregarMensaje('assistant', `❌ Error al olvidar: ${_errorAmigable(e, 'olvidar clave')}`);
            } finally {
                _mostrarTyping(false);
            }
        } else {
            agregarMensaje('assistant', '⚠️ Usá: /olvidar <clave> o /olvidar todo');
        }
        return true;
    }

    // ===== MEMORIA COMPARTIDA (multiagente) =====
    if (comando === '/memoria') {
        _mostrarTyping(true);
        try {
            const data = await _fetchJSON(`${_apiBase()}/api/multiagent/memoria`, { method: 'GET' }, 10000);
            if (!Array.isArray(data) || data.length === 0) {
                agregarMensaje('assistant', '📭 La memoria del multiagente está vacía.');
                return true;
            }
            const lista = data.slice(0, 20).map(m => `- **${m.clave}**: ${String(m.valor).substring(0, 100)}${String(m.valor).length > 100 ? '...' : ''}`).join('\n');
            agregarMensaje('assistant', `🧠 **Memoria compartida (${data.length} entradas):**\n${lista}`);
        } catch (e) {
            agregarMensaje('assistant', `❌ Error leyendo memoria: ${_errorAmigable(e, 'leer memoria')}`);
        } finally {
            _mostrarTyping(false);
        }
        return true;
    }

    // /historialma → Muestra las últimas tareas coordinadas con /coordinar.
    // Devuelve: tarea original + fecha de cada coordinación.
    if (comando === '/historialma') {
        _mostrarTyping(true);
        try {
            const data = await _fetchJSON(`${_apiBase()}/api/multiagent/historial`, { method: 'GET' }, 10000);

            if (!Array.isArray(data)) {
                agregarMensaje('assistant', '⚠️ El backend devolvió un formato inesperado.');
                return true;
            }

            if (data.length === 0) {
                agregarMensaje('assistant',
                    '📭 **No hay coordinaciones registradas todavía.**\n\n' +
                    'Usá `/coordinar <tarea>` para que el multiagente trabaje y registre entradas en el historial.');
                return true;
            }

            const lista = data.slice(0, 10).map((c, i) => {
                const tarea = String(c.tarea || '').substring(0, 70);
                const fecha = c.creado_en ? new Date(c.creado_en).toLocaleString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }) : '';
                return `${i + 1}. ${tarea}${fecha ? '\n   📅 ' + fecha : ''}`;
            }).join('\n\n');

            agregarMensaje('assistant',
                `📜 **Historial del multiagente (últimas ${Math.min(10, data.length)} de ${data.length}):**\n\n` +
                `${lista}\n\n` +
                `_Cada entrada es una tarea que se procesó con /coordinar._`);
        } catch (e) {
            agregarMensaje('assistant', `❌ Error leyendo historial: ${_errorAmigable(e, 'leer el historial del multiagente')}`);
        } finally {
            _mostrarTyping(false);
        }
        return true;
    }

    if (comando === '/tools') {
        _mostrarTyping(true);
        try {
            const data = await _fetchJSON(`${_apiBase()}/api/multiagent/tools`, { method: 'GET' }, 10000);
            if (!Array.isArray(data) || data.length === 0) {
                agregarMensaje('assistant', '📭 No hay herramientas registradas.');
                return true;
            }
            const lista = data.map(t => `- **${t.name}**: ${t.description}`).join('\n');
            agregarMensaje('assistant', `🔧 **Herramientas disponibles (${data.length}):**\n${lista}`);
        } catch (e) {
            agregarMensaje('assistant', `❌ Error listando herramientas: ${_errorAmigable(e, 'listar herramientas')}`);
        } finally {
            _mostrarTyping(false);
        }
        return true;
    }

    // ===== MULTIAGENTE =====
    if (comando === '/multiagente') {
        if (typeof window.toggleMultiagente === 'function') {
            await window.toggleMultiagente();
        } else {
            agregarMensaje('assistant', '⚠️ Función de multiagente no disponible.');
        }
        return true;
    }

    if (comando === '/coordinar') {
        if (resto) {
            if (typeof window.coordinarAgentes === 'function') await window.coordinarAgentes(resto);
            else agregarMensaje('assistant', '⚠️ Coordinación de agentes no disponible.');
        } else {
            agregarMensaje('assistant', '⚠️ Usá: /coordinar <tarea>');
        }
        return true;
    }

    if (comando === '/agentes') {
        if (typeof window.listarAgentes === 'function') {
            await window.listarAgentes();
        } else {
            agregarMensaje('assistant', '⚠️ Función no disponible.');
        }
        return true;
    }

    if (comando === '/ejecutar') {
        const partesEjecutar = resto.split(' ');
        const nombre = partesEjecutar[0];
        const tarea = partesEjecutar.slice(1).join(' ') || 'default';

        if (!nombre) {
            agregarMensaje('assistant', '⚠️ Usá: /ejecutar <nombre_agente> <tarea>');
            return true;
        }

        _mostrarTyping(true);
        try {
            const data = await _fetchJSON(
                `${_apiBase()}/api/agentes/${encodeURIComponent(nombre)}/ejecutar`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tarea })
                }, 60000);
            if (data.error) {
                agregarMensaje('assistant', `❌ Error: ${data.error}`);
            } else {
                agregarMensaje('assistant',
                    `🧠 **${data.agente || nombre}** (${data.modelo || 'n/a'}):\n${data.respuesta || 'Sin respuesta'}`);
                _hablarSiActivo(data.respuesta || '');
            }
        } catch (e) {
            agregarMensaje('assistant', `❌ Error ejecutando agente: ${_errorAmigable(e, 'ejecutar agente')}`);
        } finally {
            _mostrarTyping(false);
        }
        return true;
    }

    // ===== MCP (Model Context Protocol) =====
    if (comando === '/mcp') {
        const sub = resto.toLowerCase().trim();

        if (sub === '' || sub === 'status') {
            _mostrarTyping(true);
            try {
                const data = await _fetchJSON(`${_apiBase()}/api/mcp/status`, { method: 'GET' }, 10000);
                let msg = `🔌 **Estado MCP**\n`;
                msg += `- Activo: ${data.activo ? 'Sí' : 'No (pulsá el botón MCP)'}\n`;
                msg += `- Inicializado: ${data.inicializado ? 'Sí' : 'No'}\n`;
                msg += `- Servidores conectados: ${data.servidores_conectados}\n`;
                msg += `- Tools totales: ${data.total_tools}\n\n`;
                if (data.servidores && data.servidores.length > 0) {
                    for (const s of data.servidores) {
                        msg += `**${s.nombre}** (${s.tools} tools):\n`;
                        for (const t of s.herramientas) msg += `   - ${t}\n`;
                        msg += '\n';
                    }
                }
                agregarMensaje('assistant', msg);
            } catch (e) {
                agregarMensaje('assistant', `❌ Error consultando MCP: ${_errorAmigable(e, 'consultar MCP')}`);
            } finally {
                _mostrarTyping(false);
            }
            return true;
        }

        if (sub === 'tools') {
            _mostrarTyping(true);
            try {
                const data = await _fetchJSON(`${_apiBase()}/api/mcp/tools`, { method: 'GET' }, 10000);
                if (!Array.isArray(data) || data.length === 0) {
                    agregarMensaje('assistant', '📭 No hay tools MCP disponibles.');
                    return true;
                }
                const lista = data.map(t => `- **${t.qualifiedName}**: ${t.description || '(sin descripción)'}`).join('\n');
                agregarMensaje('assistant', `🔧 **Tools MCP (${data.length}):**\n${lista}`);
            } catch (e) {
                agregarMensaje('assistant', `❌ Error: ${_errorAmigable(e, 'listar tools MCP')}`);
            } finally {
                _mostrarTyping(false);
            }
            return true;
        }

        if (sub.startsWith('call ')) {
            const args = resto.substring(5).trim();
            const primerEspacio = args.indexOf(' ');
            const tool = primerEspacio === -1 ? args : args.substring(0, primerEspacio);
            const argsJson = primerEspacio === -1 ? '' : args.substring(primerEspacio + 1).trim();

            if (!tool) {
                agregarMensaje('assistant', '⚠️ Usá: /mcp call <tool> [json_args]');
                return true;
            }

            let jsonArgs = {};
            if (argsJson) {
                try { jsonArgs = JSON.parse(argsJson); }
                catch {
                    agregarMensaje('assistant', '⚠️ Los args deben ser JSON válido. Ej: {"ciudad":"Buenos Aires"}');
                    return true;
                }
            }

            _mostrarTyping(true);
            try {
                const data = await _fetchJSON(`${_apiBase()}/api/mcp/call`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tool, args: jsonArgs })
                }, 30000);
                agregarMensaje('assistant', `🔧 **${tool}**:\n${data.resultado || '(sin resultado)'}`);
            } catch (e) {
                agregarMensaje('assistant', `❌ Error: ${_errorAmigable(e, 'invocar tool MCP')}`);
            } finally {
                _mostrarTyping(false);
            }
            return true;
        }

        agregarMensaje('assistant',
            '📖 **Comandos MCP:**\n' +
            '- `/mcp status` — estado de servidores MCP\n' +
            '- `/mcp tools` — lista todas las tools MCP disponibles\n' +
            '- `/mcp call <tool> <json>` — invoca una tool\n' +
            '  Ej: `/mcp call mi-servidor.buscar_producto {"nombre":"harina"}`'
        );
        return true;
    }

    // ===== PYTHON =====
    if (comando === '/python') {
        if (!resto) {
            agregarMensaje('assistant', '⚠️ Escribí código después de /python');
            return true;
        }
        agregarMensaje('user', `🐍 Ejecutando código:\n${resto}`);
        _mostrarTyping(true);
        try {
            const data = await _fetchJSON(`${_apiBase()}/api/python/ejecutar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo: resto })
            }, 30000);
            const salida = (data.stdout || '') + (data.stderr ? '\n[stderr]\n' + data.stderr : '');
            agregarMensaje('assistant', `📤 **Salida:**\n${salida || 'Sin salida'}`);
        } catch (error) {
            agregarMensaje('assistant', `❌ Error ejecutando código: ${_errorAmigable(error, 'ejecutar Python')}`);
        } finally {
            _mostrarTyping(false);
        }
        return true;
    }

    // ===== WEBSOCKET =====
    if (comando === '/dialogo') {
        if (typeof window.toggleDialogo === 'function') window.toggleDialogo();
        else agregarMensaje('assistant', '⚠️ Función de diálogo no disponible.');
        return true;
    }

    if (comando === '/conectar') {
        if (typeof window.ws !== 'undefined' && window.ws && window.ws.readyState === WebSocket.OPEN) {
            agregarMensaje('assistant', '✅ WebSocket ya está conectado.');
        } else {
            if (typeof window.conectarWS === 'function') window.conectarWS();
            agregarMensaje('assistant', '🔄 Intentando reconectar WebSocket...');
        }
        return true;
    }

    if (comando === '/enviar') {
        if (!resto) {
            agregarMensaje('assistant', '⚠️ Escribí un mensaje después de /enviar.');
            return true;
        }
        if (typeof window.enviarMensajeWS === 'function') window.enviarMensajeWS('mensaje', resto);
        agregarMensaje('assistant', `📤 Mensaje enviado a otras instancias: "${resto}"`);
        return true;
    }

    // No es un comando reconocido
    return false;
}

// ============================================================
// INDEXAR MENSAJES EN EL RAG (para /importar)
// ============================================================
async function _indexarEnRAG(mensajes) {
    const total = mensajes.length;
    if (total === 0) return;

    _mostrarTyping(true);
    window.agregarMensaje('assistant', `📚 Indexando ${total} mensajes en el RAG...`);

    let ok = 0, err = 0;
    for (const m of mensajes) {
        const contenido = String(
            m?.content || m?.contenido || m?.texto || m?.message || ''
        ).trim();
        if (!contenido) continue;

        try {
            const resp = await fetch(`${_apiBase()}/api/rag/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: contenido,
                    metadata: {
                        role: m.role || m.rol || 'user',
                        source: 'import',
                        timestamp: m.timestamp || m.fecha || new Date().toISOString()
                    }
                })
            });
            if (resp.ok) ok++;
            else err++;
        } catch {
            err++;
        }
    }

    try {
        const r = await fetch(`${_apiBase()}/api/rag/stats`);
        if (r.ok) {
            const stats = await r.json();
            const nuevoTotal = stats.total || stats.count || stats.documentos || ok;
            if (typeof window.actualizarRagStatus === 'function') {
                window.actualizarRagStatus(nuevoTotal);
            }
        }
    } catch {}

    _mostrarTyping(false);
    window.agregarMensaje('assistant',
        `✅ RAG actualizado: **${ok}** fragmentos indexados${err ? ` (${err} errores)` : ''}.`);
}

// ============================================================
// WIKIPEDIA Y WIKIDATA
// ============================================================
async function buscarWikipedia(termino) {
    try {
        window.agregarMensaje('user', `📚 Buscando en Wikipedia: ${termino}`);
        const data = await _fetchJSON(
            `${_apiBase()}/api/wikipedia/articulo?q=${encodeURIComponent(termino)}`,
            { method: 'GET' }, 15000);
        if (!data.success || !data.titulo) {
            window.agregarMensaje('assistant',
                `❌ ${data.mensaje || data.error || `No se encontró información para "${termino}"`}`);
            return;
        }
        const extracto = data.extracto
            ? (data.extracto.length > 1500 ? data.extracto.substring(0, 1500) + '...' : data.extracto)
            : '*No hay resumen disponible.*';
        const url = data.url || `https://es.wikipedia.org/wiki/${encodeURIComponent(data.titulo.replace(/ /g, '_'))}`;
        window.agregarMensaje('assistant', `📖 **${data.titulo}**\n\n${extracto}\n\n🔗 ${url}`);
        _hablarSiActivo(extracto.substring(0, 300));
    } catch (e) {
        window.agregarMensaje('assistant', `❌ Error al buscar en Wikipedia: ${_errorAmigable(e, 'buscar en Wikipedia')}`);
    }
}

async function buscarWikidata(termino) {
    try {
        window.agregarMensaje('user', `📚 Buscando en Wikidata: ${termino}`);
        const data = await _fetchJSON(
            `${_apiBase()}/api/wikipedia/wikidata?q=${encodeURIComponent(termino)}`,
            { method: 'GET' }, 15000);
        if (!data.success || !data.entidad_id) {
            window.agregarMensaje('assistant',
                `❌ ${data.mensaje || data.error || `No se encontró la entidad "${termino}"`}`);
            return;
        }
        const desc = data.descripcion || '*No hay descripción disponible.*';
        const url = data.url || `https://www.wikidata.org/wiki/${data.entidad_id}`;
        window.agregarMensaje('assistant',
            `📖 **${data.titulo || termino}** (ID: ${data.entidad_id})\n\n${desc}\n\n🔗 ${url}`);
    } catch (e) {
        window.agregarMensaje('assistant', `❌ Error al buscar en Wikidata: ${_errorAmigable(e, 'buscar en Wikidata')}`);
    }
}

// ============================================================
// EXPOSICIÓN GLOBAL
// ============================================================
window.procesarComando = procesarComando;
window.buscarWikipedia = buscarWikipedia;
window.buscarWikidata  = buscarWikidata;