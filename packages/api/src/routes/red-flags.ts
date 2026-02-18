import type { FastifyInstance } from 'fastify'
import { prisma } from '@askrera/db'
import { NotFoundError } from '../lib/errors.ts'

export async function redFlagRoutes(fastify: FastifyInstance) {
	fastify.get('/api/v1/projects/:reraId/red-flags', async (request, reply) => {
		const { reraId } = request.params as { reraId: string }

		const project = await prisma.project.findUnique({
			where: { reraId },
			select: { id: true },
		})

		if (!project) {
			throw new NotFoundError(`Project with RERA ID '${reraId}' not found`)
		}

		const redFlags = await prisma.redFlag.findMany({
			where: { projectId: project.id },
			orderBy: { detectedAt: 'desc' },
		})

		return reply.send({
			data: redFlags.map((f) => ({
				id: f.id,
				flag_type: f.flagType,
				detected_at: f.detectedAt,
				resolved_at: f.resolvedAt,
				is_active: f.resolvedAt === null,
			})),
		})
	})
}
