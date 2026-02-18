import type { FastifyInstance } from 'fastify'
import { prisma } from '@askrera/db'
import { NotFoundError, ValidationError } from '../lib/errors.ts'
import { serializeDeveloper } from '../lib/serializers.ts'

export async function developerRoutes(fastify: FastifyInstance) {
	fastify.get('/api/v1/developers/:id', async (request, reply) => {
		const rawId = (request.params as { id: string }).id
		const id = parseInt(rawId, 10)

		if (isNaN(id)) {
			throw new ValidationError(`Invalid developer ID: '${rawId}'`)
		}

		const developer = await prisma.developer.findUnique({
			where: { id },
			include: {
				projects: {
					include: { litigations: true },
				},
			},
		})

		if (!developer) {
			throw new NotFoundError(`Developer with ID '${id}' not found`)
		}

		return reply.send({ data: serializeDeveloper(developer) })
	})
}
