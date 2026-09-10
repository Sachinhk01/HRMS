import api from './api';

const form16Path = '/form16';

function unwrap(response) {
	return response.data?.data ?? response.data;
}

async function request(method, path, payload, config) {
	const response = await api[method](path, payload, config);
	return unwrap(response);
}

export async function getForm16EmployeeDropdown() {
	const response = await api.get('/employees/dropdown');
	return unwrap(response);
}

const sectionMethods = {
	quarter: 'quarter',
	salary: 'salary',
	exemption: 'exemption',
	section16: 'section16',
	chapterVIA: 'chapter-via',
	lastFields: 'tax',
	verification: 'verification',
};

function sectionPath(form16Id, section) {
	return `${form16Path}/${form16Id}/${sectionMethods[section]}`;
}

function createSectionMethods(name, section) {
	return {
		[`get${name}`]: (form16Id) => request('get', sectionPath(form16Id, section)),
		[`create${name}`]: (form16Id, payload) => request('post', sectionPath(form16Id, section), payload),
		[`update${name}`]: (form16Id, payload) => request('put', sectionPath(form16Id, section), payload),
	};
}

export const form16Service = {
	getByEmployeeYear: (employeeId, assessmentYear) =>
		request('get', `${form16Path}/employee/${employeeId}`, undefined, { params: { assessmentYear } }),
	create: (employeeId, payload) => request('post', `${form16Path}/employee/${employeeId}`, payload),
	activate: (employeeId) => request('patch', `${form16Path}/employee/${employeeId}/activate`),
	deactivate: (employeeId) => request('patch', `${form16Path}/employee/${employeeId}/deactivate`),
	getChallans: (form16Id) => request('get', `${form16Path}/${form16Id}/challans`),
	createChallan: (form16Id, payload) => request('post', `${form16Path}/${form16Id}/challans`, payload),
	updateChallan: (form16Id, challanId, payload) => request('put', `${form16Path}/${form16Id}/challans/${challanId}`, payload),
	deleteChallan: (form16Id, challanId) => request('delete', `${form16Path}/${form16Id}/challans/${challanId}`),
	...createSectionMethods('Quarter', 'quarter'),
	...createSectionMethods('Salary', 'salary'),
	...createSectionMethods('Exemption', 'exemption'),
	...createSectionMethods('Section16', 'section16'),
	...createSectionMethods('ChapterVIA', 'chapterVIA'),
	...createSectionMethods('LastFields', 'lastFields'),
	...createSectionMethods('Verification', 'verification'),
};
