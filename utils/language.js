const extensions = { js: 'JavaScript', ts: 'TypeScript', jsx: 'JavaScript', tsx: 'TypeScript', py: 'Python', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#', go: 'Go', rs: 'Rust', rb: 'Ruby', php: 'PHP', html: 'HTML', css: 'CSS', json: 'JSON', md: 'Markdown', sql: 'SQL', sh: 'Shell', yml: 'YAML', yaml: 'YAML' };
function detectLanguage(filePath) { return extensions[String(filePath).split('.').pop().toLowerCase()] || 'Text'; }
module.exports = { detectLanguage };
