// frontend/js/main.js

// ============================================
// FUNCIONES DE UTILIDAD GLOBAL
// ============================================
window.insertCommand = function(command) {
    const input = document.getElementById('userInput');
    if (input) { 
        input.value = command; 
        input.focus(); 
    }
    document.getElementById('dropdownMenu')?.classList.remove('show');
};

window.toggleTheme = function() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('lila_theme', isDark ? 'dark' : 'light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
};

// ============================================
// INICIALIZACIÓN PRINCIPAL
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🧉 LILA inicializando...');

    // 1. SEGURIDAD
    if (typeof window.historialConversacion === 'undefined') window.historialConversacion = [];
    if (typeof window.indiceComando === 'undefined') window.indiceComando = -1;
    if (typeof window.archivosSubidos === 'undefined') window.archivosSubidos = [];
    if (typeof window.modeloActual === 'undefined' || !window.modeloActual) {
        window.modeloActual = 'llama3.2:3b';
    }

    // 2. TEMA
    const savedTheme = localStorage.getItem('lila_theme');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        if (savedTheme === 'dark') {
            document.body.classList.add('dark');
            themeToggle.textContent = '☀️';
        } else {
            document.body.classList.remove('dark');
            themeToggle.textContent = '🌙';
        }
    }

    // 3. BADGES
    const versionBadge = document.getElementById('versionBadge');
    if (versionBadge && typeof LILA_VERSION !== 'undefined') {
        versionBadge.textContent = `v${LILA_VERSION}`;
    }

    // 4. CARGA DE MÓDULOS
    try {
        if (typeof window.cargarVoces === 'function') window.cargarVoces();
        if (typeof window.cargarModelos === 'function') await window.cargarModelos();
        if (typeof window.cargarMemoria === 'function') await window.cargarMemoria();
        
        // === NUEVO: Cargar historial de comandos ===
        if (typeof window.cargarHistorialComandos === 'function') {
            window.cargarHistorialComandos();
        }
        
        // === NUEVO: Cargar historial de mensajes y pintarlos ===
        if (typeof window.cargarHistorialLocal === 'function') {
            const hayHistorial = window.cargarHistorialLocal();
            if (hayHistorial && Array.isArray(window.historialConversacion) && window.historialConversacion.length > 0) {
                const container = document.getElementById('messageContainer');
                if (container) {
                    container.innerHTML = '';
                    for (const msg of window.historialConversacion) {
                        if (typeof window.agregarMensaje === 'function') {
                            window.agregarMensaje(msg.role, msg.content);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error cargando módulos locales:', error);
    }

    // 5. BACKEND Y WS
    try {
        console.log('🔍 Verificando estado del backend...');
        const response = await fetch(`${API_BASE}/api/health`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log('✅ Backend disponible.');
        if (typeof window.conectarWS === 'function') window.conectarWS();
        if (typeof window.verificarBackend === 'function') window.verificarBackend();
    } catch (error) {
        console.warn('⚠️ Backend no disponible. WebSocket en espera.', error.message);
        if (typeof window.actualizarFooterWs === 'function') window.actualizarFooterWs(false);
        const statusEl = document.getElementById('wsStatus');
        if (statusEl) {
            statusEl.textContent = '🔌 Backend Caído';
            statusEl.className = 'ws-status offline';
        }
    }

    // 6. MODELO
    const modelSelect = document.getElementById('modelSelect');
    const modelBadge = document.getElementById('modelBadge');
    if (modelSelect && modelBadge && typeof window.modeloActual !== 'undefined') {
        const modeloExiste = typeof window.listaModelos !== 'undefined' && 
                             window.listaModelos.some(m => (m.name || m.model) === window.modeloActual);
        if (modeloExiste) {
            modelSelect.value = window.modeloActual;
            modelBadge.textContent = window.modeloActual;
        } else if (modelSelect.options.length > 0) {
            modelSelect.value = modelSelect.options[0].value;
            modelBadge.textContent = modelSelect.value;
            window.modeloActual = modelSelect.value;
        } else {
            modelBadge.textContent = window.modeloActual;
        }
        modelSelect.addEventListener('change', function() {
            if (this.value && typeof window.cambiarModelo === 'function') {
                window.cambiarModelo(this.value);
            }
        });
    }

    // 7. BOTÓN ENVIAR
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => { 
            if (typeof window.enviarMensaje === 'function') window.enviarMensaje(e); 
        });
    }

    // 8. INPUT Y FLECHAS
    const input = document.getElementById('userInput');
    if (input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (typeof window.enviarMensaje === 'function') window.enviarMensaje(e);
            } 
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const hist = window.historialComandos || [];
                if (hist.length === 0) return;
                if (window.indiceComando === -1 || window.indiceComando >= hist.length) {
                    window.indiceComando = hist.length - 1;
                } else if (window.indiceComando > 0) {
                    window.indiceComando--;
                }
                this.value = hist[window.indiceComando] || '';
            } 
            else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const hist = window.historialComandos || [];
                if (hist.length === 0) return;
                if (window.indiceComando < hist.length - 1) {
                    window.indiceComando++;
                    this.value = hist[window.indiceComando] || '';
                } else {
                    window.indiceComando = hist.length;
                    this.value = '';
                }
            }
        });
    }

    // 9. CERRAR MENÚ
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('dropdownMenu');
        const hamburger = document.getElementById('hamburgerBtn');
        if (menu?.classList.contains('show') && !menu.contains(e.target) && !hamburger?.contains(e.target)) {
            menu.classList.remove('show');
        }
    });

    // 10. OTRAS UI
    if (typeof window.obtenerUbicacion === 'function') window.obtenerUbicacion();
    if (typeof window.actualizarInfoArchivos === 'function') window.actualizarInfoArchivos();

    // 11. BADGE DE ALMACENAMIENTO
    const storageStatus = document.getElementById('storageStatus');
    if (storageStatus && Array.isArray(window.historialConversacion)) {
        storageStatus.textContent = `💾 ${window.historialConversacion.length} msg`;
    }

    console.log('✅ LILA inicializada correctamente');
});