// backend/src/services/tools.js
import axios from 'axios';
import { searchWeb } from './ollama.js';

// ---------- Ubicación (cache 30 min) ----------
let _ubicacionCache = null;
let _ubicacionCacheTs = 0;
const UBICACION_TTL = 30 * 60 * 1000;

async function getDateTime() {
    const now = new Date();
    return {
        fecha: now.toLocaleDateString('es-AR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }),
        hora: now.toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: now.toISOString()
    };
}

async function getLocation() {
    if (_ubicacionCache && (Date.now() - _ubicacionCacheTs) < UBICACION_TTL) {
        return _ubicacionCache;
    }
    try {
        const resp = await axios.get('https://ipapi.co/json/', { timeout: 5000 });
        const d = resp.data;
        _ubicacionCache = {
            ip: d.ip, ciudad: d.city, region: d.region,
            pais: d.country_name, lat: d.latitude, lon: d.longitude,
            timezone: d.timezone
        };
        _ubicacionCacheTs = Date.now();
        return _ubicacionCache;
    } catch (e) {
        return _ubicacionCache || { error: 'No se pudo obtener la ubicación' };
    }
}

async function getWeather(params = {}) {
    try {
        let lat = params.lat, lon = params.lon;
        if (!lat || !lon) {
            const loc = await getLocation();
            if (loc.error) return loc;
            lat = loc.lat; lon = loc.lon;
        }
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
        const resp = await axios.get(url, { timeout: 8000 });
        const c = resp.data.current;
        const codigos = {
            0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
            45: 'Niebla', 48: 'Niebla helada', 51: 'Llovizna ligera', 53: 'Llovizna',
            55: 'Llovizna intensa', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa',
            71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve intensa',
            80: 'Chaparrones', 81: 'Chaparrones fuertes', 82: 'Chaparrones violentos',
            95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo'
        };
        return {
            temperatura: c.temperature_2m,
            humedad: c.relative_humidity_2m,
            viento: c.wind_speed_10m,
            condicion: codigos[c.weather_code] || 'Desconocido',
            unidad: '°C'
        };
    } catch (e) {
        return { error: 'No se pudo obtener el clima: ' + e.message };
    }
}

async function calculate(params = {}) {
    const expr = String(params.expresion || params.expression || '');
    if (!expr) return { error: 'Falta la expresión' };
    if (!/^[\d\s\+\-\*\/\(\)\.%,]+$/.test(expr)) {
        return { error: 'La expresión contiene caracteres no permitidos' };
    }
    try {
        const clean = expr.replace(/(\d+)%/g, '($1/100)');
        const result = Function(`"use strict"; return (${clean})`)();
        return { expresion: expr, resultado: result };
    } catch (e) {
        return { error: 'Error al calcular: ' + e.message };
    }
}

async function buscarWebTool(params = {}) {
    const q = String(params.query || params.q || '');
    if (!q) return { error: 'Falta query' };
    const results = await searchWeb(q);
    return { query: q, results: results || [] };
}

async function buscarWikipedia(params = {}) {
    const q = String(params.query || params.q || '');
    if (!q) return { error: 'Falta query' };
    try {
        const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g, '_'))}`;
        const resp = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'LILA/1.0' } });
        return {
            titulo: resp.data.title,
            extracto: resp.data.extract,
            url: resp.data.content_urls?.desktop?.page
        };
    } catch {
        return { error: 'No se encontró en Wikipedia' };
    }
}

export const TOOLS = {
    getDateTime:      { description: 'Fecha y hora actual',                      params: [],                    fn: getDateTime },
    getLocation:      { description: 'Ubicación aproximada por IP',              params: [],                    fn: getLocation },
    getWeather:       { description: 'Clima actual (temp, humedad, viento)',     params: ['lat?', 'lon?'],      fn: getWeather },
    calculate:        { description: 'Evalúa expresiones matemáticas',           params: ['expresion'],         fn: calculate },
    buscarWeb:        { description: 'Busca en la web',                         params: ['query'],             fn: buscarWebTool },
    buscarWikipedia:  { description: 'Busca un artículo en Wikipedia',           params: ['query'],             fn: buscarWikipedia }
};

export async function executeTool(name, params = {}) {
    if (!TOOLS[name]) return { error: `Herramienta "${name}" no existe` };
    try {
        return await TOOLS[name].fn(params);
    } catch (e) {
        return { error: e.message };
    }
}

export function listTools() {
    return Object.entries(TOOLS).map(([name, t]) => ({
        name, description: t.description, params: t.params
    }));
}