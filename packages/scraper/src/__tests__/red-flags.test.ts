import { test, expect } from 'vitest'
import { evaluateRedFlags } from '../red-flags'

test('completion_date_delayed flag when proposed > original', () => {
	const project = {
		originalCompletion: new Date('2023-01-01'),
		proposedCompletion: new Date('2024-01-01')
	}
	const flags = evaluateRedFlags(project)
	const delayedFlag = flags.find((f) => f.flagType === 'completion_date_delayed')
	expect(delayedFlag?.condition).toBe(true)
})

test('no completion_date_delayed flag when dates are equal', () => {
	const project = {
		originalCompletion: new Date('2023-01-01'),
		proposedCompletion: new Date('2023-01-01')
	}
	const flags = evaluateRedFlags(project)
	const delayedFlag = flags.find((f) => f.flagType === 'completion_date_delayed')
	expect(delayedFlag?.condition).toBe(false)
})

test('project_lapsed flag when isLapsed is true', () => {
	const project = { isLapsed: true }
	const flags = evaluateRedFlags(project)
	const lapsedFlag = flags.find((f) => f.flagType === 'project_lapsed')
	expect(lapsedFlag?.condition).toBe(true)
})

test('extension_granted flag when extensionCertRef exists', () => {
	const project = { extensionCertRef: 'EXT123456' }
	const flags = evaluateRedFlags(project)
	const extFlag = flags.find((f) => f.flagType === 'extension_granted')
	expect(extFlag?.condition).toBe(true)
})

test('zero_units_registered flag for non-migrated projects with 0 units', () => {
	const project = { totalUnits: 0, isMigrated: false }
	const flags = evaluateRedFlags(project)
	const zeroUnitsFlag = flags.find((f) => f.flagType === 'zero_units_registered')
	expect(zeroUnitsFlag?.condition).toBe(true)
})

test('no zero_units_registered flag for migrated projects', () => {
	const project = { totalUnits: 0, isMigrated: true }
	const flags = evaluateRedFlags(project)
	const zeroUnitsFlag = flags.find((f) => f.flagType === 'zero_units_registered')
	expect(zeroUnitsFlag?.condition).toBe(false)
})

test('no_sales_recorded flag when 0 sales after 1 year', () => {
	const project = {
		soldUnits: 0,
		registrationDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
	}
	const flags = evaluateRedFlags(project)
	const noSalesFlag = flags.find((f) => f.flagType === 'no_sales_recorded')
	expect(noSalesFlag?.condition).toBe(true)
})

test('no no_sales_recorded flag when registered less than 1 year ago', () => {
	const project = {
		soldUnits: 0,
		registrationDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
	}
	const flags = evaluateRedFlags(project)
	const noSalesFlag = flags.find((f) => f.flagType === 'no_sales_recorded')
	expect(noSalesFlag?.condition).toBe(false)
})

test('no no_sales_recorded flag when units are sold', () => {
	const project = {
		soldUnits: 10,
		registrationDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
	}
	const flags = evaluateRedFlags(project)
	const noSalesFlag = flags.find((f) => f.flagType === 'no_sales_recorded')
	expect(noSalesFlag?.condition).toBe(false)
})
