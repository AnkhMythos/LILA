// backend/mcp-server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mi-servidor",
  version: "1.0.0",
});

const DESPENSA_URL = "https://ankhmythos.github.io/Despensa/despensa.json";

// ============================================================
// CACHE: evita descargar el JSON en cada llamada (5 min)
// ============================================================
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function obtenerProductos() {
    if (_cache && (Date.now() - _cacheTs) < CACHE_TTL) {
        return _cache;
    }
    const resp = await fetch(DESPENSA_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} al leer despensa.json`);
    const data = await resp.json();
    _cache = data.products || [];
    _cacheTs = Date.now();
    return _cache;
}

// ============================================================
// HERRAMIENTA 1: Clima real (open-meteo)
// ============================================================
server.tool(
    "obtener_clima",
    "Obtiene el clima actual de una ciudad",
    { ciudad: z.string().describe("Nombre de la ciudad") },
    async ({ ciudad }) => {
        try {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`;
            const geoResp = await fetch(geoUrl);
            const geoData = await geoResp.json();
            if (!geoData.results || geoData.results.length === 0) {
                return { content: [{ type: "text", text: `No encontré la ciudad "${ciudad}"` }] };
            }
            const { latitude, longitude, name, country } = geoData.results[0];

            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
            const wResp = await fetch(weatherUrl);
            const wData = await wResp.json();
            const c = wData.current;

            const codigos = {
                0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
                45: 'Niebla', 48: 'Niebla helada', 51: 'Llovizna ligera', 53: 'Llovizna',
                55: 'Llovizna intensa', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa',
                71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve intensa',
                80: 'Chaparrones', 81: 'Chaparrones fuertes', 82: 'Chaparrones violentos',
                95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo'
            };

            const texto =
                `📍 ${name}, ${country}\n` +
                `🌡️ ${c.temperature_2m}°C\n` +
                `☁️ ${codigos[c.weather_code] || 'Desconocido'}\n` +
                `💧 Humedad: ${c.relative_humidity_2m}%\n` +
                `💨 Viento: ${c.wind_speed_10m} km/h`;

            return { content: [{ type: "text", text: texto }] };
        } catch (e) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }] };
        }
    }
);

// ============================================================
// HERRAMIENTA 2: Buscar producto en TU Despensa real
// ============================================================
server.tool(
    "buscar_producto",
    "Busca un producto en tu inventario de Despensa (por nombre, marca o categoría)",
    {
        nombre: z.string().describe("Nombre, marca o parte del nombre del producto"),
        categoria: z.string().optional().describe("Filtrar por categoría (ej: Almacén, Bebidas, Higiene)")
    },
    async ({ nombre, categoria }) => {
        try {
            const productos = await obtenerProductos();
            const q = (nombre || '').toLowerCase().trim();
            const catFiltro = (categoria || '').toLowerCase().trim();

            let encontrados = productos.filter(p => {
                const coincideNombre = !q ||
                    (p.name || '').toLowerCase().includes(q) ||
                    (p.brand || '').toLowerCase().includes(q) ||
                    (p.barcode || '').includes(q);
                const coincideCat = !catFiltro ||
                    (p.cat || '').toLowerCase() === catFiltro;
                return coincideNombre && coincideCat;
            });

            if (encontrados.length === 0) {
                return { content: [{ type: "text", text: `No encontré productos que coincidan con "${nombre}"${categoria ? ` en categoría "${categoria}"` : ''}.` }] };
            }

            // Ordenar por nombre y limitar a 10 resultados
            encontrados.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            const top = encontrados.slice(0, 10);

            const lista = top.map(p => {
                const partes = [`- **${p.name}**`];
                if (p.brand) partes.push(`  Marca: ${p.brand}`);
                if (p.qty !== undefined) partes.push(`  Stock: ${p.qty} ${p.unit || 'unid'}`);
                if (p.min !== undefined) partes.push(`  Mínimo: ${p.min}`);
                if (p.cat) partes.push(`  Categoría: ${p.cat}`);
                if (p.exp) partes.push(`  Vence: ${p.exp}`);
                if (p.price) partes.push(`  Precio: $${p.price}`);
                return partes.join('\n');
            }).join('\n\n');

            const extra = encontrados.length > 10 ? `\n\n_(mostrando 10 de ${encontrados.length})_` : '';
            return { content: [{ type: "text", text: `Encontré ${encontrados.length} producto(s):\n\n${lista}${extra}` }] };
        } catch (e) {
            return { content: [{ type: "text", text: `Error consultando Despensa: ${e.message}` }] };
        }
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);