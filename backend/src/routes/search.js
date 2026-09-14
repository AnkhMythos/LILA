// src/routes/search.js
import express from 'express';
import { searchWeb } from '../services/ollama.js';

const router = express.Router();

// ============================================
// BÚSQUEDA WEB (sin API key)
// ============================================
router.post('/', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'La consulta no puede estar vacía' });
    }
    
    console.log(`🔍 Buscando: ${query}`);
    
    // Usar DuckDuckGo HTML scraping (sin API key)
    const results = await searchWeb(query);
    
    res.json({
      success: true,
      query,
      results: results || []
    });
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      results: []
    });
  }
});

export default router;