// backend/src/agents/openworkerAgent.js
import axios from 'axios';

export class OpenWorkerAgent {
    constructor() {
        this.history = [];
    }

    // ==========================================
    // HERRAMIENTAS DISPONIBLES
    // ==========================================

    // 1. Obtener fecha y hora actual
    getCurrentDateTime() {
        const now = new Date();
        return {
            fecha: now.toLocaleDateString('es-ES', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }),
            hora: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: now.toISOString()
        };
    }

    // 2. Obtener ubicación aproximada (por IP)
    async getLocation() {
        try {
            const response = await axios.get('https://ipapi.co/json/', { timeout: 5000 });
            const data = response.data;
            return {
                ip: data.ip,
                ciudad: data.city,
                region: data.region,
                pais: data.country_name,
                codigo_pais: data.country_code,
                latitud: data.latitude,
                longitud: data.longitude,
                zona_horaria: data.timezone
            };
        } catch (error) {
            console.error('Error obteniendo ubicación:', error.message);
            return { error: 'No se pudo obtener la ubicación' };
        }
    }

    // 3. Ejecutar una herramienta según el nombre
    async executeTool(toolName, params = {}) {
        switch (toolName) {
            case 'getDateTime':
                return this.getCurrentDateTime();
            case 'getLocation':
                return await this.getLocation();
            default:
                return { error: `Herramienta "${toolName}" no reconocida` };
        }
    }

    // ==========================================
    // MÉTODO PRINCIPAL run()
    // ==========================================

    async run(task) {
        const taskLower = task.toLowerCase();

        // --- Detectar intención y responder directamente ---
        if (taskLower.includes('fecha') || taskLower.includes('hora') || taskLower.includes('qué día')) {
            const datetime = this.getCurrentDateTime();
            return {
                task: task,
                plan: ['Obtener fecha y hora actual'],
                steps: [{ step: 'Consultar sistema', result: 'Fecha y hora obtenidas' }],
                final: `📅 Hoy es **${datetime.fecha}**.\n🕐 Son las **${datetime.hora}** (huso horario: ${datetime.timezone}).`
            };
        }

        if (taskLower.includes('ubicación') || taskLower.includes('localización') || taskLower.includes('dónde estamos')) {
            const location = await this.getLocation();
            if (location.error) {
                return {
                    task: task,
                    plan: ['Obtener ubicación'],
                    steps: [{ step: 'Consultar IP', result: 'Error' }],
                    final: `❌ No se pudo obtener la ubicación: ${location.error}`
                };
            }
            return {
                task: task,
                plan: ['Obtener ubicación por IP'],
                steps: [{ step: 'Consultar ipapi.co', result: 'Ubicación obtenida' }],
                final: `📍 Estamos aproximadamente en **${location.ciudad}, ${location.region}, ${location.pais}**.\n🌐 IP: ${location.ip}\n🗺️ Coordenadas: ${location.latitud}, ${location.longitud}`
            };
        }

        // --- Fallback genérico ---
        return {
            task: task,
            plan: ['Analizar tarea', 'Ejecutar con herramientas'],
            steps: [
                { step: 'Identificar herramientas necesarias', result: 'No se detectaron herramientas específicas' }
            ],
            final: `Tarea "${task}" recibida. Puedo responder preguntas sobre fecha, hora y ubicación. Para tareas más complejas, necesito más herramientas.`
        };
    }

    // ==========================================
    // HISTORIAL
    // ==========================================

    addToHistory(entry) {
        this.history.push({
            id: this.history.length + 1,
            ...entry,
            created_at: entry.created_at || new Date().toISOString()
        });
    }

    getHistory() {
        return this.history;
    }

    clearHistory() {
        const count = this.history.length;   // ← cuenta REAL antes de vaciar
        this.history = [];
        return count;
    }
}