// frontend/js/listener.js

function iniciarReconocimiento() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Reconocimiento no soportado');
        return;
    }
    
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    window.reconocimiento = new SR();
    window.reconocimiento.lang = 'es-AR';
    window.reconocimiento.continuous = true;
    window.reconocimiento.interimResults = true;

    window.reconocimiento.onresult = (e) => {
        let transcript = '';
        let esFinal = false;
        
        for (let i = e.resultIndex; i < e.results.length; i++) {
            transcript += e.results[i][0].transcript;
            if (e.results[i].isFinal) esFinal = true;
        }
        
        const input = document.getElementById('userInput');

        if (esFinal) {
            const comandos = ['enviar', 'enter', 'mandar', 'punto final'];
            let comandoDetectado = false;
            
            for (const comando of comandos) {
                if (transcript.trim().toLowerCase().endsWith(comando)) {
                    comandoDetectado = true;
                    const indice = transcript.toLowerCase().lastIndexOf(comando);
                    transcript = transcript.substring(0, indice).trim();
                    break;
                }
            }

            if (input) input.value = transcript;

            // === BLOQUE CORREGIDO: envío real al chat ===
            if (comandoDetectado) {
                detenerReconocimiento();

                // 1) Método preferido: simular clic en "Enviar"
                //    Esto dispara exactamente el mismo handler que el usuario.
                const sendBtn = document.getElementById('sendBtn');
                if (sendBtn) {
                    sendBtn.click();
                }
                // 2) Fallback: llamar a enviarMensaje con un evento válido
                //    (por si el botón no existe o no tiene handler directo)
                else if (typeof window.enviarMensaje === 'function') {
                    try {
                        const evt = new Event('submit', { cancelable: true, bubbles: true });
                        window.enviarMensaje(evt);
                    } catch (err) {
                        console.error('No se pudo enviar el mensaje por voz:', err);
                    }
                } else {
                    console.warn('No hay forma de enviar el mensaje: falta #sendBtn y window.enviarMensaje');
                }
            }
            // =============================================
            
        } else {
            if (input) input.value = transcript.trim();
        }
    };

    window.reconocimiento.onerror = (err) => console.error('Error reconocimiento:', err.error);
    window.reconocimiento.start();
    window.escuchando = true;

    document.getElementById('btnEscuchar')?.replaceChildren('🎙️ Escuchar: ON');
    document.getElementById('btnEscuchar')?.classList.add('activo');
    
    const footerBtn = document.getElementById('footerEscuchar');
    footerBtn?.classList.replace('offline', 'online');
}

function detenerReconocimiento() {
    window.reconocimiento?.stop();
    window.reconocimiento = null;
    window.escuchando = false;

    document.getElementById('btnEscuchar')?.replaceChildren('🎙️ Escuchar: OFF');
    document.getElementById('btnEscuchar')?.classList.remove('activo');
    
    const footerBtn = document.getElementById('footerEscuchar');
    footerBtn?.classList.replace('online', 'offline');
}

function toggleEscucha() {
    window.escuchando ? detenerReconocimiento() : iniciarReconocimiento();
}

window.toggleEscucha = toggleEscucha;
window.detenerReconocimiento = detenerReconocimiento;
window.iniciarReconocimiento = iniciarReconocimiento;

window.actualizarFooterEscuchar = function(estado) {
    const footerBtn = document.getElementById('footerEscuchar');
    if (!footerBtn) return;
    estado ? footerBtn.classList.replace('offline', 'online') 
           : footerBtn.classList.replace('online', 'offline');
};