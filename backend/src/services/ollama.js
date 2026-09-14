// backend/src/services/ollama.js
import axios from 'axios';
import config from '../config.js';
import fs from 'fs/promises';
import path from 'path';

const ollama = axios.create({
  baseURL: config.ollamaUrl,
  timeout: 300000, // 300 segundos (5 min) — necesario para modelos 7B en CPU
  headers: { 'Content-Type': 'application/json' }
});

// ============================================================
// MUTEX: garantiza que Ollama atienda UNA petición a la vez
// ============================================================
let _ollamaBusy = false;
const _ollamaQueue = [];

function _withMutex(fn) {
    return new Promise((resolve, reject) => {
        _ollamaQueue.push({ fn, resolve, reject });
        _processQueue();
    });
}

async function _processQueue() {
    if (_ollamaBusy) return;
    if (_ollamaQueue.length === 0) return;
    _ollamaBusy = true;
    const { fn, resolve, reject } = _ollamaQueue.shift();
    try { resolve(await fn()); }
    catch (e) { reject(e); }
    _ollamaBusy = false;
    setImmediate(_processQueue);
}

// ============================================
// CHAT (conversación)
// ============================================
export async function chatWithOllama(messages, model, temperature = 0.7, maxTokens = 512) {
    return _withMutex(async () => {
        try {
            const response = await ollama.post('/api/chat', {
                model: model || 'llama3.2:3b',
                messages: messages,
                stream: false,
                options: {
                    temperature: temperature,
                    num_predict: maxTokens
                }
            });
            return response.data.message?.content || '';
        } catch (error) {
            console.error('Error en Ollama chat:', error.message);
            throw new Error(`Error generando respuesta: ${error.message}`);
        }
    });
}

// ============================================
// GENERACIÓN SIMPLE (texto)
// ============================================
export async function generateText(prompt, model = 'llama3.2:3b', temperature = 0.7, maxTokens = 512) {
    return _withMutex(async () => {
        try {
            const response = await ollama.post('/api/generate', {
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: temperature,
                    num_predict: maxTokens
                }
            });
            return response.data.response || '';
        } catch (error) {
            console.error('Error en generateText:', error.message);
            throw new Error(`Error generando texto: ${error.message}`);
        }
    });
}

// ============================================
// LISTAR MODELOS
// ============================================
export async function listModels() {
    try {
        const response = await ollama.get('/api/tags', { timeout: 6000 });
        return response.data.models || [];
    } catch (error) {
        console.error('Error listando modelos:', error.message);
        return [];
    }
}

// ============================================
// MOSTRAR INFORMACIÓN DE UN MODELO
// ============================================
export async function showModel(modelName) {
    try {
        const response = await ollama.post('/api/show', { model: modelName });
        return response.data || {};
    } catch (error) {
        console.error(`Error mostrando modelo ${modelName}:`, error.message);
        return null;
    }
}

// ============================================
// COPIAR MODELO
// ============================================
export async function copyModel(source, destination) {
    try {
        await ollama.post('/api/copy', { source, destination });
        return { success: true };
    } catch (error) {
        console.error(`Error copiando modelo ${source} -> ${destination}:`, error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// ELIMINAR MODELO
// ============================================
export async function deleteModel(modelName) {
    try {
        await ollama.delete(`/api/delete`, { data: { model: modelName } });
        return { success: true };
    } catch (error) {
        console.error(`Error eliminando modelo ${modelName}:`, error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// PULL MODELO (descargar)
// ============================================
export async function pullModel(modelName, streamCallback = null) {
    try {
        const response = await ollama.post('/api/pull', {
            model: modelName,
            stream: true
        }, { responseType: 'stream' });

        let progress = '';
        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (streamCallback) streamCallback(data);
                    if (data.status) progress += data.status + ' ';
                } catch (e) {}
            }
        }
        return { success: true, progress };
    } catch (error) {
        console.error(`Error descargando modelo ${modelName}:`, error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// EMBEDDINGS
// ============================================
export async function getEmbeddings(text, model = 'llama3.2:3b') {
    try {
        const response = await ollama.post('/api/embeddings', {
            model: model,
            prompt: text
        });
        return response.data.embedding || [];
    } catch (error) {
        console.error('Error obteniendo embeddings:', error.message);
        return [];
    }
}

// ============================================
// BÚSQUEDA WEB (DuckDuckGo - sin API key)
// ============================================
export async function searchWeb(query) {
    try {
        const response = await axios.get('https://html.duckduckgo.com/html/', {
            params: { q: query },
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        const html = response.data;
        const results = [];
        const regex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 5) {
            const url = match[1];
            const title = match[2].trim();
            if (title && url && !url.includes('//duckduckgo.com/l/')) {
                results.push({ title, link: url });
            }
        }
        return results;
    } catch (error) {
        console.error('Error en búsqueda web:', error.message);
        return [];
    }
}

// ============================================================
// CHAT CON TOOLS (function calling nativo de Ollama)
// ============================================================
export async function chatConTools(messages, model, tools, temperature = 0.7, maxTokens = 512) {
    return _withMutex(async () => {
        try {
            const body = {
                model: model || 'llama3.1:8b',
                messages,
                stream: false,
                options: { temperature, num_predict: maxTokens }
            };
            if (tools && tools.length > 0) body.tools = tools;
            const response = await ollama.post('/api/chat', body);
            return response.data.message || { content: '', tool_calls: null };
        } catch (error) {
            console.error('Error en chatConTools:', error.message);
            throw new Error(`Error en chat con tools: ${error.message}`);
        }
    });
}