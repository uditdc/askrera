import * as cheerio from 'cheerio'
import { z } from 'zod'
import { withRetry } from '../../utils/retry'
import { listingUrlPattern } from './config'
import type { ListingProject, ListingScraper } from '../../types'
import { prisma } from '@askrera/db'

const ProjectSchema = z.object({
	reraId: z.string(),
	projectName: z.string(),
	developer: z.string().nullable(),
	locationTaluka: z.string().nullable(),
	district: z.string().nullable(),
	pincode: z.string().nullable(),
	lastModified: z.date().nullable(),
	internalId: z.number().nullable(),
	hasExtensionCert: z.boolean()
})

export function parseListingHtml(html: string): ListingProject[] {
	const $ = cheerio.load(html)
	const projects: ListingProject[] = []

	$('.shadow.p-3.mb-5.bg-body.rounded').each((_, element) => {
		const $el = $(element)

		const reraIdRaw = $el.find('.col-xl-4 p.p-0').first().text().trim()
		const reraId = reraIdRaw.replace('# ', '').trim()

		const projectName = $el.find('h4.title4 strong').text().trim()
		const developer = $el.find('p.darkBlue.bold').text().trim() || null

		const locationTalukaRaw = $el.find('.col-xl-4 .listingList li:first-child a').text().trim()
		const locationTaluka = locationTalukaRaw.replace(/\s+/g, ' ').trim() || null

		const getFieldText = (label: string) => {
			const targetDiv = $el.find('.greyColor').filter((_, d) => $(d).text().trim().includes(label))
			if (targetDiv.length > 0) {
				return targetDiv.parent().find('p').text().trim()
			}
			return null
		}

		const pincode = getFieldText('Pincode')
		const district = getFieldText('District')
		const lastModifiedStr = getFieldText('Last Modified')

		const modalLink = $el.find('a.click-projectmodal').attr('href')
		const internalId = modalLink ? parseInt(modalLink.split('/').pop() || '0') : null

		const hasExtensionCert =
			$el.find('a[data-qstr-flag="DocProjectExtCert"]').length > 0 ||
			$el.find('a[title="View Extension Certificate"]').length > 0

		let lastModified: Date | null = null
		if (lastModifiedStr) {
			lastModified = new Date(lastModifiedStr)
			if (isNaN(lastModified.getTime())) {
				const parts = lastModifiedStr.split('-')
				if (parts.length === 3) {
					lastModified = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
				}
			}
		}

		const project = {
			reraId,
			projectName,
			developer,
			locationTaluka,
			district,
			pincode,
			lastModified: isNaN(lastModified?.getTime() || NaN) ? null : lastModified,
			internalId,
			hasExtensionCert
		}

		const result = ProjectSchema.safeParse(project)
		if (result.success) {
			projects.push(result.data)
		} else {
			console.warn(`Validation failed for project ${reraId}:`, result.error.format())
		}
	})

	return projects
}

export class MahaRERAListingScraper implements ListingScraper {
	async scrapePage(page: number): Promise<ListingProject[]> {
		console.log(`Scraping page ${page}...`)
		const url = listingUrlPattern(page)

		try {
			const html = await withRetry(async () => {
				const response = await fetch(url, {
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
						Accept:
							'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
						'Accept-Language': 'en-US,en;q=0.9'
					},
					signal: AbortSignal.timeout(30000)
				})

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`)
				}

				return await response.text()
			})

			return parseListingHtml(html)
		} catch (error: any) {
			console.error(`Error scraping page ${page}:`, error.message)
			return []
		}
	}

	async saveProjects(projects: ListingProject[]) {
		for (const project of projects) {
			try {
				await prisma.projectListing.upsert({
					where: { reraId: project.reraId },
					update: project,
					create: project
				})
			} catch (error) {
				console.error(`Error saving project ${project.reraId}:`, error)
			}
		}
	}
}
