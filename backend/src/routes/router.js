// backend/src/routes/router.js
import express from 'express';
import { chatWithOllama } from '../services/ollama.js';

const router = express.Router();

// Lista de agentes disponibles (debe coincidir con agentes.js)
const AGENTES_DISPONIBLES = ['redactor', 'programador', 'analista', 'abogado', 'medico'];

// Modelo para el enrutamiento (puedes cambiarlo por uno que tengas instalado)
const MODELO_ROUTER = 'llama3.2:3b'; // Usa un modelo que seguro tengas

router.post('/', async (req, res) => {
    try {
        const { mensaje } = req.body;
        if (!mensaje || mensaje.trim().length === 0) {
            return res.status(400).json({ error: 'Mensaje vacío' });
        }

        const prompt = `
Eres un enrutador de consultas. Analizá el mensaje del usuario y decidí qué agente especializado debe responder.

Agentes disponibles:
- redactor: para informes, textos formales, documentos, redacción ejecutiva.
- programador: para código, arquitectura de software, Node.js, debugging.
- analista: para análisis de datos, procesos de negocio, desglose lógico.
- abogado: para temas legales, derecho laboral, contratos.
- medico: para temas de salud, síntomas, consejos médicos generales.

Mensaje del usuario: "${mensaje}"

Respondé ÚNICAMENTE con un objeto JSON con la clave "agente" y el nombre del agente elegido.
Ejemplo: {"agente": "programador"}
`;

        // Usar chatWithOllama con un solo mensaje (rol user)
        const messages = [
            { role: 'system', content: 'Sos un enrutador de consultas. Respondé solo con JSON válido.' },
            { role: 'user', content: prompt }
        ];

        const respuesta = await chatWithOllama(messages, MODELO_ROUTER, 0.3, 60);

        // Intentar parsear JSON
        let agente = 'analista'; // fallback por defecto
        try {
            // Limpiar posibles textos alrededor del JSON
            const jsonMatch = respuesta.match(/\{.*\}/s);
            if (jsonMatch) {
                const json = JSON.parse(jsonMatch[0]);
                if (json.agente && AGENTES_DISPONIBLES.includes(json.agente)) {
                    agente = json.agente;
                }
            }
        } catch (e) {
            console.warn('No se pudo parsear JSON del router, usando fallback:', respuesta);
        }

        res.json({
            agente: agente,
            mensaje_original: mensaje,
            mensaje_para_agente: mensaje
        });

    } catch (error) {
        console.error('Error en router:', error);
        // En caso de error, devolver un agente por defecto para no romper el flujo
        res.status(200).json({
            agente: 'analista',
            mensaje_original: req.body.mensaje || '',
            mensaje_para_agente: req.body.mensaje || '',
            error: error.message
        });
    }
});

export default router;