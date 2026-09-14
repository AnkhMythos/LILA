// backend/src/routes/agentes.js
import express from 'express';
import { chatWithOllama } from '../services/ollama.js';
import controlRemoto from '../agents/control-remoto.js'; // <-- Integración del módulo

const router = express.Router();

// ==========================================
// DEFINICIÓN DE AGENTES (LLMs)
// ==========================================
const agentes = {
    redactor: {
        model: 'qwen2.5:7b',
        system: `Eres un redactor profesional de informes de trabajo. Tu tono es formal y ejecutivo.
        Si no tienes información verificada, di que no la tienes. No inventes datos ni fuentes.`
    },
    programador: {
        model: 'deepseek-coder:6.7b',
        system: `Eres un experto en Node.js, Python y arquitectura de software.
        REGLAS ESTRICTAS:
        - Si no conoces una librería o herramienta, di "No conozco esa librería" en lugar de inventar.
        - No uses bibliotecas ficticias. Solo recomienda paquetes reales de npm o PyPI.
        - Usa SOLO APIs estándar o librerías ampliamente conocidas (express, axios, fs, etc.).
        - Si no estás seguro, ofrece una solución alternativa o pide más contexto.
        - Escribí código limpio y optimizado.`
    },
    analista: {
        model: 'deepseek-r1:7b',
        system: `Eres un analista de datos y procesos de negocio. Desglosá los problemas lógicamente.
        Basa tus respuestas en lógica y datos. Si no tienes datos, admítelo. No inventes estadísticas.`
    },
    abogado: {
        model: 'llama3.1:8b',
        system: `Eres un abogado experto en derecho laboral. Respondé con precisión legal.
        Si no estás seguro de un punto legal, indica que necesitas consultar fuentes adicionales.`
    },
    medico: {
        model: 'phi3:mini',
        system: `Eres un médico general. Respondé con lenguaje claro y compasivo.
        Si no conoces un síntoma o enfermedad, recomienda consultar a un especialista.`
    }
};

// ==========================================
// RUTAS
// ==========================================

// Listar agentes disponibles (Corregido: eliminada la duplicidad)
router.get('/', (req, res) => {
    const lista = Object.keys(agentes).map(nombre => ({
        nombre,
        model: agentes[nombre].model,
        descripcion: agentes[nombre].system.substring(0, 60) + '...'
    }));
    res.json(lista);
});

// Ejecutar un agente específico
router.post('/:nombre/ejecutar', async (req, res) => {
    const { nombre } = req.params;
    const { tarea, dispositivo, comando } = req.body;

    // ==========================================
    // CASO ESPECIAL: AGENTE DE CONTROL REMOTO
    // ==========================================
    if (nombre === 'control-remoto') {
        try {
            let targetDevice = dispositivo || 'default_device';
            let actionCommand = comando;

            // Fallback de lenguaje natural si el frontend solo envía 'tarea'
            if (!actionCommand && tarea) {
                const tareaLower = tarea.toLowerCase();
                if (tareaLower.includes('enciende') || tareaLower.includes('activar')) {
                    actionCommand = 'ON';
                } else if (tareaLower.includes('apaga') || tareaLower.includes('desactivar')) {
                    actionCommand = 'OFF';
                } else {
                    actionCommand = tarea; // Envía el texto tal cual si no hay palabras clave
                }
            }

            if (!actionCommand) {
                return res.status(400).json({ error: 'No se pudo determinar el comando a enviar.' });
            }

            // Ejecutar el envío real al hardware
            const exito = controlRemoto.sendCommand(targetDevice, actionCommand);

            if (exito) {
                return res.json({ 
                    agente: 'control-remoto', 
                    modelo: 'Hardware-Interface-v1',
                    respuesta: `✅ Comando "${actionCommand}" enviado exitosamente al dispositivo ${targetDevice}.` 
                });
            } else {
                return res.status(500).json({ 
                    agente: 'control-remoto', 
                    respuesta: `❌ Fallo: No hay conexión activa con el dispositivo ${targetDevice}.` 
                });
            }
        } catch (error) {
            console.error('❌ Error en agente Control Remoto:', error);
            return res.status(500).json({ error: 'Error interno del agente de control.' });
        }
    }

    // ==========================================
    // CASO NORMAL: AGENTES BASADOS EN OLLAMA
    // ==========================================
    if (!nombre || !agentes[nombre]) {
        return res.status(404).json({ error: `Agente "${nombre}" no encontrado` });
    }

    if (!tarea || tarea.trim().length === 0) {
        return res.status(400).json({ error: 'La tarea no puede estar vacía' });
    }

    const agente = agentes[nombre];
    const messages = [
        { role: 'system', content: agente.system },
        { role: 'user', content: tarea }
    ];

    try {
        const respuesta = await chatWithOllama(messages, agente.model, 0.7, 512);
        res.json({
            agente: nombre,
            modelo: agente.model,
            respuesta: respuesta
        });
    } catch (error) {
        console.error(`Error ejecutando agente ${nombre}:`, error);
        res.status(500).json({
            error: `El modelo "${agente.model}" no está disponible en Ollama. Verifica que esté instalado o cambia el modelo en agentes.js.`
        });
    }
});

export default router;