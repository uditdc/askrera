import { z } from 'zod'

export const PaginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationParams = z.infer<typeof PaginationSchema>

export function paginationMeta(total: number, params: PaginationParams) {
	return {
		total,
		page: params.page,
		limit: params.limit,
		total_pages: Math.ceil(total / params.limit),
	}
}

export function paginationArgs(params: PaginationParams) {
	return {
		skip: (params.page - 1) * params.limit,
		take: params.limit,
	}
}
