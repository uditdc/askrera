import { test, expect } from 'vitest'
import { withRetry } from '../utils/retry'

test('withRetry succeeds on first attempt', async () => {
	let attempts = 0
	const result = await withRetry(async () => {
		attempts++
		return 'success'
	})

	expect(result).toBe('success')
	expect(attempts).toBe(1)
})

test('withRetry retries on network errors', async () => {
	let attempts = 0
	const result = await withRetry(
		async () => {
			attempts++
			if (attempts < 3) {
				throw new Error('fetch failed')
			}
			return 'success'
		},
		{ maxRetries: 3, backoffMs: 10 }
	)

	expect(result).toBe('success')
	expect(attempts).toBe(3)
})

test('withRetry throws after max retries', async () => {
	let attempts = 0
	try {
		await withRetry(
			async () => {
				attempts++
				throw new Error('HTTP 500: Internal Server Error')
			},
			{ maxRetries: 2, backoffMs: 10 }
		)
		expect(true).toBe(false)
	} catch (error: any) {
		expect(error.message).toContain('500')
		expect(attempts).toBe(3)
	}
})

test('withRetry does not retry non-network errors', async () => {
	let attempts = 0
	try {
		await withRetry(
			async () => {
				attempts++
				throw new Error('Invalid input')
			},
			{ maxRetries: 3, backoffMs: 10 }
		)
		expect(true).toBe(false)
	} catch (error: any) {
		expect(error.message).toBe('Invalid input')
		expect(attempts).toBe(1)
	}
})
