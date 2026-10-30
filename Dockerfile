# Node 24 incluye el soporte de SQLite utilizado por la aplicación.
FROM node:24-bookworm-slim

WORKDIR /app

# Instala las versiones fijadas antes de copiar el código.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY documentos ./documentos
RUN npm run build && mkdir -p data node_modules/@huggingface/transformers/.cache \
    && chown -R node:node /app

# La base y la caché del modelo deben poder escribirse sin usar root.
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
