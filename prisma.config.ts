import path from 'node:path'
import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { seed: 'tsx prisma/seed.ts' },
  experimental: { adapter: true },
  adapter: async () =>
    new PrismaLibSQL({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
})
