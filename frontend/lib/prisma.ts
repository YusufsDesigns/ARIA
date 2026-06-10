import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter } as any)
}

export const prisma: PrismaClient =
  globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
