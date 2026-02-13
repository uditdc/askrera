import { parseArgs } from 'util'
import maharashtra from './states/maharashtra'
import { runPipeline, type ScrapeMode } from './pipeline'

const STATES = {
	maharashtra
}

async function main() {
	const { values, positionals } = parseArgs({
		args: Bun.argv,
		options: {
			state: {
				type: 'string',
				default: 'maharashtra'
			},
			mode: {
				type: 'string',
				default: 'daily'
			},
			token: {
				type: 'string'
			}
		},
		strict: false,
		allowPositionals: true
	})

	const stateName = values.state!
	const mode = (values.mode || positionals[0] || 'daily') as ScrapeMode

	const config = STATES[stateName as keyof typeof STATES]
	if (!config) {
		console.error(`Unknown state: ${stateName}`)
		console.error(`Available states: ${Object.keys(STATES).join(', ')}`)
		process.exit(1)
	}

	await runPipeline(config, mode)
}

main().catch(console.error)
