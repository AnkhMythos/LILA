// src/routes/openworker.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { OpenWorkerAgent } from '../agents/openworkerAgent.js';

const router = express.Router();

// Instancia del agente
const openWorker = new OpenWorkerAgent();

// ============================================
// EJECUTAR OPENWORKER
// ============================================
router.post('/run', async (req, res) => {
  try {
    const { task } = req.body;
    
    if (!task || task.trim().length === 0) {
      return res.status(400).json({ error: 'La tarea no puede estar vacía' });
    }
    
    console.log(`🤖 OpenWorker ejecutando: ${task}`);
    
    const result = await openWorker.run(task);
    
    res.json({
      success: true,
      task,
      ...result
    });
  } catch (error) {
    console.error('Error en OpenWorker:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// HISTORIAL
// ============================================
router.get('/historial', async (req, res) => {
  try {
    const history = openWorker.getHistory();
    res.json(history);
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LIMPIAR HISTORIAL
// ============================================
router.delete('/historial', async (req, res) => {
  try {
    const count = openWorker.clearHistory();
    res.json({ 
      success: true, 
      message: 'Historial limpiado',
      deleted: count 
    });
  } catch (error) {
    console.error('Error limpiando historial:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;