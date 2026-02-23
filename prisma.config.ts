import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

const e = process.env
const urlFromPostgres =
  e.POSTGRES_USER && e.POSTGRES_DB
    ? `postgresql://${encodeURIComponent(e.POSTGRES_USER)}:${encodeURIComponent(e.POSTGRES_PASSWORD ?? "")}@${e.POSTGRES_HOST ?? "localhost"}:${e.POSTGRES_PORT ?? "5432"}/${e.POSTGRES_DB}`
    : ""
if (urlFromPostgres && !e.DATABASE_URL) {
  process.env.DATABASE_URL = urlFromPostgres
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
