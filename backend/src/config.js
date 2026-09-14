// backend/src/config.js

import dotenv from 'dotenv';
dotenv.config();

export default {
    port: process.env.PORT || 8000,
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    memoryFile: './data/memory.json'
};