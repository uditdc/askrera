import { describe, expect, test } from 'bun:test'
import { paginationArgs, paginationMeta } from '../lib/pagination.ts'
import { NotFoundError, ValidationError } from '../lib/errors.ts'

describe('paginationMeta', () => {
	test('calculates total_pages correctly', () => {
		expect(paginationMeta(100, { page: 1, limit: 20 })).toEqual({
			total: 100,
			page: 1,
			limit: 20,
			total_pages: 5,
		})
	})

	test('rounds up for partial pages', () => {
		expect(paginationMeta(21, { page: 1, limit: 20 })).toEqual({
			total: 21,
			page: 1,
			limit: 20,
			total_pages: 2,
		})
	})

	test('returns 0 total_pages when total is 0', () => {
		expect(paginationMeta(0, { page: 1, limit: 20 }).total_pages).toBe(0)
	})

	test('reflects current page', () => {
		expect(paginationMeta(100, { page: 3, limit: 10 }).page).toBe(3)
	})
})

describe('paginationArgs', () => {
	test('first page has skip 0', () => {
		expect(paginationArgs({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 })
	})

	test('second page skips one page worth', () => {
		expect(paginationArgs({ page: 2, limit: 20 })).toEqual({ skip: 20, take: 20 })
	})

	test('custom limit', () => {
		expect(paginationArgs({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 })
	})
})

describe('error classes', () => {
	test('NotFoundError has correct name', () => {
		const err = new NotFoundError('test')
		expect(err.name).toBe('NotFoundError')
		expect(err.message).toBe('test')
		expect(err instanceof Error).toBe(true)
	})

	test('ValidationError carries details', () => {
		const details = { field: 'query' }
		const err = new ValidationError('bad input', details)
		expect(err.name).toBe('ValidationError')
		expect(err.details).toEqual(details)
		expect(err instanceof Error).toBe(true)
	})
})
