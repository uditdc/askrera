export interface ListingProject {
	reraId: string
	projectName: string
	developer: string | null
	locationTaluka: string | null
	district: string | null
	pincode: string | null
	lastModified: Date | null
	internalId: number | null
	hasExtensionCert: boolean
}

export interface ListingScraper {
	scrapePage(page: number): Promise<ListingProject[]>
	saveProjects(projects: ListingProject[]): Promise<void>
}

export interface DetailScraper {
	processProject(internalId: number): Promise<void>
}

export interface StateScraperConfig {
	name: string
	displayName: string
	listing: ListingScraper
	detail: DetailScraper
	totalPages: number
	dailyPages: number
}
