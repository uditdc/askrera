export interface RetryOptions {
	maxRetries?: number
	backoffMs?: number
	shouldRetry?: (error: any) => boolean
}

const defaultShouldRetry = (error: any): boolean => {
	if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') return true
	if (error.message?.includes('fetch failed')) return true
	if (error.message?.includes('HTTP 5')) return true
	if (error.message?.toLowerCase().includes('network')) return true
	return false
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
	const { maxRetries = 3, backoffMs = 1000, shouldRetry = defaultShouldRetry } = options

	let lastError: any

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn()
		} catch (error: any) {
			lastError = error

			if (attempt === maxRetries || !shouldRetry(error)) {
				throw error
			}

			const delay = backoffMs * Math.pow(2, attempt)
			console.warn(
				`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms due to: ${error.message}`
			)
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}

	throw lastError
}
