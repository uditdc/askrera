import { MahaRERAListingScraper } from './listing'
import { MahaRERADetailScraper } from './detail'
import { MAHA_CONFIG } from './config'
import type { StateScraperConfig } from '../../types'

const maharashtra: StateScraperConfig = {
	name: 'maharashtra',
	displayName: 'Maharashtra',
	listing: new MahaRERAListingScraper(),
	detail: new MahaRERADetailScraper(),
	totalPages: MAHA_CONFIG.totalPages,
	dailyPages: MAHA_CONFIG.dailyPages
}

export default maharashtra
