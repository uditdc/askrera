import { prisma } from '@askrera/db'
import type { StateScraperConfig } from './types'

export type ScrapeMode = 'daily' | 'full' | 'test'

interface ListingOptions {
	startPage: number
	endPage: number
	isFullCrawl: boolean
	rateLimitMs: number
}

export async function runListingPhase(config: StateScraperConfig, options: ListingOptions) {
	console.log(
		`[${config.displayName}] Starting ${options.isFullCrawl ? 'FULL' : 'INCREMENTAL'} scrape from page ${options.startPage} to ${options.endPage}`
	)

	let consecutiveEmptyPages = 0

	for (let page = options.startPage; page <= options.endPage; page++) {
		const projects = await config.listing.scrapePage(page)
		if (projects.length > 0) {
			await config.listing.saveProjects(projects)
			console.log(`[${config.displayName}] Scraped ${projects.length} projects from page ${page}`)
			consecutiveEmptyPages = 0
		} else {
			consecutiveEmptyPages++
			console.warn(
				`[${config.displayName}] No projects found on page ${page} (${consecutiveEmptyPages} consecutive empty pages)`
			)
			if (consecutiveEmptyPages >= 3) {
				console.warn(`[${config.displayName}] Stopping after 3 consecutive empty pages`)
				break
			}
		}

		const jitter = Math.random() * 500
		await new Promise((resolve) => setTimeout(resolve, options.rateLimitMs + jitter))
	}
	console.log(`[${config.displayName}] Listing scrape completed.`)
}

export async function runDetailPhase(config: StateScraperConfig, batchSize: number = 50) {
	console.log(`[${config.displayName}] Checking for projects requiring detail scrape...`)

	let totalProcessed = 0
	let hasMore = true

	while (hasMore) {
		const pendingProjects = await prisma.$queryRaw<
			Array<{
				id: number
				rera_id: string
				internal_id: number | null
			}>
		>`
      SELECT id, rera_id, internal_id
      FROM projects_listing
      WHERE detail_scraped_at IS NULL
         OR (last_modified IS NOT NULL AND last_modified > detail_scraped_at)
      LIMIT ${batchSize}
    `

		if (pendingProjects.length === 0) {
			hasMore = false
			break
		}

		console.log(`[${config.displayName}] Processing batch of ${pendingProjects.length} projects...`)

		for (const p of pendingProjects) {
			if (p.internal_id) {
				try {
					await config.detail.processProject(p.internal_id)
					totalProcessed++
				} catch (error) {
					console.error(
						`[${config.displayName}] Error processing project ${p.rera_id} (${p.internal_id}):`,
						error
					)
				}
			}
		}

		if (pendingProjects.length < batchSize) {
			hasMore = false
		}
	}

	console.log(
		`[${config.displayName}] Detail scrape completed. Processed ${totalProcessed} projects total.`
	)
}

export async function runPipeline(config: StateScraperConfig, mode: ScrapeMode) {
	console.log(`[${config.displayName}] Starting AskRera Scraper in ${mode} mode...`)

	let startPage = 1
	let endPage = 1
	let isFullCrawl = false

	if (mode === 'daily') {
		endPage = config.dailyPages
	} else if (mode === 'full') {
		endPage = config.totalPages
		isFullCrawl = true
	} else if (mode === 'test') {
		endPage = 1
	}

	await runListingPhase(config, {
		startPage,
		endPage,
		isFullCrawl,
		rateLimitMs: 1000
	})

	await runDetailPhase(config)

	console.log(`[${config.displayName}] Scraper run completed.`)
}
