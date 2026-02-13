import { tokenManager } from '../../utils/token'
import { withRetry } from '../../utils/retry'
import { MAHA_CONFIG } from './config'
import type { DetailScraper } from '../../types'
import { prisma } from '@askrera/db'

export class MahaRERADetailScraper implements DetailScraper {
	async getValidToken(): Promise<string> {
		const existingToken = tokenManager.getToken()
		if (existingToken) return existingToken

		const envToken = process.env.RERA_TOKEN
		if (!envToken) {
			throw new Error(
				'No valid JWT found. Please provide a token via:\n' +
					'  1. RERA_TOKEN environment variable, or\n' +
					'  2. --token CLI flag\n\n' +
					'Obtain the token manually from MahaRERA by:\n' +
					'  - Visiting a project detail page\n' +
					'  - Opening DevTools → Network tab\n' +
					'  - Looking for the Authorization header in API requests\n' +
					'  - Copying the Bearer token (valid for ~100 minutes)'
			)
		}

		tokenManager.setToken(envToken)
		return envToken
	}

	async fetchProjectDetails(internalId: number, token: string) {
		return await withRetry(async () => {
			const response = await fetch(`${MAHA_CONFIG.apiBaseUrl}getProjectGeneralDetailsByProjectId`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ projectId: internalId })
			})

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`)
			}

			const data = await response.json()
			return data.responseObject
		})
	}

	async processProject(internalId: number) {
		const token = await this.getValidToken()
		const generalDetails = await this.fetchProjectDetails(internalId, token)

		if (!generalDetails) return

		const parseDate = (d: any) => (d ? new Date(d) : null)

		const projectData = {
			reraId: generalDetails.projectRegistartionNo,
			name: generalDetails.projectName,
			projectType: generalDetails.projectTypeName,
			currentStatus: generalDetails.projectCurrentStatus,
			statusName: generalDetails.projectStatusName || null,
			developerId: null,
			district: generalDetails.district || null,
			taluka: generalDetails.taluka || null,
			pincode: generalDetails.pincode || null,
			originalCompletion: parseDate(generalDetails.originalProjectProposeCompletionDate),
			proposedCompletion: parseDate(generalDetails.projectProposeComplitionDate),
			registrationDate: parseDate(generalDetails.reraRegistrationDate),
			applicationDate: parseDate(generalDetails.projectApplicationDate),
			certGenerationDate: parseDate(generalDetails.registrationCertificateGenerationDate),
			ackNumber: generalDetails.acknowledgementNumber || null,
			totalUnits: generalDetails.totalNumberOfUnits || 0,
			soldUnits: generalDetails.totalNumberOfSoldUnits,
			feesPayable: parseFloat(generalDetails.projectFeesPayableAmount),
			grossFees: parseFloat(generalDetails.projectCalculatedGrossFeesApplicable),
			isMigrated: generalDetails.isMigrated === 1,
			isLapsed: generalDetails.isProjectLapsed === 1,
			isBuilding: generalDetails.isBuilding === 1,
			certDmsRef: generalDetails.registrationCertificateDmsRefNo,
			extensionCertRef: generalDetails.extensionCertificateDmsRefNo,
			promoterTypeId: parseInt(generalDetails.userProfileTypeId),
			locationId: parseInt(generalDetails.projectLocationId),
			rawApiResponse: generalDetails,
			lastSynced: new Date()
		}

		await prisma.project.upsert({
			where: { internalId: internalId },
			update: projectData,
			create: {
				internalId: internalId,
				...projectData
			}
		})

		await prisma.projectListing.updateMany({
			where: { internalId: internalId },
			data: { detailScrapedAt: new Date() }
		})

		console.log(`Processed project ${internalId}`)
	}
}
