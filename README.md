# Demo: clasificación de tickets y chat sobre documentos

Aplicación de demostración para una empresa ficticia. Permite registrar reclamos, clasificarlos por categoría y prioridad, y consultar documentos de soporte mediante un chat con recuperación de información (RAG).

La interfaz permite enviar reclamos, consultar los tickets guardados y conversar con el asistente. En modo gateway, el asistente también puede crear, consultar, editar y borrar tickets por solicitud del usuario. Los documentos incluidos cubren acceso, facturación, seguridad y soporte técnico. Es una **demo**, no una aplicación preparada para producción.

## Inicio rápido

### Requisitos

- Docker con Docker Compose y el motor de Docker iniciado.
- Conexión a internet en la primera ejecución para descargar la imagen, las dependencias y el modelo local de embeddings.
- Puerto `3000` disponible.

Desde la raíz del proyecto:

```bash
docker compose up
```

Abrir [http://localhost:3000](http://localhost:3000) cuando aparezca `Servidor disponible`. La primera ejecución puede tardar varios minutos mientras prepara el índice de documentos. En una instalación nueva, sin `.env` ni variables externas, se utiliza el modo `mock`, sin clave de API.

En la interfaz, seleccionar **Tickets** para clasificar un reclamo o **Chat** para consultar los documentos. En modo mock, el clasificador usa reglas y el chat devuelve un fragmento recuperado, sin generar una respuesta con un LLM ni ejecutar operaciones CRUD desde el chat.

Para detener la aplicación, presionar `Ctrl+C`; para eliminar los contenedores y la red sin borrar los volúmenes:

```bash
docker compose down
```

Después de modificar código o documentos, reconstruir la imagen con `docker compose up --build`. Los documentos se copian dentro de la imagen; no se actualizan automáticamente en un contenedor ya construido.

## Configuración de modelos

Para usar los modelos reales de OpenRouter, copiar `.env.example` a `.env`, cambiar `AI_MODE` a `gateway` y colocar la clave de OpenRouter:

```dotenv
AI_MODE=gateway
OPENROUTER_API_KEY=tu_clave
DECISION_MODEL=typesafe/jev-1.13
CHAT_MODEL=deepseek/deepseek-v4.1-flash-1017
```

El modelo local de embeddings es `Xenova/multilingual-e5-small` cuantizado en `q8`. Actualmente está definido en el código y no se configura mediante `.env`.

## Diseño técnico

- **Backend:** Node.js 24 y TypeScript, con el servidor HTTP nativo para mantener una API pequeña y sin framework adicional.
- **Clasificación:** en modo gateway, Jev recibe en una llamada las opciones de categoría y prioridad mediante la API de decisiones de OpenRouter. La salida se valida antes de guardar el ticket. En modo mock se aplican reglas locales.
- **RAG:** LangChain divide los documentos Markdown en fragmentos; Transformers.js genera embeddings localmente. Al iniciar, el indexador usa una huella y una versión para actualizar los documentos nuevos o modificados y retirar los eliminados. Los fragmentos y sus vectores se almacenan en SQLite; la búsqueda ordena los resultados por similitud coseno.
- **Chat:** LangChain conecta el modelo con herramientas para consultar documentos y crear, consultar, editar o borrar tickets cuando el usuario lo solicita. La respuesta incluye las fuentes consultadas. La interfaz envía los mensajes recientes para dar contexto; el historial no se persiste y se pierde al recargar.
- **Persistencia:** SQLite usa el módulo `node:sqlite`. Compose conserva la base y la caché del modelo en volúmenes separados. La base local y las claves están excluidas de Git.
- **Interfaz:** HTML, CSS y JavaScript sin framework, servidos por el backend.

La API expone `POST /clasificar` con `{ "texto": "..." }`, `GET /tickets` y `POST /chat` con `{ "pregunta": "...", "historial": [] }`. El historial es opcional y admite mensajes de usuario y asistente.

## Desarrollo y verificaciones

Con Node.js 24 instalado:

```bash
npm ci
npm run build
npm start
```

Sin `.env`, el servidor utiliza el modo mock. En ejecución local, la base se crea por defecto en `data/tickets.db`; puede cambiarse con `DATABASE_PATH`. La primera indexación también descarga el modelo de embeddings.

```bash
npm test              # Pruebas con Vitest
npm run lint          # ESLint
npm run format:check  # Comprobar formato
npm run format        # Aplicar Prettier
```

Las pruebas automatizadas cubren el clasificador mock, SQLite y casos del chat mock. No evalúan la calidad de los modelos reales ni requieren una clave.

Para evaluar los modelos reales con ejemplos ficticios, configurar `OPENROUTER_API_KEY` y ejecutar:

```bash
npm run eval
```

La evaluación usa una base SQLite temporal en memoria y realiza llamadas de pago a OpenRouter. Compara categoría y prioridad con etiquetas esperadas, mide si la fuente esperada aparece entre los fragmentos recuperados y muestra las respuestas del chat para revisión manual, incluida una pregunta fuera de los documentos. Es una muestra pequeña, no una medición representativa. No forma parte de `npm test`.

## Limitaciones y mejoras

- Evaluar la clasificación con un conjunto de reclamos etiquetados y ajustar las prioridades: el modelo anterior clasificó una contraseña olvidada como crítica; Jev requiere su propia evaluación.
- Evaluar la recuperación y las respuestas fuera de los documentos; la similitud siempre ordena fragmentos y no garantiza que sean pertinentes. Las fuentes mostradas son las consultadas, no citas verificadas.
- Mejorar el manejo de errores y límites de uso del proveedor; una pregunta con herramientas puede requerir varias llamadas al modelo.
- Ampliar las pruebas de integración y de interfaz, incluyendo el comportamiento del chat con herramientas y el modelo real.
- Para un uso real, agregar autenticación, controles de acceso y observabilidad, además de revisar privacidad y seguridad de los datos.

## Uso de asistentes de IA

Se utilizó Codex como asistente para desarrollar, probar y documentar el proyecto.
