// backend/src/routes/noticias.js
/**
 * Router de noticias para LILA.
 * Usa feeds RSS públicos (Google News, BBC Mundo, Infobae).
 * No requiere API keys.
 */

import express from 'express';
import Parser from 'rss-parser';

const router = express.Router();

const parser = new Parser({
    timeout: 8000,
    headers: { 'User-Agent': 'LILA/1.0 (+https://lila.local)' }
});

// Feeds por defecto
const FEEDS_ULTIMAS = [
    { nombre: 'Google News - Argentina', url: 'https://news.google.com/rss?hl=es-419&gl=AR&ceid=AR:es-419' },
    { nombre: 'BBC Mundo',               url: 'https://feeds.bbci.co.uk/mundo/rss.xml' },
    { nombre: 'Infobae',                 url: 'https://www.infobae.com/feeds/rss/' }
];

// Cache en memoria (10 min)
const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function cacheGet(key) {
    const e = CACHE.get(key);
    if (e && (Date.now() - e.ts) < CACHE_TTL) return e.data;
    return null;
}
function cacheSet(key, data) {
    CACHE.set(key, { ts: Date.now(), data });
}

async function fetchFeed(url, fuente, limite = 8) {
    try {
        const feed = await parser.parseURL(url);
        return feed.items.slice(0, limite).map(it => ({
            titulo:  (it.title || '').trim(),
            url:     (it.link || '').trim(),
            fuente,
            fecha:   it.isoDate || it.pubDate || '',
            resumen: (it.contentSnippet || it.content || '').trim().slice(0, 300)
        }));
    } catch (err) {
        console.warn(`[noticias] Error parseando ${fuente}: ${err.message}`);
        return [];
    }
}

// GET /api/noticias/ultimas?limite=10
router.get('/ultimas', async (req, res) => {
    const limite = Math.min(Math.max(parseInt(req.query.limite) || 10, 1), 30);
    const key = `ultimas:${limite}`;
    const cached = cacheGet(key);
    if (cached) return res.json(cached);

    try {
        const todas = [];
        for (const feed of FEEDS_ULTIMAS) {
            const items = await fetchFeed(feed.url, feed.nombre, limite);
            todas.push(...items);
        }
        todas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        const resultado = todas.slice(0, limite);
        cacheSet(key, resultado);
        res.json(resultado);
    } catch (err) {
        console.error('[noticias] ultimas:', err);
        res.status(500).json({ detail: 'Error obteniendo noticias' });
    }
});

// GET /api/noticias/buscar?q=<tema>&limite=10
router.get('/buscar', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
        return res.status(400).json({ detail: 'Consulta demasiado corta' });
    }
    const limite = Math.min(Math.max(parseInt(req.query.limite) || 10, 1), 30);
    const key = `buscar:${q.toLowerCase()}:${limite}`;
    const cached = cacheGet(key);
    if (cached) return res.json(cached);

    try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=AR&ceid=AR:es-419`;
        const resultado = await fetchFeed(url, 'Google News', limite);
        cacheSet(key, resultado);
        res.json(resultado);
    } catch (err) {
        console.error('[noticias] buscar:', err);
        res.status(500).json({ detail: 'Error buscando noticias' });
    }
});

export default router;