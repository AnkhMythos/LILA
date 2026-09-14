// backend\src\agents\multiagent.js
export default {
    name: 'multiagent',
    async run(task, context = {}) {
        // Coordinador multiagente
        return `Multiagente analizó: ${task}`;
    }
};