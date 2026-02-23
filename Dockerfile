# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Build-time env so config parse passes (NODE_ENV=production); runtime uses real env from compose/run
ENV POSTGRES_USER=build
ENV POSTGRES_PASSWORD=build
ENV POSTGRES_DB=build
ENV BETTER_AUTH_SECRET="build-time-placeholder-minimum-32-characters"
RUN npx prisma generate && npm run build

# Stage 2: run
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/public ./public
COPY --from=builder /app/types ./types

EXPOSE 3000

CMD ["npm", "start"]
