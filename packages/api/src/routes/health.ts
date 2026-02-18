import type { FastifyInstance } from 'fastify'
import { prisma } from '@askrera/db'

export async function healthRoutes(fastify: FastifyInstance) {
	fastify.get('/health', async (_request, reply) => {
		try {
			await prisma.$queryRaw`SELECT 1`
			return reply.send({ status: 'ok', timestamp: new Date().toISOString() })
		} catch {
			return reply.status(503).send({ status: 'error', timestamp: new Date().toISOString() })
		}
	})
}
