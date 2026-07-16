import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma

  // Dev-time check: attempt to connect once and log any connection error
  ;(async () => {
    try {
      await prisma.$connect()
      console.log('[prisma] dev: connected to database')
    } catch (err: any) {
      console.error('[prisma] dev: connection failed:', err.message || err)
    }
  })()
}