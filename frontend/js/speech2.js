// frontend/js/speech.js
let vozActivada = false;
let vocesDisponibles = [];
let vozSeleccionada = null;
let velocidadVoz = parseFloat(
    localStorage.getItem('lila_velocidad') || '1'
);
let tonoVoz = parseFloat(
    localStorage.getItem('lila_tono') || '1.4'
);
let volumenVoz = parseFloat(
    localStorage.getItem('lila_volumen') || '1'
);


function cargarVoces() {
    if ('speechSynthesis' in window) {
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
            v => v.lang.startsWith('es')
        ) || vocesDisponibles[0] || null;
    }
}


function hablar(texto) {
    if (!('speechSynthesis' in window)) {
        console.warn('SpeechSynthesis no soportado');
        return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
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

    if (btnVoz) {
        btnVoz.textContent = vozActivada ? '🔊 Voz: ON' : '🔊 Voz: OFF';
        btnVoz.classList.toggle('activo', vozActivada);
    }

    if (!vozActivada) {
        speechSynthesis.cancel();
    }

    agregarMensaje(
        'assistant',
        vozActivada ? '🔊 Voz activada.' : '🔇 Voz desactivada.'
    );
}


function listarVoces() {
    if (!vocesDisponibles.length) {
        cargarVoces();
    }

    if (!vocesDisponibles.length) {
        agregarMensaje('assistant', '⚠️ No se pudieron cargar las voces.');
        return;
    }

    const lista = vocesDisponibles
        .map((v, i) => `${i + 1}. ${v.name} (${v.lang})`)
        .join('\n');

    agregarMensaje(
        'assistant',
        `🔊 **Voces disponibles:**\n${lista}\n\n` +
        `Usá /voz <número> para elegir una.`
    );
}


function seleccionarVoz(numero) {
    const indice = parseInt(numero, 10) - 1;

    if (
        isNaN(indice) ||
        indice < 0 ||
        indice >= vocesDisponibles.length
    ) {
        agregarMensaje('assistant', '⚠️ Número de voz inválido.');
        return;
    }

    vozSeleccionada = vocesDisponibles[indice];
    localStorage.setItem('lila_voz', vozSeleccionada.name);

    agregarMensaje(
        'assistant',
        `✅ Voz cambiada a: ${vozSeleccionada.name}`
    );

    if (vozActivada) {
        hablar('Esta es mi nueva voz.');
    }
}


function cambiarVelocidad(valor) {
    velocidadVoz = Math.min(2, Math.max(0.5, parseFloat(valor) || 1));
    localStorage.setItem('lila_velocidad', velocidadVoz);
    agregarMensaje('assistant', `✅ Velocidad ajustada a ${velocidadVoz}`);
}


function cambiarTono(valor) {
    tonoVoz = Math.min(2, Math.max(0, parseFloat(valor) || 1.4));
    localStorage.setItem('lila_tono', tonoVoz);
    agregarMensaje('assistant', `✅ Tono ajustado a ${tonoVoz}`);
}


function cambiarVolumen(valor) {
    volumenVoz = Math.min(1, Math.max(0, parseFloat(valor) || 1));
    localStorage.setItem('lila_volumen', volumenVoz);
    agregarMensaje('assistant', `✅ Volumen ajustado a ${volumenVoz}`);
}