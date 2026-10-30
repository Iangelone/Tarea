# Guía para agentes

## Idea del proyecto

Es una demo de un backoffice para un equipo de soporte de una empresa ficticia. Permite registrar reclamos, clasificarlos por categoría y prioridad, y consultar documentación interna mediante un chat (RAG).

## Stack

- TypeScript con backend en Node.js; framework a definir.
- Docker Compose para levantar la aplicación.
- IA: modelo de decisiones para clasificar.
- Modo mock o modelo local para probar sin una API paga.

- [LangChain](https://docs.langchain.com/): búsqueda de documentos para RAG.
- [AI SDK](https://ai-sdk.dev/docs): integración de modelos para clasificación y chat.
- [Agent Plugins](https://agent-plugins.org/): plugins reutilizables para agentes, si se necesitan.

## Convención de commits

- Crear un commit por cada cambio lógico y completo solo con permiso del usuario; revisar el diff y las verificaciones pertinentes antes de hacerlo.
- Usar `tipo(alcance): descripción`, con alcance opcional y descripción directa y natural, breve en español.
- Tipos comunes: `feat`, `fix`, `docs`, `refactor`, `test` y `chore`.
