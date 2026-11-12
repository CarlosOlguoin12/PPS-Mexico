# Una sola web pública: React compilado + API Express + SQLite en Volume.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY servidor/package.json servidor/package-lock.json ./servidor/
RUN npm --prefix servidor ci --omit=dev
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/basedatos ./basedatos
COPY --from=build /app/servidor ./servidor
EXPOSE 3000
CMD ["node", "servidor/index.js"]
