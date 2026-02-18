import Fastify from 'fastify'
import cors from '@fastify/cors'
import { errorHandler } from './lib/errors.ts'
import { healthRoutes } from './routes/health.ts'
import { projectRoutes } from './routes/projects.ts'
import { developerRoutes } from './routes/developers.ts'
import { redFlagRoutes } from './routes/red-flags.ts'
import { askRoutes } from './routes/ask.ts'

export function buildApp() {
	const fastify = Fastify({ logger: true })

	fastify.register(cors, { origin: '*' })

	const apiKey = process.env['API_KEY']
	if (apiKey) {
		fastify.addHook('preHandler', async (request, reply) => {
			const authHeader = request.headers['authorization']
			const xApiKey = request.headers['x-api-key']

			const provided =
				(typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
					? authHeader.slice(7)
					: null) ?? (typeof xApiKey === 'string' ? xApiKey : null)

			if (provided !== apiKey) {
				return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing API key' })
			}
		})
	}

	fastify.register(healthRoutes)
	fastify.register(projectRoutes)
	fastify.register(developerRoutes)
	fastify.register(redFlagRoutes)
	fastify.register(askRoutes)

	fastify.setErrorHandler(errorHandler)

	return fastify
}

const port = parseInt(process.env['PORT'] ?? '3000', 10)
const app = buildApp()

app.listen({ port, host: '0.0.0.0' }, (err) => {
	if (err) {
		app.log.error(err)
		process.exit(1)
	}
})
