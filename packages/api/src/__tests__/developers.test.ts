import { describe, expect, test, mock, afterAll } from 'bun:test'

const mockPrisma = {
	$queryRaw: mock(async () => [{ '?column?': 1 }]),
	project: {
		findMany: mock(async () => []),
		findUnique: mock(async () => null),
		count: mock(async () => 0),
	},
	developer: {
		findUnique: mock(async () => null),
	},
	redFlag: {
		findMany: mock(async () => []),
	},
}

mock.module('@askrera/db', () => ({ prisma: mockPrisma }))

const { buildApp } = await import('../server.ts')

describe('GET /api/v1/developers/:id', () => {
	const app = buildApp()

	afterAll(() => app.close())

	test('returns 404 for unknown developer', async () => {
		mockPrisma.developer.findUnique.mockResolvedValue(null)

		const res = await app.inject({ method: 'GET', url: '/api/v1/developers/9999' })
		expect(res.statusCode).toBe(404)
		const body = res.json()
		expect(body.error).toBe('Not Found')
	})

	test('returns 400 for non-numeric id', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/v1/developers/abc' })
		expect(res.statusCode).toBe(400)
		const body = res.json()
		expect(body.error).toBe('Bad Request')
	})

	test('returns developer profile with aggregated stats', async () => {
		const now = new Date()
		const fakeDeveloper = {
			id: 1,
			canonicalName: 'Acme Builders',
			aliases: ['Acme', 'Acme Construction'],
			createdAt: now,
			projects: [
				{
					id: 1,
					reraId: 'P001',
					originalCompletion: new Date('2020-01-01'),
					proposedCompletion: new Date('2021-01-01'),
					litigations: [{ id: 1, status: 'open' }],
				},
				{
					id: 2,
					reraId: 'P002',
					originalCompletion: new Date('2022-01-01'),
					proposedCompletion: new Date('2022-01-01'),
					litigations: [],
				},
			],
		}

		mockPrisma.developer.findUnique.mockResolvedValue(fakeDeveloper)

		const res = await app.inject({ method: 'GET', url: '/api/v1/developers/1' })
		expect(res.statusCode).toBe(200)
		const body = res.json()
		expect(body.data.id).toBe(1)
		expect(body.data.name).toBe('Acme Builders')
		expect(body.data.aliases).toEqual(['Acme', 'Acme Construction'])
		expect(body.data.total_projects).toBe(2)
		expect(body.data.delayed_projects).toBe(1)
		expect(body.data.active_litigations).toBe(1)
		expect(body.data.compliance_score).toBeNull()
	})

	test('handles developer with no projects', async () => {
		const fakeDeveloper = {
			id: 2,
			canonicalName: 'New Builder',
			aliases: [],
			createdAt: new Date(),
			projects: [],
		}

		mockPrisma.developer.findUnique.mockResolvedValue(fakeDeveloper)

		const res = await app.inject({ method: 'GET', url: '/api/v1/developers/2' })
		expect(res.statusCode).toBe(200)
		const body = res.json()
		expect(body.data.total_projects).toBe(0)
		expect(body.data.delayed_projects).toBe(0)
		expect(body.data.active_litigations).toBe(0)
	})
})
