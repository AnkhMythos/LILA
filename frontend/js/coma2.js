// frontend/js/commands.js

async function procesarComando(texto) {
    const cmd = texto.trim().toLowerCase();

    if (cmd === '/ayuda' || cmd === '/help') {
        agregarMensaje('assistant',
            `📋 **Comandos disponibles**\n` +
            `- /historial : últimos mensajes\n` +
            `- /borrar : reinicia conversación\n` +
            `- /modelo <nombre> : cambia el modelo\n` +
            `- /temperatura <0-1> : ajusta creatividad\n` +
            `- /archivos : muestra archivos subidos\n` +
            `- /exportar : guarda conversación en JSON\n` +
            `- /importar : importa conversación desde JSON\n` +
            `- /yo : muestra lo que recuerdo de vos\n` +
            `- /version : muestra versión y ubicación\n` +
            `- /dialogo : activa/desactiva diálogo automático\n` +
            `- /conectar : reconecta WebSocket\n` +
            `- /enviar <mensaje> : envía mensaje a otra instancia\n` +
            `- /buscar <texto> : busca en internet sin API key\n` +
            `- /recordar <clave>: <valor> : guarda en memoria\n` +
            `- /python <codigo> : ejecuta código Python en backend\n` +
            `- /voz on|off|número : activa/desactiva o elige voz\n` +
            `- /voces : lista las voces disponibles\n` +
            `- /olvidar <clave> : elimina de memoria\n` +
            `- /olvidar todo : borra toda la memoria\n` +
            `- /hf <texto> : genera texto con Hugging Face\n` +
            `- /mr <texto> : genera texto con Spanish GPT-2\n` +
            `- /phaseone on|off|status|pensar|recordar|recall|coordinar <tarea>\n` +
            `- /info phaseone : muestra estado de PHASEONE\n` +
            `- /coordinar <tarea> : coordina múltiples agentes\n` +
            `- /agentes : lista agentes disponibles\n` +
            `- /openworker <tarea>|historial|limpiar : agente autónomo multi-paso\n` +
            `- /wikipedia <término> : busca en Wikipedia\n` +
            `- /wikidata <término> : busca en Wikidata\n` +
            `- /ejecutar <agente> <tarea> : ejecuta un agente específico`
        );
        return true;
    }

    // ===== Comandos de voz y escucha =====
    if (cmd === '/escuchar') {
        if (typeof toggleEscucha === 'function') toggleEscucha();
        else agregarMensaje('assistant', '⚠️ Función de escucha no disponible.');
        return true;
    }

    if (cmd === '/parescuchar') {
        if (typeof detenerReconocimiento === 'function') detenerReconocimiento();
        agregarMensaje('assistant', '🎙️ Dejé de escuchar.');
        return true;
    }

    if (cmd === '/voces') {
        if (typeof listarVoces === 'function') listarVoces();
        else agregarMensaje('assistant', '⚠️ Función de voces no disponible.');
        return true;
    }

    // ===== Historial y estado =====
    if (cmd === '/historial') {
        const total = historialConversacion.length;
        if (total === 0) {
            agregarMensaje('assistant', '📭 No hay mensajes.');
        } else {
            const resumen = historialConversacion
                .filter(m => m.role !== 'system')
                .slice(-10)
                .map((m, i) =>
                    `${i + 1}. ${m.role === 'user' ? '👤' : '🧉'} ` +
                    `${m.content.substring(0, 55)}` +
                    `${m.content.length > 55 ? '...' : ''}`
                )
                .join('\n');
            agregarMensaje('assistant',
                `📜 **Últimos ${Math.min(10, total)} mensajes:**\n${resumen}`
            );
        }
        return true;
    }

    if (cmd === '/borrar') {
        historialConversacion = [];
        const container = document.getElementById('messageContainer');
        if (container) container.innerHTML = '';
        if (typeof guardarHistorialLocal === 'function') guardarHistorialLocal();
        agregarMensaje('assistant', '🧉 Historial borrado.');
        return true;
    }

    if (cmd.startsWith('/modelo ')) {
        const nuevo = cmd.substring(8).trim();
        if (nuevo.length > 0) {
            modeloActual = nuevo;
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) modelSelect.value = nuevo;
            if (typeof actualizarBadgeModelo === 'function') actualizarBadgeModelo(nuevo);
            agregarMensaje('assistant', `✅ Modelo cambiado a **${nuevo}**.`);
            if (typeof guardarHistorialLocal === 'function') guardarHistorialLocal();
        } else {
            agregarMensaje('assistant', '⚠️ Usá: /modelo <nombre>');
        }
        return true;
    }

    if (cmd.startsWith('/temperatura ')) {
        const val = parseFloat(cmd.substring(13).trim());
        if (!isNaN(val) && val >= 0 && val <= 1) {
            temperatura = val;
            agregarMensaje('assistant', `🌡️ Temperatura ajustada a **${temperatura}**.`);
            if (typeof guardarHistorialLocal === 'function') guardarHistorialLocal();
        } else {
            agregarMensaje('assistant', '⚠️ Usá: /temperatura <0-1>');
        }
        return true;
    }

    if (cmd === '/archivos') {
        if (archivosSubidos.length === 0) {
            agregarMensaje('assistant', '📭 No hay archivos.');
        } else {
            const lista = archivosSubidos
                .map(a => `- ${a.nombre}`)
                .join('\n');
            agregarMensaje('assistant', `📎 **Archivos subidos:**\n${lista}`);
        }
        return true;
    }

    if (cmd === '/exportar') {
        if (typeof exportarConversacion === 'function') exportarConversacion();
        else agregarMensaje('assistant', '⚠️ Función de exportación no disponible.');
        return true;
    }

    if (cmd === '/yo') {
        const hechos = typeof obtenerHechosComoTexto === 'function' ? obtenerHechosComoTexto() : 'No tengo recuerdos.';
        agregarMensaje('assistant', `🧠 **Lo que recuerdo de vos:**\n${hechos}`);
        return true;
    }

    if (cmd === '/version') {
        agregarMensaje('assistant',
            `🧉 **LILA v${LILA_VERSION}**\n` +
            `📍 Ubicación: ${ubicacionInfo || 'desconocida'}\n` +
            `⚙️ Modelo: ${modeloActual}\n` +
            `📚 Memoria: ${Object.keys(memoriaUsuario || {}).length} hechos.`
        );
        return true;
    }

    // ===== Búsqueda web =====
    if (cmd.startsWith('/buscar ')) {
        const consulta = texto.substring(8).trim();
        if (!consulta) {
            agregarMensaje('assistant', '⚠️ Escribí algo para buscar: /buscar <texto>');
            return true;
        }
        agregarMensaje('user', `🔍 Buscando: ${consulta}`);
        try {
            const resp = await fetch(`${API_BASE}/api/search/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ query: consulta })
            });
            if (!resp.ok) throw new Error(`Error ${resp.status}`);
            const data = await resp.json();
            if (data.results && data.results.length > 0) {
                const lista = data.results
                    .map((r, i) => `${i + 1}. ${r.title}: ${r.link}`)
                    .join('\n');
                agregarMensaje('assistant', `🔍 **Resultados para "${consulta}":**\n${lista}`);
            } else {
                agregarMensaje('assistant', `🔍 No se encontraron resultados para "${consulta}".`);
            }
        } catch (error) {
            agregarMensaje('assistant', `❌ Error al buscar: ${error.message}`);
        }
        return true;
    }

    // ===== Diálogo y WebSocket =====
    if (cmd === '/dialogo') {
        if (typeof toggleDialogo === 'function') toggleDialogo();
        else agregarMensaje('assistant', '⚠️ Función de diálogo no disponible.');
        return true;
    }

    if (cmd === '/conectar') {
        if (typeof ws !== 'undefined' && ws && ws.readyState === WebSocket.OPEN) {
            agregarMensaje('assistant', '✅ WebSocket ya está conectado.');
        } else {
            if (typeof conectarWS === 'function') conectarWS();
            agregarMensaje('assistant', '🔄 Intentando reconectar WebSocket...');
        }
        return true;
    }

    // ===== NUEVO: Comandos de Agentes Integrados de forma Segura =====
    if (cmd === '/agentes') {
        try {
            const resp = await fetch(`${API_BASE}/api/models`);
            if (!resp.ok) throw new Error(`Status ${resp.status}`);
            const agentes = await resp.json();
            
            const listaAgentes = agentes.map(a => 
                `🤖 **${a.name || a.agentDisplayName || a.name}**\n` +
                `   • *Rol:* \`${a.role || 'general'}\`\n` +
                `   • *Modelo Local:* \`${a.assignedModel || a.name}\`\n` +
                `   • *Uso:* ${a.description || a.roleDescription || 'Asistente de trabajo.'}`
            ).join('\n\n');

            agregarMensaje('assistant', `💼 **Agentes de Trabajo Disponibles (WORK):**\n\n${listaAgentes}`);
        } catch (error) {
            agregarMensaje('assistant', `❌ No se pudieron listar los agentes locales: ${error.message}`);
        }
        return true;
    }

    if (cmd.startsWith('/ejecutar ')) {
        const partes = texto.substring(10).trim().split(' ');
        const aliasAgente = partes[0];
        const tarea = partes.slice(1).join(' ');

        if (!aliasAgente || !tarea) {
            agregarMensaje('assistant', '⚠️ Formato incorrecto. Usá: `/ejecutar <nombre_agente> <tarea a realizar>`');
            return true;
        }

        agregarMensaje('assistant', `🚀 Delegando tarea al agente **${aliasAgente}**...`);
        
        try {
            // Consultamos los agentes locales para mapear el alias con su modelo asignado
            const respModels = await fetch(`${API_BASE}/api/models`);
            const agentes = await respModels.json();
            
    const agenteEncontrado = agentes.find(a =>
        a.role === aliasAgente.toLowerCase() ||
        a.name.toLowerCase().includes(aliasAgente.toLowerCase())
    );

    if (!agenteEncontrado) {
        agregarMensaje('assistant', `❌ No encontré ningún agente local activo bajo el nombre o rol "${aliasAgente}".`);
        return true;
    }

    // Consumimos el endpoint del chat inyectándole la instrucción
    const respChat = await fetch(`${API_BASE}/api/models/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: agenteEncontrado.assignedModel || agenteEncontrado.name,
            messages: [{ role: 'user', content: tarea }]
        })
    });

    if (!respChat.ok) throw new Error('Error al invocar el agente.');

    const data = await respChat.json();

    // Si tenés una función nativa de streaming o chat directo, acá podés llamarla con data.payload.
    // Para mantener compatibilidad sin romper nada, mandamos un log del flujo preparado:
    agregarMensaje('assistant', `✅ El backend procesó el rol del agente con el modelo **${data.targetModel}** con éxito.`);
} catch (error) {
    agregarMensaje('assistant', `❌ Error al ejecutar el agente de trabajo: ${error.message}`);
}

return true;

// Si no coincide con ningún comando, dejamos pasar la ejecución normal del chat
return false;