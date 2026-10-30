# Tarea para el hogar — Proyecto TypeScript con IA

**Entrega:** el lunes de la semana siguiente a la entrevista.
**Presentación:** demo de 20–30 minutos, donde nos mostrás qué hace y cómo está construido.
**Esfuerzo estimado:** 8–12 horas.

## Requisitos

1. Aplicación en **TypeScript**. Backend obligatorio (Node / NestJS o similar); el front es opcional.
2. Al menos una funcionalidad que use **inteligencia artificial** de forma útil, no decorativa.
3. Tiene que levantar con un solo comando: `docker compose up`.
4. Las API keys van por variables de entorno, con un `.env.example`. Nunca las subas al repo.
5. Tiene que poder probarse sin una key paga: con un modo mock o un modelo local (por ejemplo, Ollama).
6. Un `README.md` con:
   - qué hace la aplicación,
   - cómo levantarla,
   - por qué elegiste ese stack y qué decisiones técnicas tomaste,
   - qué mejorarías si tuvieras más tiempo.
7. Entrega: link a un repositorio (GitHub o GitLab) con el historial de commits.
8. Podés usar asistentes de IA para programar, pero tenés que declararlo y poder explicar cada parte del código.

## Ideas, si no tenés una propia

- Clasificador de reclamos o tickets de soporte por prioridad y categoría.
- Resumidor de notas de reunión que extrae tareas y responsables.
- Chat sobre documentos (RAG) de una empresa ficticia.

## Qué vamos a mirar

Que levante con Docker, cómo resolviste la parte de IA, la calidad del código TypeScript,
los tests, el README y cómo defendés tus decisiones en la demo.
