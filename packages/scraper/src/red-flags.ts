import type { Project } from '@prisma/client'

export function evaluateRedFlags(
	project: Project
): Array<{ flagType: string; condition: boolean }> {
	return [
		{
			flagType: 'completion_date_delayed',
			condition: !!(
				project.proposedCompletion &&
				project.originalCompletion &&
				new Date(project.proposedCompletion) > new Date(project.originalCompletion)
			)
		},
		{
			flagType: 'project_lapsed',
			condition: project.isLapsed === true
		},
		{
			flagType: 'extension_granted',
			condition: !!project.extensionCertRef
		},
		{
			flagType: 'zero_units_registered',
			condition: (project.totalUnits === 0 || !project.totalUnits) && !project.isMigrated
		},
		{
			flagType: 'no_sales_recorded',
			condition:
				project.soldUnits === 0 &&
				project.registrationDate &&
				Date.now() - new Date(project.registrationDate).getTime() > 365 * 24 * 60 * 60 * 1000
		}
	]
}

export async function deriveRedFlags(project: Project) {
	const redFlags = evaluateRedFlags(project)

	for (const { flagType, condition } of redFlags) {
		const existingFlag = await prisma.redFlag.findFirst({
			where: {
				projectId: project.id,
				flagType,
				resolvedAt: null
			}
		})

		if (condition && !existingFlag) {
			await prisma.redFlag.create({
				data: {
					projectId: project.id,
					flagType
				}
			})
		} else if (!condition && existingFlag) {
			await prisma.redFlag.update({
				where: { id: existingFlag.id },
				data: { resolvedAt: new Date() }
			})
		}
	}
}
