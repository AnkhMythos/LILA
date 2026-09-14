// backend/src/agents/phaseone.js

export default {
    name: 'phaseone',
    async run(task, context = {}) {
        // Lógica simple de PHASEONE (luego se conectará con Ollama)
        return `PHASEONE recibió: ${task}`;
    }
};