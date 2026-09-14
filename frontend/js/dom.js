// frontend/js/dom.js

// ============================================
// 1. REFERENCIAS AL DOM
// ============================================
const container = document.getElementById('messageContainer');

// ============================================
// 2. AGREGAR MENSAJE (A PRUEBA DE FALLOS)
// ============================================
function agregarMensaje(rol, contenido) {
    if (!container) {
        console.error('❌ No se encontró #messageContainer');
        return;
    }

    const div = document.createElement('div');
    const rolNormalizado = String(rol).toLowerCase();
    div.className = `message ${rolNormalizado}`;

    const textoOriginal = typeof contenido === 'string' ? contenido : '';
    let contenidoProcesado = textoOriginal;

    const esRespuestaIA = ['assistant', 'bot', 'ai', 'model'].includes(rolNormalizado);

    if (esRespuestaIA && textoOriginal) {
        try {
            contenidoProcesado = procesarBloquesDeCodigo(textoOriginal);
        } catch (e) {
            console.error('Error al procesar código:', e);
            contenidoProcesado = textoOriginal;
        }
    }

    div.innerHTML = contenidoProcesado || '...';

    // === NUEVO: linkificar URLs en nodos de texto ===
    try {
        linkificarNodosDeTexto(div);
    } catch (e) {
        console.warn('Error linkificando URLs:', e);
    }
    // =================================================

    // Crear botón de descarga SOLO si es respuesta de la IA y hay texto
    if (esRespuestaIA && textoOriginal) {
        const btnDescarga = document.createElement('button');
        btnDescarga.textContent = '📥 Descargar respuesta';
        btnDescarga.className = 'download-response-btn';
        Object.assign(btnDescarga.style, {
            marginTop: '12px',
            padding: '6px 14px',
            background: '#4a6a8a',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'block'
        });

        btnDescarga.onclick = () => {
            const blob = new Blob([textoOriginal], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `respuesta_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        div.appendChild(btnDescarga);
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ============================================
// 2b. LINKIFICAR URLs EN NODOS DE TEXTO
// ============================================
function linkificarNodosDeTexto(root) {
    // Regex que detecta http://, https:// y www.algo
    const URL_REGEX = /(https?:\/\/[^\s<>"'()]+|www\.[^\s<>"'()]+)/gi;

    // Recorremos solo nodos de texto que NO estén ya dentro de un <a>, <pre> o <code>
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (nodo) => {
            const valor = nodo.nodeValue || '';
            if (!URL_REGEX.test(valor)) {
                URL_REGEX.lastIndex = 0;
                return NodeFilter.FILTER_REJECT;
            }
            URL_REGEX.lastIndex = 0;

            // Excluir si ya está dentro de un <a> o dentro de código
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

            // Texto antes del link
            if (m.index > ultimo) {
                frag.appendChild(document.createTextNode(texto.substring(ultimo, m.index)));
            }

            // Crear el anchor manualmente (garantiza que sea clickeable)
            const a = document.createElement('a');
            a.href = url.startsWith('http') ? url : `https://${url}`;
            a.textContent = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            // Estilos inline como red de seguridad (por si el CSS no los estiliza)
            a.style.color = '#4a9eff';
            a.style.textDecoration = 'underline';
            a.style.cursor = 'pointer';
            a.style.wordBreak = 'break-all';

            frag.appendChild(a);
            ultimo = m.index + url.length;
        }

        // Texto restante
        if (ultimo < texto.length) {
            frag.appendChild(document.createTextNode(texto.substring(ultimo)));
        }

        if (nodo.parentNode) {
            nodo.parentNode.replaceChild(frag, nodo);
        }
    }
}

// ============================================
// 3. PROCESAR BLOQUES DE CÓDIGO
// ============================================
function procesarBloquesDeCodigo(texto) {
    if (!texto) return texto;
    const regex = /```(\w*)\s*\n?([\s\S]*?)\n?```/g;

    return texto.replace(regex, (match, lang, codigo) => {
        lang = (lang || 'text').toLowerCase();
        if (lang === 'javascrip') lang = 'javascript';
        if (lang === 'py') lang = 'python';
        if (lang === 'js') lang = 'javascript';

        const extension = obtenerExtension(lang);
        const nombreArchivo = `codigo.${extension}`;
        const dataUri = `data:text/plain;charset=utf-8,${encodeURIComponent(codigo.trim())}`;

        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-lang">${lang}</span>
                    <button class="download-code-btn" onclick="descargarArchivo(${JSON.stringify(dataUri)}, ${JSON.stringify(nombreArchivo)})">📥 Descargar .${extension}</button>
                </div>
                <pre><code>${escapeHtml(codigo.trim())}</code></pre>
            </div>
        `;
    });
}

// ============================================
// 4. UTILIDADES
// ============================================
function obtenerExtension(lenguaje) {
    const mapa = {
        'python': 'py', 'javascript': 'js', 'js': 'js',
        'html': 'html', 'css': 'css', 'json': 'json',
        'bash': 'sh', 'shell': 'sh', 'sql': 'sql',
        'yaml': 'yml', 'toml': 'toml', 'markdown': 'md',
        'md': 'md', 'text': 'txt'
    };
    return mapa[lenguaje] || 'txt';
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// ============================================
// 5. DESCARGA (GLOBAL)
// ============================================
function descargarArchivo(dataUri, nombreArchivo) {
    const enlace = document.createElement('a');
    enlace.href = dataUri;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
}

// ============================================
// 6. EXPOSICIÓN GLOBAL
// ============================================
window.descargarArchivo = descargarArchivo;
window.agregarMensaje = agregarMensaje;
window.linkificarNodosDeTexto = linkificarNodosDeTexto;