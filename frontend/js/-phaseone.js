// frontend/js/phaseone.js
let phaseoneActive = false;


async function togglePhaseOne() {
    try {
        const resp = await fetch(`${API_BASE}/api/phaseone/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !phaseoneActive })
        });

        if (!resp.ok) throw new Error('HTTP ' + resp.status);

        const data = await resp.json();
        phaseoneActive = data.active;

        if (btnPhaseOne) {
            btnPhaseOne.textContent = phaseoneActive
                ? '🤖 PHASEONE: ON'
                : '🤖 PHASEONE: OFF';
            btnPhaseOne.classList.toggle('activo', phaseoneActive);
        }

        agregarMensaje(
            'assistant',
            `🤖 PHASEONE ${phaseoneActive ? 'activado' : 'desactivado'}.`
        );
    } catch (e) {
        console.error(e);
        agregarMensaje('assistant', `❌ Error PHASEONE: ${e.message}`);
    }
}


async function phaseoneStatus() {
    try {
        const resp = await fetch(`${API_BASE}/api/phaseone/status`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);

        const data = await resp.json();
        agregarMensaje(
            'assistant',
            `🤖 **PHASEONE**\n` +
            `Activo: ${data.active}\n` +
            `Agente: ${data.agent}\n` +
            `Rol: ${data.role}\n` +
            `Presupuesto: ${data.budget_seconds}s\n` +
            `Tareas: ${data.tasks}\n` +
            `Memoria: ${data.memory_count}`
        );
    } catch (e) {
        console.error(e);
        agregarMensaje('assistant', `❌ Error status PHASEONE: ${e.message}`);
    }
}


async function phaseoneThink(mensaje) {
    try {
        const resp = await fetch(`${API_BASE}/api/phaseone/think`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: mensaje })
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => null);
            throw new Error(errData?.detail || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        agregarMensaje('assistant', `🤖 **PHASEONE dice:**\n${data.response}`);
    } catch (e) {
        console.error(e);
        agregarMensaje('assistant', `❌ Error PHASEONE: ${e.message}`);
    }
}


async function phaseoneRemember(clave, valor) {
    try {
        const resp = await fetch(`${API_BASE}/api/phaseone/remember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: clave, value: valor })
        });

        if (!resp.ok) throw new Error('HTTP ' + resp.status);

        agregarMensaje('assistant', `🧠 PHASEONE recordó: ${clave}`);
    } catch (e) {
        console.error(e);
        agregarMensaje('assistant', `❌ Error al recordar en PHASEONE: ${e.message}`);
    }
}


async function phaseoneRecall() {
    try {
        const resp = await fetch(`${API_BASE}/api/phaseone/recall`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);

        const data = await resp.json();
        const memoria = Object.entries(data)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n') || 'Sin memoria';

        agregarMensaje('assistant', `🤖 **Memoria de PHASEONE:**\n${memoria}`);
    } catch (e) {
        console.error(e);
        agregarMensaje('assistant', `❌ Error al obtener memoria de PHASEONE: ${e.message}`);
    }
}


async function phaseoneCoordinar(tarea) {
    try {
        const resp = await fetch(`${API_BASE}/api/phaseone/coordinar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: tarea })
        });

        if (!resp.ok) throw new Error('HTTP ' + resp.status);

        const data = await resp.json();
        if (data.dialogo) {
            for (const paso of data.dialogo) {
                agregarMensaje('assistant', `🔹 ${paso}`);
            }
        }
        agregarMensaje('assistant', `🤖 **PHASEONE coordina:**\n${data.final}`);
    } catch (e) {
        console.error(e);
        agregarMensaje('assistant', `❌ Error PHASEONE coordinar: ${e.message}`);
    }
}