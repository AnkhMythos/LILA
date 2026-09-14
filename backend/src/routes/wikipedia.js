// backend/src/routes/wikipedia.js
import express from 'express';

const router = express.Router();

// GET /api/wikipedia/articulo?q=<término>
router.get('/articulo', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, mensaje: 'Falta ?q=' });

    try {
        const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g, '_'))}`;
        const resp = await fetch(url, {
            headers: { 'User-Agent': 'LILA/1.0 (https://lila.local)' }
        });
        if (!resp.ok) return res.json({ success: false, mensaje: `Wikipedia no encontró "${q}"` });

        const data = await resp.json();
        res.json({
            success: true,
            titulo: data.title,
            extracto: data.extract || '',
            url: (data.content_urls?.desktop?.page) || '',
            thumbnail: (data.thumbnail?.source) || ''
        });
    } catch (err) {
        console.error('[wikipedia]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/wikipedia/wikidata?q=<término>
router.get('/wikidata', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, mensaje: 'Falta ?q=' });

    try {
        const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=es&format=json&limit=1&origin=*`;
        const searchResp = await fetch(searchUrl, {
            headers: { 'User-Agent': 'LILA/1.0 (https://lila.local)' }
        });
        if (!searchResp.ok) return res.json({ success: false, mensaje: 'Wikidata error' });

        const searchData = await searchResp.json();
        const hit = searchData.search?.[0];
        if (!hit) return res.json({ success: false, mensaje: `No se encontró "${q}" en Wikidata` });

        res.json({
            success: true,
            entidad_id: hit.id,
            titulo: hit.label || q,
            descripcion: hit.description || '',
            url: hit.concepturi || `https://www.wikidata.org/wiki/${hit.id}`
        });
    } catch (err) {
        console.error('[wikidata]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;