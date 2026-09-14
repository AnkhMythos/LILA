// frontend/js/speech.js

// ============================================================
// USAR VARIABLES GLOBALES DE CONFIG.JS
// ============================================================
// vozActivada, vozSeleccionada, velocidadVoz, tonoVoz, volumenVoz
// ya están definidas en config.js, NO redeclarar.
// También se espera que exista vocesDisponibles (array) y speechSynthesis.

function cargarVoces() {
    if (!('speechSynthesis' in window)) return;

    vocesDisponibles = speechSynthesis.getVoices();

    if (vocesDisponibles.length === 0) {
        speechSynthesis.onvoiceschanged = () => {
            vocesDisponibles = speechSynthesis.getVoices();
            aplicarVozGuardada();
        };
    } else {
        aplicarVozGuardada();
    }
}

function aplicarVozGuardada() {
    const vozGuardada = localStorage.getItem('lila_voz');

    if (vozGuardada) {
        vozSeleccionada = vocesDisponibles.find(
            v => v.name === vozGuardada
        ) || null;
    }

    if (!vozSeleccionada) {
        vozSeleccionada = vocesDisponibles.find(
            v => v.lang && v.lang.startsWith('es')
        ) || vocesDisponibles[0] || null;
    }

    actualizarBotonVoz();
}

function actualizarBotonVoz() {
    const btnVoz = document.getElementById('btnVoz');
    if (!btnVoz) return;
    btnVoz.textContent = vozActivada ? '🔊 Voz: ON' : '🔊 Voz: OFF';
    btnVoz.classList.toggle('activo', vozActivada);
}

function limpiarTextoParaVoz(texto) {
    if (!texto) return '';

    let limpio = texto;
    limpio = limpio.replace(/\p{Emoji}/gu, '');
    limpio = limpio.replace(/\*\*(.*?)\*\*/g, '$1');
    limpio = limpio.replace(/\*(.*?)\*/g, '$1');
    limpio = limpio.replace(/__(.*?)__/g, '$1');
    limpio = limpio.replace(/_(.*?)_/g, '$1');
    limpio = limpio.replace(/^[\s#\-*]+/gm, '');
    limpio = limpio.replace(/\s+/g, ' ').trim();

    return limpio;
}

function hablar(texto) {
    if (!('speechSynthesis' in window)) {
        console.warn('SpeechSynthesis no soportado');
        return;
    }

    const textoLimpio = limpiarTextoParaVoz(texto);
    if (!textoLimpio) {
        console.warn('Texto vacío después de limpiar, no se habla.');
        return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textoLimpio);
    utterance.lang = vozSeleccionada ? vozSeleccionada.lang : 'es-AR';
    utterance.rate = velocidadVoz;
    utterance.pitch = tonoVoz;
    utterance.volume = volumenVoz;

    if (vozSeleccionada) {
        utterance.voice = vozSeleccionada;
    }

    speechSynthesis.speak(utterance);
}

function toggleVoz() {
    vozActivada = !vozActivada;

    // Botón principal
    const btnVoz = document.getElementById('btnVoz');
    if (btnVoz) {
        btnVoz.textContent = vozActivada ? '🔊 Voz: ON' : '🔊 Voz: OFF';
        btnVoz.classList.toggle('activo', vozActivada);
    }

    // Botón del footer (NUEVO)
    const footerBtn = document.getElementById('footerVoz');
    if (footerBtn) {
        if (vozActivada) {
            footerBtn.classList.remove('offline');
            footerBtn.classList.add('online');
        } else {
            footerBtn.classList.remove('online');
            footerBtn.classList.add('offline');
        }
    }

    if (!vozActivada) {
        speechSynthesis.cancel();
    }

    if (typeof agregarMensaje === 'function') {
        agregarMensaje(
            'assistant',
            vozActivada ? '🔊 Voz activada.' : '🔇 Voz desactivada.'
        );
    }
}

function listarVoces() {
    if (!vocesDisponibles || !vocesDisponibles.length) {
        cargarVoces();
        // Esperar un poco para que se carguen (puede ser asíncrono)
        setTimeout(() => {
            if (!vocesDisponibles || !vocesDisponibles.length) {
                if (typeof agregarMensaje === 'function') {
                    agregarMensaje('assistant', 'No se pudieron cargar las voces.');
                }
                return;
            }
            mostrarListaVoces();
        }, 300);
        return;
    }
    mostrarListaVoces();
}

function mostrarListaVoces() {
    const lista = vocesDisponibles
        .map((v, i) => `${i + 1}. ${v.name} (${v.lang})`)
        .join('\n');

    if (typeof agregarMensaje === 'function') {
        agregarMensaje(
            'assistant',
            `🗣️ **Voces disponibles:**\n${lista}\n\nUsá /voz <número> para elegir una.`
        );
    }
}

function seleccionarVoz(numero) {
    const indice = parseInt(numero, 10) - 1;

    if (
        isNaN(indice) ||
        indice < 0 ||
        !vocesDisponibles ||
        indice >= vocesDisponibles.length
    ) {
        if (typeof agregarMensaje === 'function') {
            agregarMensaje('assistant', '❌ Número de voz inválido.');
        }
        return;
    }

    vozSeleccionada = vocesDisponibles[indice];
    localStorage.setItem('lila_voz', vozSeleccionada.name);

    if (typeof agregarMensaje === 'function') {
        agregarMensaje(
            'assistant',
            `✅ Voz cambiada a: **${vozSeleccionada.name}**`
        );
    }

    if (vozActivada) {
        hablar('Esta es mi nueva voz.');
    }
}

function cambiarVelocidad(valor) {
    velocidadVoz = Math.min(2, Math.max(0.5, parseFloat(valor) || 1.3));
    localStorage.setItem('lila_velocidad', velocidadVoz);
    if (typeof agregarMensaje === 'function') {
        agregarMensaje('assistant', `⏱️ Velocidad ajustada a ${velocidadVoz}`);
    }
}

function cambiarTono(valor) {
    tonoVoz = Math.min(2, Math.max(0, parseFloat(valor) || 1.4));
    localStorage.setItem('lila_tono', tonoVoz);
    if (typeof agregarMensaje === 'function') {
        agregarMensaje('assistant', `🎵 Tono ajustado a ${tonoVoz}`);
    }
}

function cambiarVolumen(valor) {
    volumenVoz = Math.min(1, Math.max(0, parseFloat(valor) || 1));
    localStorage.setItem('lila_volumen', volumenVoz);
    if (typeof agregarMensaje === 'function') {
        agregarMensaje('assistant', `🔊 Volumen ajustado a ${volumenVoz}`);
    }
}

// ============================================================
// EXPONER FUNCIONES GLOBALES
// ============================================================
window.toggleVoz = toggleVoz;
window.listarVoces = listarVoces;
window.seleccionarVoz = seleccionarVoz;
window.cambiarVelocidad = cambiarVelocidad;
window.cambiarTono = cambiarTono;
window.cambiarVolumen = cambiarVolumen;
window.hablar = hablar;
window.cargarVoces = cargarVoces;