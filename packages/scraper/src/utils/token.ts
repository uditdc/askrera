export class TokenManager {
	private token: string | null = null
	private expiry: number | null = null

	setToken(token: string, expiresInMinutes: number = 100) {
		this.token = token
		// Set expiry to 5 minutes before actual expiry to be safe
		this.expiry = Date.now() + (expiresInMinutes - 5) * 60 * 1000
		console.log(`JWT Token updated. Expires at: ${new Date(this.expiry).toISOString()}`)
	}

	getToken(): string | null {
		if (!this.token || !this.expiry || Date.now() > this.expiry) {
			return null
		}
		return this.token
	}

	isExpired(): boolean {
		return !this.token || !this.expiry || Date.now() > this.expiry
	}
}

export const tokenManager = new TokenManager()
