import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.ts'

const AskBodySchema = z.object({
	query: z.string().min(1),
	filters: z
		.object({
			city: z.string().optional(),
			rera_id: z.string().optional(),
		})
		.optional(),
})

export async function askRoutes(fastify: FastifyInstance) {
	fastify.post('/api/v1/ask', async (request, reply) => {
		const parsed = AskBodySchema.safeParse(request.body)
		if (!parsed.success) {
			throw new ValidationError('Invalid request body', parsed.error.flatten())
		}

		return reply.status(501).send({
			error: 'Not Implemented',
			message: 'RAG-based question answering is not yet implemented',
		})
	})
}
