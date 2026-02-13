import { test, expect } from 'vitest'
import { parseListingHtml } from '../states/maharashtra/listing'

const sampleHTML = `
<div class="shadow p-3 mb-5 bg-body rounded">
  <div class="col-xl-4">
    <p class="p-0"># P52100000001</p>
  </div>
  <h4 class="title4"><strong>Sample Project Name</strong></h4>
  <p class="darkBlue bold">Sample Developer Ltd.</p>
  <div class="col-xl-4">
    <div class="listingList">
      <li><a>Andheri, Mumbai Suburban</a></li>
    </div>
  </div>
  <div>
    <div class="greyColor">Pincode:</div>
    <p>400053</p>
  </div>
  <div>
    <div class="greyColor">District:</div>
    <p>Mumbai Suburban</p>
  </div>
  <div>
    <div class="greyColor">Last Modified:</div>
    <p>2024-01-15</p>
  </div>
  <a class="click-projectmodal" href="/project/12345"></a>
  <a data-qstr-flag="DocProjectExtCert"></a>
</div>
`

test('listing parser extracts all fields correctly', () => {
	const projects = parseListingHtml(sampleHTML)
	expect(projects.length).toBe(1)

	const project = projects[0]
	expect(project.reraId).toBe('P52100000001')
	expect(project.projectName).toBe('Sample Project Name')
	expect(project.developer).toBe('Sample Developer Ltd.')
	expect(project.internalId).toBe(12345)
	expect(project.hasExtensionCert).toBe(true)
	expect(project.locationTaluka).toBe('Andheri, Mumbai Suburban')
	expect(project.district).toBe('Mumbai Suburban')
	expect(project.pincode).toBe('400053')
})

test('listing parser handles missing fields', () => {
	const minimalHTML = `
  <div class="shadow p-3 mb-5 bg-body rounded">
    <div class="col-xl-4">
      <p class="p-0"># P52100000002</p>
    </div>
    <h4 class="title4"><strong>Minimal Project</strong></h4>
  </div>
  `

	const projects = parseListingHtml(minimalHTML)
	expect(projects.length).toBe(1)

	const project = projects[0]
	expect(project.reraId).toBe('P52100000002')
	expect(project.projectName).toBe('Minimal Project')
	expect(project.developer).toBe(null)
	expect(project.hasExtensionCert).toBe(false)
})
