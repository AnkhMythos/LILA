// backend/src/routes/models.js
import express from 'express';
import { listModels, chatWithOllama } from '../services/ollama.js';

const router = express.Router();

// ============================================
// 1. MAPEO DE AGENTES DE TRABAJO
// ============================================
const AGENT_PROMPTS = {
    'qwen2.5:7b': 'Sos un Agente Redactor Corporativo y experto en administración. Tu tarea es generar informes de trabajo estructurados, minutas, correos formales y responder con tono ejecutivo y profesional en español.',
    'deepseek-coder:6.7b': 'Sos un Agente Desarrollador de Software experto. Escribí código limpio, optimizado, modular y documentado. Respondé de forma directa y técnica en español.',
    'deepseek-r1:7b': 'Sos un Agente de Razonamiento Avanzado y Analista de Procesos. Analizá los problemas de negocio, finanzas o lógica desglosándolos paso a paso de forma sumamente meticulosa.',
    'llama3.1:8b': 'Sos un Agente Generalista de Operaciones y Soporte de Trabajo. Ayudás a organizar flujos, redactar respuestas comerciales y procesar datos cotidianos de la oficina.',
    'llama3.2:3b': 'Sos un Asistente Ejecutivo Veloz. Tu objetivo es procesar textos y dar respuestas ultra rápidas, concisas y directas para el día a día laboral.'
};

const AGENT_NAMES = {
    'qwen2.5:7b': 'Agente Redactor y Contenido (Qwen 2.5)',
    'deepseek-coder:6.7b': 'Agente Desarrollador Software (DeepSeek Coder)',
    'deepseek-r1:7b': 'Agente Analista Estratégico (DeepSeek R1)',
    'llama3.1:8b': 'Agente Operaciones y Gestión (Llama 3.1)',
    'llama3.2:3b': 'Asistente Ejecutivo Veloz (Llama 3.2)'
};

// ============================================
// 2. FALLBACK COMPLETO (con TODOS los modelos comunes)
// ============================================
const FALLBACK_MODELS = [
    { name: 'llama3.2:3b', size: '3B' },
    { name: 'deepseek-r1:7b', size: '7B' },
    { name: 'llama3.1:8b', size: '8B' },
    { name: 'phi3:mini', size: '3.8B' },
    { name: 'qwen2.5:7b', size: '7B' },
    { name: 'deepseek-coder:6.7b', size: '6.7B' },
    { name: 'gemma3:latest', size: '3B' },
    { name: 'mistral:7b', size: '7B' },
    { name: 'mistral:7b-instruct-q4_K_M', size: '7B' },
    { name: 'llama3:latest', size: '7B' }
];

// ============================================
// 3. ENDPOINT: LISTAR MODELOS (con información de agentes)
// ============================================
router.get('/', async (req, res) => {
    try {
        const models = await listModels();
        if (models && models.length > 0) {
            const formatted = models.map(m => {
                const modelName = m.name;
                return {
                    name: modelName,
                    size: m.size ? `${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB` : 'desconocido',
                    isAgent: !!AGENT_PROMPTS[modelName],
                    agentDisplayName: AGENT_NAMES[modelName] || `Asistente General (${modelName})`,
                    roleDescription: AGENT_PROMPTS[modelName] ? 'Especializado para flujos de trabajo (WORK).' : 'Modelo genérico local.'
                };
            });
            return res.json(formatted);
        }
        // Si no hay modelos, devolver fallback
        const fallback = FALLBACK_MODELS.map(m => ({
            ...m,
            isAgent: !!AGENT_PROMPTS[m.name],
            agentDisplayName: AGENT_NAMES[m.name] || `Asistente General (${m.name})`,
            roleDescription: AGENT_PROMPTS[m.name] ? 'Especializado para flujos de trabajo (WORK).' : 'Modelo genérico local.'
        }));
        return res.json(fallback);
    } catch (error) {
        console.warn('Error obteniendo modelos de Ollama, usando fallback:', error.message);
        const fallback = FALLBACK_MODELS.map(m => ({
            ...m,
            isAgent: !!AGENT_PROMPTS[m.name],
            agentDisplayName: AGENT_NAMES[m.name] || `Asistente General (${m.name})`,
            roleDescription: AGENT_PROMPTS[m.name] ? 'Especializado para flujos de trabajo (WORK).' : 'Modelo genérico local.'
        }));
        return res.json(fallback);
    }
});

// ============================================
// 4. ENDPOINT: CHAT CON AGENTE (inyección de prompt de sistema)
// ============================================
router.post('/chat', async (req, res) => {
    try {
        const { model, messages, temperature = 0.7, max_tokens = 512 } = req.body;

        if (!model) {
            return res.status(400).json({ error: 'Falta el parámetro "model".' });
        }
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de mensajes.' });
        }

        // Verificar si el modelo tiene un prompt de agente
        const agentSystemPrompt = AGENT_PROMPTS[model];
        let finalizedMessages = [...messages];

        // Si es un agente y no hay un mensaje de sistema, inyectarlo al inicio
        if (agentSystemPrompt) {
            const hasSystem = messages.some(msg => msg.role === 'system');
            if (!hasSystem) {
                finalizedMessages.unshift({
                    role: 'system',
                    content: agentSystemPrompt
                });
            }
        }

        // Llamar a Ollama con el modelo y los mensajes finales
        const respuesta = await chatWithOllama(finalizedMessages, model, temperature, max_tokens);

        return res.json({
            success: true,
            model: model,
            isAgent: !!agentSystemPrompt,
            response: respuesta
        });

    } catch (error) {
        console.error('Error en /api/models/chat:', error.message);
        return res.status(500).json({
            error: 'Error al procesar el chat con el agente.',
            detail: error.message
        });
    }
});

export default router;