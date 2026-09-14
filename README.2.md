# 🧉 LILA — Local Intelligence & Language Assistant

> Asistente de IA local con voz, multiagente, MCP, RAG y chat entre instancias.
> Corre 100% en tu máquina. Sin API keys. Sin enviar datos a la nube.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)
![Ollama](https://img.shields.io/badge/Ollama-required-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 📖 Índice

- [¿Qué es LILA?](#-qué-es-lila)
- [Capacidades](#-capacidades)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [Comandos](#-comandos)
- [Arquitectura](#-arquitectura)
- [MCP: conectar herramientas externas](#-mcp-conectar-herramientas-externas)
- [Personalización de modelos](#-personalización-de-modelos)
- [Comparación con otros sistemas](#-comparación-con-otros-sistemas)
- [Roadmap](#-roadmap)
- [Licencia](#-licencia)

---

## 🎯 ¿Qué es LILA?

LILA es un asistente de inteligencia artificial **local**, diseñado para correr en tu propia máquina con [Ollama](https://ollama.com) como motor de inferencia. No depende de OpenAI, Anthropic ni ninguna nube. Tus conversaciones, tus documentos y tus datos **nunca salen de tu computadora**.

A diferencia de un chat con LLM común, LILA incluye:

- **Multiagente real**: 6 agentes especializados (programador, analista, redactor, crítico, investigador, pensador) coordinados por un líder que planifica, ejecuta, verifica y sintetiza.
- **Voz bidireccional**: habla y escucha usando la Web Speech API del navegador, sin servicios externos.
- **MCP (Model Context Protocol)**: se conecta a servidores externos para ampliar capacidades (clima, inventario, Wikipedia, y lo que quieras sumar).
- **RAG local**: indexa conversaciones y documentos para búsqueda semántica.
- **Chat entre instancias**: dos o más pestañas de LILA pueden conversar entre sí por WebSocket.
- **Memoria compartida**: SQLite persistente entre sesiones.
- **Comandos extensibles**: 40+ comandos built-in, desde `/noticias` hasta `/coordinar`.

---

## ✨ Capacidades

### 🧠 Inteligencia artificial
- Selección de modelo en runtime entre todos los instalados en Ollama.
- Temperatura ajustable por sesión.
- Chat normal con contexto temporal (fecha, hora, ubicación por IP).
- Multiagente con roles, memoria compartida y verificación de respuestas.

### 🗣️ Voz y escucha
- Text-to-Speech con Web Speech API (voces nativas del sistema).
- Speech-to-Text con reconocimiento continuo en español rioplatense.
- Ajuste de velocidad, tono y volumen.
- Detección de comandos por voz ("enviar", "enter", "mandar").

### 🔌 Integraciones MCP
- Cliente MCP con soporte para servidores stdio.
- Toggle on/off desde el footer.
- Descubrimiento automático de herramientas.
- Function calling nativo con modelos que lo soportan (Llama 3.1, Qwen 2.5, Mistral).

### 📚 RAG y memoria
- Indexación full-text con SQLite FTS5.
- Búsqueda semántica (próximamente con embeddings).
- Memoria de usuario persistente en JSON.
- Historial de conversaciones en localStorage + SQLite.

### 🌐 Información
- **Búsqueda web** (DuckDuckGo).
- **Wikipedia** y **Wikidata** con resumen y link.
- **Noticias** desde feeds RSS (Google News, BBC Mundo, Infobae).
- **Clima real** vía Open-Meteo (sin API key).

### 🤖 Ejecución y automatización
- Ejecución de Python en backend (con timeout).
- Coordinación multiagente con reintentos y juez final.
- Control remoto de hardware USB/TCP.

### 💬 Multi-instancia
- WebSocket con broadcast entre pestañas.
- Botón **Diálogo** para que dos LILAs conversen entre sí.
- Límite configurable de respuestas encadenadas.

---

## 🖥️ Requisitos

| Componente | Versión | Notas |
|---|---|---|
| **Node.js** | 20 o superior | Recomendado LTS |
| **Ollama** | Última | [Descarga](https://ollama.com/download) |
| **Navegador** | Chrome, Edge o Firefox actualizado | Web Speech API requiere Chrome/Edge para mejor soporte |
| **SO** | Linux, macOS o Windows 10/11 | Probado en Windows 11 |
| **RAM** | 8 GB mínimo, 16 GB recomendado | Depende del tamaño del modelo |
| **Disco** | ~10 GB para modelos base | Cada modelo 7B pesa ~4-5 GB |

---

## 🚀 Instalación

### 1. Instalar Ollama

Descargá Ollama desde [ollama.com/download](https://ollama.com/download) e instalalo.

Verificá que funciona:

```bash
ollama --version


# Modelo liviano y rápido (2 GB)
ollama pull llama3.2:3b

# Modelo más capaz para tareas complejas (4.7 GB)
ollama pull qwen2.5:7b

# Modelo con soporte de function calling (4.9 GB)
ollama pull llama3.1:8b

# Modelo especializado en código (4.7 GB)
ollama pull qwen2.5-coder:7b

# Modelo de embeddings (274 MB)
ollama pull nomic-embed-text


Instalación

git clone https://github.com/tu-usuario/LILA.git
cd LILA

cd backend
npm install

Estructura 

LILA/
├── backend/
│   ├── src/
│   │   ├── server.js          ← punto de entrada
│   │   ├── routes/            ← endpoints HTTP
│   │   ├── services/          ← ollama, tools, mcp, memory
│   │   ├── agents/            ← agentes internos
│   │   └── data/              ← SQLite (se crea solo)
│   ├── mcp-server.js          ← servidor MCP de ejemplo
│   ├── mcp-servers.json       ← config de servidores MCP
│   └── package.json
└── frontend/
    ├── index.html
    ├── estilos.css
    └── js/                    ← 12 módulos JS vanilla


Backend — backend/src/config.js

export default {
    port: 8000,
    ollamaUrl: 'http://127.0.0.1:11434',
    memoryFile: './data/memory.json'
};

Frontend — frontend/js/config.js

var API_BASE = 'http://127.0.0.1:8000';
var WS_URL   = 'ws://127.0.0.1:8000/api/instances/ws';
var USER_ID  = 'usuario_' + Math.random().toString(36).substring(2, 10);


Iniciar:
cd backend
npm start

🚀 Backend LILA corriendo en: http://127.0.0.1:8000
🔌 WebSocket: ws://127.0.0.1:8000/api/instances/ws
[ollama] ✅ URL activa: http://127.0.0.1:11434
[mcp] ✅ "mi-servidor" conectado. 2 herramienta(s)

Abrí frontend/index.html en el navegador. Recomendado: usá Live Server de VS Code (puerto 5500) para evitar problemas de CORS.

verificar http://127.0.0.1:8000/api/health/full

Comandos
LILA incluye 40+ comandos organizados por categoría. Escribí /ayuda en el chat para ver la lista completa.

Conversación
Comando	Descripción
/historial	Últimos 10 mensajes
/borrar	Reinicia la conversación
/exportar / /importar	Gestiona la conversación en JSON
/yo	Muestra lo que recuerda de vos
/version	Versión, modelo y memoria
Inteligencia artificial
Comando	Descripción
/modelo <nombre>	Cambia el modelo de Ollama
/temperatura <0-1>	Ajusta la creatividad
/coordinar <tarea>	Orquesta varios agentes
/agentes	Lista los 6 agentes disponibles
/ejecutar <agente> <tarea>	Ejecuta un agente puntual
/multiagente	Toggle on/off del modo multiagente
/tools	Herramientas disponibles
MCP
Comando	Descripción
/mcp status	Estado de servidores MCP
/mcp tools	Herramientas MCP disponibles
/mcp call <tool> <json>	Invoca una tool MCP
Voz
Comando	Descripción
/voz on|off|info	Gestiona la voz
/voces	Lista las voces del sistema
/velocidad, /tono, /volumen	Ajustes finos
/escuchar / /parescuchar	Activa/desactiva micrófono
Memoria
Comando	Descripción
/recordar <clave>: <valor>	Guarda un hecho
/olvidar <clave>|todo	Elimina hechos
/memoria	Ve la memoria compartida del multiagente
/historialma	Historial de coordinaciones
Búsqueda
Comando	Descripción
/buscar <texto>	Busca en la web
/wikipedia <término>	Artículo de Wikipedia
/wikidata <término>	Entidad de Wikidata
/noticias [tema]	Últimas noticias
Utilidades
Comando	Descripción
/python <código>	Ejecuta Python en el backend
/dialogo	Activa diálogo entre instancias
/conectar	Reconecta WebSocket
/enviar <mensaje>	Envía a otras instancias de LILA


┌───────────────────────────────────────────────────────┐
│                    NAVEGADOR (frontend)                │
│  ┌─────────────────────────────────────────────────┐  │
│  │  chat.js · commands.js · websocket.js           │  │
│  │  speech.js · listener.js · multiagent.js · mcp.js│  │
│  └─────────────────────────────────────────────────┘  │
│                        │                               │
│                 HTTP + WebSocket                       │
└────────────────────────┼───────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│                  BACKEND (Node.js + Express)           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  server.js                                       │  │
│  │  ├── /api/chat          → chat con LLM           │  │
│  │  ├── /api/multiagent    → coordinación agentes   │  │
│  │  ├── /api/mcp           → cliente MCP            │  │
│  │  ├── /api/rag           → RAG SQLite FTS5        │  │
│  │  ├── /api/wikipedia     → Wikipedia + Wikidata   │  │
│  │  ├── /api/noticias      → RSS                    │  │
│  │  ├── /api/python        → ejecución sandbox      │  │
│  │  └── /api/instances/ws  → WebSocket broadcast    │  │
│  └──────────────────────────────────────────────────┘  │
│                        │                               │
│           ┌────────────┼─────────────┐                 │
│           ▼            ▼             ▼                 │
│      ┌─────────┐  ┌────────┐  ┌──────────┐             │
│      │ Ollama  │  │ SQLite │  │ MCP      │             │
│      │ (LLMs)  │  │ (datos)│  │ servers  │             │
│      └─────────┘  └────────┘  └──────────┘             │
└────────────────────────────────────────────────────────┘



🔌 MCP: conectar herramientas externas
MCP (Model Context Protocol) permite que LILA se conecte a servidores de herramientas que exponen funcionalidades. Podés crear los tuyos o usar los existentes.

Servidor MCP de ejemplo
LILA incluye backend/mcp-server.js con 2 herramientas: obtener_clima y buscar_producto.

Configurar servidores
Editá backend/mcp-servers.json:

json
{
  "servers": {
    "mi-servidor": {
      "command": "node",
      "args": ["mcp-server.js"],
      "enabled": true
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/ruta/a/tus/archivos"],
      "enabled": false
    }
  }
}


Servidores MCP recomendados
@modelcontextprotocol/server-filesystem — acceso a archivos locales

@modelcontextprotocol/server-sqlite — consultas a SQLite

@modelcontextprotocol/server-github — issues, PRs, repos

@modelcontextprotocol/server-fetch — descarga de URLs

Cómo crear tu propio servidor MCP
javascript
// mi-mcp-server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mi-servidor",
  version: "1.0.0",
});

server.tool(
  "saludar",
  "Devuelve un saludo personalizado",
  { nombre: z.string() },
  async ({ nombre }) => {
    return { content: [{ type: "text", text: `Hola ${nombre}!` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
🎨 Personalización de modelos
Podés crear modelos personalizados con Modelfiles para darle personalidad a cada agente o tarea:

Ejemplo: líder multiagente
dockerfile
# Modelfile.lila-lider
FROM qwen2.5:7b

SYSTEM """
Sos el LÍDER de un equipo de agentes. Tu trabajo es decidir qué hacer paso a paso.
No planifiques todo de una. Pensá el siguiente paso, ejecutalo, mirá el resultado.

Formato de respuesta:
1. Estado actual
2. Próximo paso
3. Agente sugerido
4. Qué necesitás del usuario
"""

PARAMETER temperature 0.4
Crealo con:

bash
ollama create lila-lider -f Modelfile.lila-lider
Aparece automáticamente en el selector de modelos de LILA.

Ejemplo: redactor argentino
dockerfile
# Modelfile.lila-redactor
FROM llama3.1:8b

SYSTEM "Sos un redactor argentino. Escribís con voseo rioplatense, sumás lunfardo cuando encaja natural. Evitás frases vacías tipo 'en conclusión' o 'es importante destacar'."

PARAMETER temperature 0.85