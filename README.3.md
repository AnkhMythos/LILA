Roadmap
Completado
☑ Chat básico con Ollama
☑ Sistema multiagente con 6 roles
☑ Voz bidireccional
☑ Cliente MCP con toggle
☑ RAG con SQLite FTS5
☑ WebSocket con broadcast
☑ Chat entre instancias con límite de cadena
☑ Noticias, Wikipedia, Wikidata, clima
☑ Ejecución de Python
☑ Modelfiles personalizados
Próximamente
□ Bucle iterativo del líder multiagente (Fase 2)
□ Estado del proyecto persistente en SQLite
□ RAG con embeddings semánticos (nomic-embed-text)
□ Streaming de pasos del multiagente en vivo
□ Paralelización de subtareas independientes
□ Más servidores MCP de ejemplo (filesystem, SQLite)
□ Interfaz de administración de servidores MCP
□ Sistema de plugins para comandos
□ Modo "proyecto" para tareas de múltiples pasos
🤝 Contribuir
Hacé un fork del proyecto.

Creá una rama para tu feature (git checkout -b feature/nueva-capacidad).

Commiteá tus cambios (git commit -am 'Agrega X').

Pusheá (git push origin feature/nueva-capacidad).

Abrí un Pull Request.

Estructura de commits recomendada
feat: nueva funcionalidad

fix: corrección de bug

docs: cambios en documentación

refactor: reestructuración de código

test: agregado de tests

📄 Licencia
MIT. Ver LICENSE para más detalles.

🙏 Agradecimientos
Ollama — motor de inferencia local

Anthropic MCP SDK — protocolo de herramientas

Web Speech API — voz del navegador

Better SQLite3 — persistencia

Comunidad open source por las herramientas que hacen esto posible

📞 Contacto
Issues: github.com/tu-usuario/LILA/issues

Discussions: github.com/tu-usuario/LILA/discussions

🧉 LILA — Tu asistente de IA, corriendo en tu propia máquina. Sin dependencias de la nube, sin compromisos con tu privacidad.

text

---

## 📋 Notas para vos

**Antes de subirlo al repo:**

1. **Reemplazá `tu-usuario`** por tu usuario real de GitHub en las URLs de los badges y links.
2. **Ajustá la sección de requisitos** si tu proyecto tiene más dependencias que las que figuran.
3. **Verificá que exista `LICENSE`** con la licencia MIT. Si no existe, agregalo.
4. **Opcional:** agregá capturas de pantalla en la sección "¿Qué es LILA?" usando `![Screenshot](ruta/a/imagen.png)`.
5. **Opcional:** agregá un `.gitignore` que excluya `node_modules/`, `backend/data/`, `*.db`, `*.db-wal`, `*.db-shm`.

**Cosas que el README asume y conviene revisar:**

- Que el repo se llama `LILA` y está en GitHub.
- Que la licencia es MIT (ajustala si no lo es).
- Que los comandos listados son los que realmente tenés implementados (revisá la lista).
- Que el endpoint `/api/health/full` existe (lo agregamos en la última sesión).
- Que los Modelfiles son funcionales (recién creaste el de `lila-lider`).

Pendiente generar
- Un `LICENSE` en formato MIT.
- Un `.gitignore` completo.
- Un `CONTRIBUTING.md` con guía más detallada.
- Un `CHANGELOG.md` con el historial de versiones.


🙏 Agradecimientos
Ollama — motor de inferencia local

Anthropic MCP SDK — protocolo de herramientas

Web Speech API — voz del navegador

Better SQLite3 — persistencia

Comunidad open source por las herramientas que hacen esto posible

📞 Contacto
Issues: github.com/tu-usuario/LILA/issues

Discussions: github.com/tu-usuario/LILA/discussions