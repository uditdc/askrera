import { describe, expect, test, mock, beforeAll, afterAll } from 'bun:test'

const mockPrisma = {
	$queryRaw: mock(async () => [{ '?column?': 1 }]),
	project: {
		findMany: mock(async () => []),
		findUnique: mock(async () => null),
		count: mock(async () => 0),
	},
	redFlag: {
		findMany: mock(async () => []),
	},
}

mock.module('@askrera/db', () => ({ prisma: mockPrisma }))

const { buildApp } = await import('../server.ts')

describe('GET /health', () => {
	const app = buildApp()

	afterAll(() => app.close())

	test('returns 200 with status ok', async () => {
		const res = await app.inject({ method: 'GET', url: '/health' })
		expect(res.statusCode).toBe(200)
		const body = res.json()
		expect(body.status).toBe('ok')
		expect(typeof body.timestamp).toBe('string')
	})

	test('includes CORS headers', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/health',
			headers: { origin: 'http://example.com' },
		})
		expect(res.headers['access-control-allow-origin']).toBe('*')
	})
})

describe('GET /api/v1/projects', () => {
	const app = buildApp()

	afterAll(() => app.close())

	test('returns 200 with empty data', async () => {
		mockPrisma.project.findMany.mockResolvedValue([])
		mockPrisma.project.count.mockResolvedValue(0)

		const res = await app.inject({ method: 'GET', url: '/api/v1/projects' })
		expect(res.statusCode).toBe(200)
		const body = res.json()
		expect(Array.isArray(body.data)).toBe(true)
		expect(body.pagination).toBeDefined()
		expect(body.pagination.total).toBe(0)
		expect(body.pagination.page).toBe(1)
		expect(body.pagination.limit).toBe(20)
	})

	test('accepts pagination params', async () => {
		mockPrisma.project.findMany.mockResolvedValue([])
		mockPrisma.project.count.mockResolvedValue(50)

		const res = await app.inject({ method: 'GET', url: '/api/v1/projects?page=2&limit=10' })
		expect(res.statusCode).toBe(200)
		const body = res.json()
		expect(body.pagination.page).toBe(2)
		expect(body.pagination.limit).toBe(10)
		expect(body.pagination.total).toBe(50)
		expect(body.pagination.total_pages).toBe(5)
	})

	test('returns 400 for invalid pagination', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/v1/projects?limit=999' })
		expect(res.statusCode).toBe(400)
	})

	test('returns serialized project list items', async () => {
		const fakeProject = {
			id: 1,
			reraId: 'P12345',
			name: 'Test Project',
			currentStatus: 'active',
			statusName: 'Active',
			district: 'Mumbai',
			taluka: null,
			pincode: null,
			registrationDate: new Date('2020-01-01'),
			proposedCompletion: new Date('2022-01-01'),
			originalCompletion: new Date('2021-01-01'),
			isLapsed: false,
			isMigrated: false,
			lastSynced: new Date(),
			developer: { id: 1, canonicalName: 'Test Developer', aliases: [], createdAt: new Date() },
			projectType: null,
			applicationDate: null,
			certGenerationDate: null,
			ackNumber: null,
			totalUnits: null,
			soldUnits: null,
			feesPayable: null,
			grossFees: null,
			isBuilding: false,
			certDmsRef: null,
			extensionCertRef: null,
			promoterTypeId: null,
			locationId: null,
			lastModifiedListing: null,
			rawApiResponse: null,
			internalId: 1,
			developerId: 1,
		}

		mockPrisma.project.findMany.mockResolvedValue([fakeProject])
		mockPrisma.project.count.mockResolvedValue(1)

		const res = await app.inject({ method: 'GET', url: '/api/v1/projects' })
		expect(res.statusCode).toBe(200)
		const body = res.json()
		expect(body.data).toHaveLength(1)
		expect(body.data[0].rera_id).toBe('P12345')
		expect(body.data[0].developer_name).toBe('Test Developer')
	})
})

describe('GET /api/v1/projects/:reraId', () => {
	const app = buildApp()

	afterAll(() => app.close())

	test('returns 404 for unknown reraId', async () => {
		mockPrisma.project.findUnique.mockResolvedValue(null)

		const res = await app.inject({ method: 'GET', url: '/api/v1/projects/UNKNOWN' })
		expect(res.statusCode).toBe(404)
		const body = res.json()
		expect(body.error).toBe('Not Found')
	})

	test('returns 200 with project detail', async () => {
		const fakeProject = {
			id: 1,
			reraId: 'P12345',
			name: 'Test Project',
			currentStatus: 'active',
			statusName: 'Active',
			district: 'Mumbai',
			taluka: null,
			pincode: null,
			registrationDate: new Date('2020-01-01'),
			proposedCompletion: new Date('2022-01-01'),
			originalCompletion: new Date('2021-01-01'),
			applicationDate: null,
			certGenerationDate: null,
			isLapsed: false,
			isMigrated: false,
			lastSynced: new Date(),
			projectType: null,
			ackNumber: null,
			totalUnits: 10,
			soldUnits: 5,
			feesPayable: null,
			grossFees: null,
			isBuilding: false,
			certDmsRef: null,
			extensionCertRef: null,
			promoterTypeId: null,
			locationId: null,
			lastModifiedListing: null,
			rawApiResponse: null,
			internalId: 1,
			developerId: 1,
			developer: { id: 1, canonicalName: 'Test Developer', aliases: [], createdAt: new Date() },
			litigations: [],
			filings: [],
			redFlags: [],
		}

		mockPrisma.project.findUnique.mockResolvedValue(fakeProject)

		const res = await app.inject({ method: 'GET', url: '/api/v1/projects/P12345' })
		expect(res.statusCode).toBe(200)
		const body = res.json()
		expect(body.data.rera_id).toBe('P12345')
		expect(body.data.litigation_count).toBe(0)
		expect(body.data.active_red_flags).toEqual([])
	})
})

describe('GET /api/v1/projects/:reraId/red-flags', () => {
	const app = buildApp()

	afterAll(() => app.close())

	test('returns 404 when project not found', async () => {
		mockPrisma.project.findUnique.mockResolvedValue(null)

		const res = await app.inject({ method: 'GET', url: '/api/v1/projects/UNKNOWN/red-flags' })
		expect(res.statusCode).toBe(404)
	})

	test('returns red flags for project', async () => {
		mockPrisma.project.findUnique.mockResolvedValue({ id: 1 })
		const now = new Date()
		mockPrisma.redFlag.findMany.mockResolvedValue([
			{ id: 1, flagType: 'project_lapsed', detectedAt: now, resolvedAt: null, projectId: 1 },
		])

		const res = await app.inject({ method: 'GET', url: '/api/v1/projects/P12345/red-flags' })
		expect(res.statusCode).toBe(200)
		const body = res.json()
		expect(body.data).toHaveLength(1)
		expect(body.data[0].flag_type).toBe('project_lapsed')
		expect(body.data[0].is_active).toBe(true)
	})
})

describe('POST /api/v1/ask', () => {
	const app = buildApp()

	afterAll(() => app.close())

	test('returns 501 for valid request', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/ask',
			payload: { query: 'show me delayed projects in Mumbai' },
		})
		expect(res.statusCode).toBe(501)
	})

	test('returns 400 for missing query', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/ask',
			payload: {},
		})
		expect(res.statusCode).toBe(400)
	})

	test('accepts optional filters', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/ask',
			payload: { query: 'test', filters: { city: 'Mumbai', rera_id: 'P123' } },
		})
		expect(res.statusCode).toBe(501)
	})
})
