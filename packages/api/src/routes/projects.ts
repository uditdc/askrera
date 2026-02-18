import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@askrera/db'
import { NotFoundError, ValidationError } from '../lib/errors.ts'
import { PaginationSchema, paginationArgs, paginationMeta } from '../lib/pagination.ts'
import { serializeProject, serializeProjectListItem } from '../lib/serializers.ts'

const ProjectsQuerySchema = PaginationSchema.extend({
	district: z.string().optional(),
	developer: z.string().optional(),
	status: z.string().optional(),
	is_lapsed: z.coerce.boolean().optional(),
	q: z.string().optional(),
})

export async function projectRoutes(fastify: FastifyInstance) {
	fastify.get('/api/v1/projects', async (request, reply) => {
		const parsed = ProjectsQuerySchema.safeParse(request.query)
		if (!parsed.success) {
			throw new ValidationError('Invalid query parameters', parsed.error.flatten())
		}

		const { district, developer, status, is_lapsed, q, ...pagination } = parsed.data

		const where = {
			...(district && { district: { contains: district, mode: 'insensitive' as const } }),
			...(status && { currentStatus: { contains: status, mode: 'insensitive' as const } }),
			...(is_lapsed !== undefined && { isLapsed: is_lapsed }),
			...(developer && {
				developer: { canonicalName: { contains: developer, mode: 'insensitive' as const } },
			}),
			...(q && {
				OR: [
					{ name: { contains: q, mode: 'insensitive' as const } },
					{ reraId: { contains: q, mode: 'insensitive' as const } },
					{ district: { contains: q, mode: 'insensitive' as const } },
				],
			}),
		}

		const [projects, total] = await Promise.all([
			prisma.project.findMany({
				where,
				include: { developer: true },
				orderBy: { lastSynced: 'desc' },
				...paginationArgs(pagination),
			}),
			prisma.project.count({ where }),
		])

		return reply.send({
			data: projects.map(serializeProjectListItem),
			pagination: paginationMeta(total, pagination),
		})
	})

	fastify.get('/api/v1/projects/:reraId', async (request, reply) => {
		const { reraId } = request.params as { reraId: string }

		const project = await prisma.project.findUnique({
			where: { reraId },
			include: {
				developer: true,
				litigations: true,
				filings: true,
				redFlags: { orderBy: { detectedAt: 'desc' } },
			},
		})

		if (!project) {
			throw new NotFoundError(`Project with RERA ID '${reraId}' not found`)
		}

		return reply.send({ data: serializeProject(project) })
	})
}
