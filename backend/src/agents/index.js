// backend/src/agents/index.js
import phaseone from './phaseone.js';
import multiagent from './multiagent.js';
import openworkerAgent from './openworkerAgent.js';
import controlRemoto from './control-remoto.js';   // <--- ruta correcta

export const agents = {
    phaseone,
    multiagent,
    openworker: openworkerAgent,
    controlRemoto                     // <--- agregado
};