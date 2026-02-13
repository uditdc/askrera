export const MAHA_CONFIG = {
	listingBaseUrl: 'https://maharera.maharashtra.gov.in/projects-search-result',
	detailBaseUrl: 'https://maharerait.maharashtra.gov.in/public/project/view/',
	apiBaseUrl:
		'https://maharerait.maharashtra.gov.in/api/maha-rera-public-view-project-registration-service/public/projectregistartion/',

	totalPages: 4655,
	dailyPages: 50,
	rateLimitMs: 1000,

	endpoints: ['getProjectGeneralDetailsByProjectId']
} as const

export function listingUrlPattern(page: number): string {
	return `${MAHA_CONFIG.listingBaseUrl}?project_state=27&page=${page}&op=`
}
