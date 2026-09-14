// docs/modelos-lila.md

# Tabla Comparativa de Modelos Instalados en LILA

## 📊 Comparativa Completa (Ordenada por Tamaño)

| Modelo | Tamaño | Familia/Parámetros | Inteligencia | Mejor Uso en LILA | Notas |
|--------|--------|-------------------|--------------|-------------------|-------|
| nomic-embed-text:latest | 274 MB | Embeddings | N/A | RAG/Vectorización | No genera texto, solo embeddings para búsqueda semántica |
| qwen2.5:1.5b | 986 MB | Qwen 2.5 (1.5B) | Baja | Tareas ultra-rápidas, fallback | El más pequeño de generación de texto |
| llama3.2:1b | 1.3 GB | Llama 3.2 (1B) | Baja | Dispositivos limitados, pruebas | Muy básico, contexto 128K |
| gemma2:2b | 1.6 GB | Gemma 2 (2B) | Media-Baja | Respuestas rápidas, CPU-only | Google, eficiente en RAM |
| nichonauta/pepita-2-2b-it-v5:latest | 1.6 GB | Pepita (2B) | Media-Baja | Español nativo | Optimizado para español, mejor que Gemma 2 en ES |
| qwen2.5:3b | 1.9 GB | Qwen 2.5 (3B) | Media-Alta | Uso general rápido | Excelente equilibrio tamaño/calidad |
| llama3.2:3b | 2.0 GB | Llama 3.2 (3B) | Media-Alta | Uso general, balance velocidad | Meta, contexto 128K |
| lila-lider:latest | 2.0 GB | Personalizado | Media | Orquestador de agentes | Tu modelo personalizado para el Agente Líder |
| lila-argenta:latest | 2.0 GB | Personalizado | Media | Consultas financieras | Tu modelo personalizado para finanzas |
| luepow/thau:latest | 2.2 GB | Thau (3B) | Media | Uso general alternativo | Modelo personalizado de la comunidad |
| argenta:26 | 2.2 GB | Argenta (3B) | Media-Alta | Finanzas, español | Especializado en contexto financiero español |
| phi3:mini | 2.2 GB | Phi-3 Mini (3.8B) | Alta | Programación, análisis | Microsoft, contexto 128K, muy capaz |
| phi4-mini:latest | 2.5 GB | Phi-4 Mini (3.8B) | Alta | Programación, razonamiento | Microsoft, el mejor <3GB para código |
| gemma3:latest | 3.3 GB | Gemma 3 (4B) | Alta | Multimodal, español | Google, soporta visión, 140+ idiomas |
| deepseek-coder:6.7b | 3.8 GB | DeepSeek Coder (6.7B) | Alta | Código especializado | Excelente para programación, más rápido que 7B |
| mistral:7b-instruct-q4_K_M | 4.4 GB | Mistral 7B (cuantizado) | Alta | Uso general, instrucciones | Versión cuantizada, más rápido que el completo |
| mistral:7b | 4.4 GB | Mistral 7B | Alta | Uso general, europeo | Francés, muy bueno en idiomas europeos |
| deepseek-r1:7b | 4.7 GB | DeepSeek R1 (7B) | Muy Alta | Razonamiento complejo | Modelo de razonamiento, ideal para lógica/matemáticas |
| llama3:latest | 4.7 GB | Llama 3 (8B) | Alta | Uso general, versátil | Meta, primera generación Llama 3 |
| lila-escritor:latest | 4.7 GB | Personalizado | Alta | Redacción profesional | Tu modelo personalizado para escritura |
| lila-coder:latest | 4.7 GB | Personalizado | Alta | Programación avanzada | Tu modelo personalizado para código |
| qwen2.5-coder:7b | 4.7 GB | Qwen 2.5 Coder (7B) | Muy Alta | Código profesional | El mejor para programación en 7B |
| qwen2.5:7b | 4.7 GB | Qwen 2.5 (7B) | Alta | Uso general, conocimiento | Alibaba, entrenado en 18T tokens |
| llama3.1:8b | 4.9 GB | Llama 3.1 (8B) | Muy Alta | Uso general premium | Meta, el más grande y capaz de tu lista |

---

## 🎯 Asignación Recomendada de Agentes en LILA

| Agente | Modelo Recomendado | Alternativa Rápida | Justificación |
|--------|-------------------|-------------------|---------------|
| **Programador** | qwen2.5-coder:7b | phi4-mini:latest | Mejor en código dentro de 7B |
| **Analista** | deepseek-r1:7b | phi3:mini | Mejor razonamiento lógico |
| **Redactor** | lila-escritor:latest | llama3.1:8b | Tu modelo personalizado |
| **Abogado/Financiero** | argenta:26 | lila-argenta:latest | Especializado en español/finanzas |
| **Médico** | gemma3:latest | llama3.1:8b | Multilingüe y preciso |
| **Líder (Orquestador)** | lila-lider:latest | phi4-mini:latest | Tu modelo personalizado |
| **Fallback** | qwen2.5:3b | qwen2.5:1.5b | Rápido y decente |
| **Embeddings (RAG)** | nomic-embed-text | - | Único para vectorización |

---

## 💾 Estrategia de Optimización de Memoria

### Espacio Total Ocupado: ~65 GB (24 modelos)

### 🗑️ Duplicados a Eliminar (~10 GB liberados)

```bash
# Mistral duplicado (quédate con el cuantizado, más rápido)
ollama rm mistral:7b

# Llama 3 antiguo (reemplazado por 3.1, más capaz)
ollama rm llama3:latest

# Phi-3 Mini (reemplazado por Phi-4 Mini, más nuevo)
ollama rm phi3:mini