import type { Developer, Filing, Litigation, Project, RedFlag } from '@prisma/client'

type ProjectWithDeveloper = Project & { developer?: Developer | null }
type ProjectWithRelations = Project & {
	developer?: Developer | null
	litigations?: Litigation[]
	filings?: Filing[]
	redFlags?: RedFlag[]
}
type DeveloperWithProjects = Developer & {
	projects?: (Project & { litigations?: Litigation[] })[]
}

export function serializeProjectListItem(project: ProjectWithDeveloper) {
	return {
		id: project.id,
		rera_id: project.reraId,
		name: project.name,
		developer_name: project.developer?.canonicalName ?? null,
		district: project.district,
		status: project.currentStatus,
		status_name: project.statusName,
		registration_date: project.registrationDate,
		proposed_completion: project.proposedCompletion,
		is_lapsed: project.isLapsed,
	}
}

export function serializeProject(project: ProjectWithRelations) {
	const activeRedFlags = (project.redFlags ?? [])
		.filter((f) => f.resolvedAt === null)
		.map((f) => ({
			id: f.id,
			flag_type: f.flagType,
			detected_at: f.detectedAt,
			is_active: true,
		}))

	const lastQprFiling = (project.filings ?? [])
		.filter((f) => f.filingType === 'QPR')
		.sort((a, b) => {
			if (!a.filingDate) return 1
			if (!b.filingDate) return -1
			return b.filingDate.getTime() - a.filingDate.getTime()
		})[0]

	return {
		id: project.id,
		rera_id: project.reraId,
		name: project.name,
		project_type: project.projectType,
		current_status: project.currentStatus,
		status_name: project.statusName,
		district: project.district,
		taluka: project.taluka,
		pincode: project.pincode,
		registration_date: project.registrationDate,
		application_date: project.applicationDate,
		original_completion: project.originalCompletion,
		proposed_completion: project.proposedCompletion,
		total_units: project.totalUnits,
		sold_units: project.soldUnits,
		is_lapsed: project.isLapsed,
		is_migrated: project.isMigrated,
		last_synced: project.lastSynced,
		developer: project.developer
			? {
					id: project.developer.id,
					name: project.developer.canonicalName,
				}
			: null,
		litigation_count: project.litigations?.length ?? 0,
		last_qpr_date: lastQprFiling?.filingDate ?? null,
		active_red_flags: activeRedFlags,
	}
}

export function serializeDeveloper(developer: DeveloperWithProjects) {
	const projects = developer.projects ?? []
	const now = new Date()

	const delayedProjects = projects.filter(
		(p) =>
			p.proposedCompletion &&
			p.originalCompletion &&
			new Date(p.proposedCompletion) > new Date(p.originalCompletion)
	).length

	const activeLitigations = projects.reduce(
		(sum, p) => sum + (p.litigations?.filter((l) => l.status !== 'closed').length ?? 0),
		0
	)

	return {
		id: developer.id,
		name: developer.canonicalName,
		aliases: developer.aliases,
		created_at: developer.createdAt,
		total_projects: projects.length,
		delayed_projects: delayedProjects,
		active_litigations: activeLitigations,
		compliance_score: null,
	}
}
