import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

export class NotFoundError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'NotFoundError'
	}
}

export class ValidationError extends Error {
	details: unknown
	constructor(message: string, details?: unknown) {
		super(message)
		this.name = 'ValidationError'
		this.details = details
	}
}

export function errorHandler(
	error: FastifyError | Error,
	_request: FastifyRequest,
	reply: FastifyReply
) {
	if (error instanceof NotFoundError) {
		return reply.status(404).send({ error: 'Not Found', message: error.message })
	}

	if (error instanceof ValidationError) {
		return reply.status(400).send({
			error: 'Bad Request',
			message: error.message,
			details: error.details,
		})
	}

	const fastifyError = error as FastifyError
	if (fastifyError.statusCode === 400) {
		return reply.status(400).send({ error: 'Bad Request', message: error.message })
	}

	reply.status(500).send({ error: 'Internal Server Error', message: 'An unexpected error occurred' })
}
