const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { URL } = require('node:url')

const MAX_SOURCE_BYTES = 20_000
const MAX_BODY_BYTES = 50_000
const PROBLEMS_DIR = process.env.RUNNER_PROBLEMS_DIR || path.join(__dirname, 'private-problems')

function loadProblem(problemId) {
  const safeId = String(problemId || '')
  if (!/^[a-z0-9-]+$/.test(safeId)) throw new Error('Unknown problem')
  const file = path.join(PROBLEMS_DIR, `${safeId}.json`)
  if (!fs.existsSync(file)) throw new Error('Unknown problem')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function validateSubmission(payload) {
  if (!payload || typeof payload.sourceCode !== 'string' || !payload.sourceCode.trim()) throw new Error('sourceCode is required')
  if (Buffer.byteLength(payload.sourceCode, 'utf8') > MAX_SOURCE_BYTES) throw new Error('sourceCode is too large')
  if (/\bpackage\s+[A-Za-z_][\w.]*/.test(payload.sourceCode)) throw new Error('package declarations are not allowed')
  if (/public\s+class\s+Main\b/.test(payload.sourceCode)) throw new Error('Main is reserved by the runner')
  return payload.sourceCode
}

function javaString(value) {
  return JSON.stringify(String(value))
}

function buildSubmissionSource(problem, sourceCode, mode) {
  const solution = sourceCode.replace(/\bpublic\s+class\s+Solution\b/, `class ${problem.className}`)
  const cases = mode === 'sample' ? problem.samples : [...problem.samples, ...problem.hiddenTests]
  const checks = cases.map((testCase, index) => `    check(solution, ${javaString(testCase.input)}, ${testCase.expected}, ${index});`).join('\n')
  return `import java.util.*;\n\n${solution}\n\npublic class Main {\n  public static void main(String[] args) {\n    ${problem.className} solution = new ${problem.className}();\n${checks}\n  }\n\n  private static void check(${problem.className} solution, String input, int expected, int index) {\n    int actual = solution.${problem.methodName}(input);\n    if (actual != expected) {\n      System.out.println("WRONG_ANSWER|" + index);\n      System.exit(42);\n    }\n    System.out.println("PASS|" + index);\n  }\n}\n`
}

function outputPassCount(stdout = '') {
  return String(stdout).split(/\r?\n/).filter((line) => line.startsWith('PASS|')).length
}

function gradeExecution(problem, execution, mode) {
  const total = mode === 'sample' ? problem.samples.length : problem.samples.length + problem.hiddenTests.length
  const passed = outputPassCount(execution.stdout)
  const description = execution.status?.description || ''
  if (execution.compile_output) return { status: 'compile_error', passed, total, message: 'Compilation failed.' }
  if (/time limit/i.test(description)) return { status: 'timeout', passed, total, message: 'The solution exceeded the time limit.' }
  if (execution.stderr && !/accepted/i.test(description)) return { status: 'runtime_error', passed, total, message: 'The solution raised a runtime error.' }
  if (/wrong answer/i.test(description) || String(execution.stdout || '').includes('WRONG_ANSWER')) return { status: 'wrong_answer', passed, total, message: 'The solution failed one or more tests.' }
  if (/accepted/i.test(description) || passed === total) return { status: 'accepted', passed: total, total, message: mode === 'sample' ? 'All sample tests passed.' : 'All public and hidden tests passed.' }
  return { status: 'runtime_error', passed, total, message: 'The runner did not return a complete result.' }
}

function runLocally(problem, sourceCode, mode) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'java-expert-quiz-'))
  const sourceFile = path.join(directory, 'Main.java')
  fs.writeFileSync(sourceFile, buildSubmissionSource(problem, sourceCode, mode), 'utf8')
  try {
    const compile = spawnSync('javac', [sourceFile], { cwd: directory, encoding: 'utf8', timeout: 10_000, maxBuffer: 1_000_000 })
    if (compile.error || compile.status !== 0) return { compile_output: compile.stderr || compile.error?.message || 'Compilation failed.' }
    const run = spawnSync('java', ['-Xmx128m', '-cp', directory, 'Main'], { cwd: directory, encoding: 'utf8', timeout: 5_000, maxBuffer: 1_000_000 })
    if (run.error && run.error.code === 'ETIMEDOUT') return { status: { description: 'Time Limit Exceeded' }, stderr: 'timeout' }
    return { status: { description: run.status === 0 ? 'Accepted' : 'Runtime Error' }, stdout: run.stdout, stderr: run.status === 0 ? '' : run.stderr }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

async function runOnJudge0(problem, sourceCode, mode) {
  const endpoint = `${process.env.JUDGE0_URL || 'https://ce.judge0.com'}/submissions?wait=true`
  const headers = { 'Content-Type': 'application/json' }
  if (process.env.JUDGE0_API_KEY) headers['X-Auth-Token'] = process.env.JUDGE0_API_KEY
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ language_id: problem.languageId, source_code: buildSubmissionSource(problem, sourceCode, mode), stdin: '' }) })
  if (!response.ok) throw new Error(`Judge0 returned HTTP ${response.status}`)
  return response.json()
}

function jsonResponse(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (chunk) => {
      data += chunk
      if (Buffer.byteLength(data, 'utf8') > MAX_BODY_BYTES) reject(new Error('Request body is too large'))
    })
    request.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) } catch { reject(new Error('Request body must be JSON')) }
    })
    request.on('error', reject)
  })
}

function createRunnerServer({ mode = process.env.RUNNER_MODE || 'judge0' } = {}) {
  return http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') return jsonResponse(response, 204, {})
    const url = new URL(request.url, 'http://localhost')
    if (request.method === 'GET' && url.pathname === '/health') return jsonResponse(response, 200, { status: 'ok', mode })
    if (request.method !== 'POST' || !url.pathname.startsWith('/api/problems/') || !url.pathname.endsWith('/run')) return jsonResponse(response, 404, { error: 'Not found' })
    try {
      const problemId = url.pathname.slice('/api/problems/'.length, -'/run'.length)
      const problem = loadProblem(problemId)
      const payload = await readBody(request)
      const sourceCode = validateSubmission(payload)
      const runMode = payload.mode === 'sample' ? 'sample' : 'submit'
      const raw = mode === 'local' ? runLocally(problem, sourceCode, runMode) : await runOnJudge0(problem, sourceCode, runMode)
      const result = gradeExecution(problem, raw, runMode)
      if (raw.compile_output) result.details = String(raw.compile_output).slice(0, 4_000)
      if (raw.stderr) result.details = String(raw.stderr).slice(0, 4_000)
      return jsonResponse(response, 200, result)
    } catch (error) {
      return jsonResponse(response, /Unknown problem|sourceCode|package declarations|Main is reserved|too large|JSON/.test(error.message) ? 400 : 502, { error: error.message })
    }
  })
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787)
  createRunnerServer().listen(port, '127.0.0.1', () => console.log(`quiz runner listening on http://127.0.0.1:${port} (${process.env.RUNNER_MODE || 'judge0'})`))
}

module.exports = { buildSubmissionSource, createRunnerServer, gradeExecution, loadProblem, validateSubmission }
