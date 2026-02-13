import { test, expect } from 'vitest'

const sampleAPIResponse = {
	projectRegistartionNo: 'P52100000001',
	projectName: 'Sample Towers',
	projectTypeName: 'Residential',
	projectCurrentStatus: 'Active',
	projectStatusName: 'Registered',
	originalProjectProposeCompletionDate: '2023-12-31',
	projectProposeComplitionDate: '2024-06-30',
	reraRegistrationDate: '2020-01-15',
	projectApplicationDate: '2019-12-01',
	registrationCertificateGenerationDate: '2020-01-20',
	acknowledgementNumber: 'ACK123456',
	totalNumberOfUnits: 200,
	totalNumberOfSoldUnits: 150,
	projectFeesPayableAmount: '5000000.50',
	projectCalculatedGrossFeesApplicable: '5500000.75',
	isMigrated: 0,
	isProjectLapsed: 0,
	isBuilding: 1,
	registrationCertificateDmsRefNo: 'CERT123',
	extensionCertificateDmsRefNo: null,
	userProfileTypeId: '2',
	projectLocationId: '100'
}

test('detail parser maps all general fields correctly', () => {
	const parseDate = (d: any) => (d ? new Date(d) : null)
	const parseFloat = (v: any) => (v ? Number.parseFloat(v) : null)
	const parseInt = (v: any) => (v ? Number.parseInt(v) : null)

	expect(sampleAPIResponse.projectRegistartionNo).toBe('P52100000001')
	expect(sampleAPIResponse.projectName).toBe('Sample Towers')
	expect(sampleAPIResponse.projectStatusName).toBe('Registered')
	expect(sampleAPIResponse.acknowledgementNumber).toBe('ACK123456')
	expect(parseFloat(sampleAPIResponse.projectFeesPayableAmount)).toBe(5000000.5)
	expect(parseFloat(sampleAPIResponse.projectCalculatedGrossFeesApplicable)).toBe(5500000.75)
	expect(parseInt(sampleAPIResponse.userProfileTypeId)).toBe(2)
	expect(parseInt(sampleAPIResponse.projectLocationId)).toBe(100)
	expect(parseDate(sampleAPIResponse.registrationCertificateGenerationDate)).toBeInstanceOf(Date)
})

test('detail parser handles null values', () => {
	const parseDate = (d: any) => (d ? new Date(d) : null)
	const parseFloat = (v: any) => (v ? Number.parseFloat(v) : null)

	expect(parseDate(null)).toBe(null)
	expect(parseFloat(null)).toBe(null)
	expect(parseFloat(undefined)).toBe(null)
})
