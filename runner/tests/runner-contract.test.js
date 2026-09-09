const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const {
  buildSubmissionSource,
  gradeExecution,
  loadProblem,
  validateSubmission,
} = require('../server')

test('builds a Java harness around the submitted solution and keeps hidden cases out of the client contract', () => {
  const problem = loadProblem('longest-substring-without-repeating-characters')
  const source = buildSubmissionSource(problem, 'class Solution { public int lengthOfLongestSubstring(String s) { return s.length(); } }', 'sample')

  assert.match(source, /class Solution/)
  assert.match(source, /public class Main/)
  assert.match(source, /lengthOfLongestSubstring/)
  assert.match(source, /abcabcbb/)
  assert.doesNotMatch(source, /pwwkew/)
})

test('normalizes accepted, wrong-answer, compile, and runtime results', () => {
  const problem = loadProblem('longest-substring-without-repeating-characters')

  assert.deepEqual(gradeExecution(problem, { status: { description: 'Accepted' }, stdout: 'PASS\nPASS\n' }, 'sample'), {
    status: 'accepted',
    passed: 2,
    total: 2,
    message: 'All sample tests passed.',
  })
  assert.equal(gradeExecution(problem, { status: { description: 'Wrong Answer' }, stdout: 'PASS\nWRONG_ANSWER\n' }, 'submit').status, 'wrong_answer')
  assert.equal(gradeExecution(problem, { compile_output: 'error: missing ;' }, 'submit').status, 'compile_error')
  assert.equal(gradeExecution(problem, { stderr: 'Exception in thread main' }, 'submit').status, 'runtime_error')
})

test('rejects unknown problems and oversized source before execution', () => {
  assert.throws(() => loadProblem('not-a-real-problem'), /Unknown problem/)
  assert.throws(() => validateSubmission({ sourceCode: 'x'.repeat(20001) }), /too large/)
  assert.throws(() => validateSubmission({ sourceCode: 'package evil;' }), /package declarations are not allowed/)
})

test('forwards a submit request to Judge0 and returns a normalized result', async () => {
  let upstreamPayload
  const upstream = http.createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      upstreamPayload = JSON.parse(body)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ status: { description: 'Accepted' }, stdout: 'PASS|0\nPASS|1\n' }))
    })
  })
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const runner = require('../server').createRunnerServer({ mode: 'judge0' })
  await new Promise((resolve) => runner.listen(0, '127.0.0.1', resolve))
  const upstreamPort = upstream.address().port
  const runnerPort = runner.address().port
  const previousJudge0Url = process.env.JUDGE0_URL
  process.env.JUDGE0_URL = `http://127.0.0.1:${upstreamPort}`
  try {
    const response = await fetch(`http://127.0.0.1:${runnerPort}/api/problems/longest-substring-without-repeating-characters/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'submit', sourceCode: 'class Solution { public int lengthOfLongestSubstring(String s) { return 0; } }' }),
    })
    const result = await response.json()
    assert.equal(result.status, 'accepted')
    assert.equal(upstreamPayload.language_id, 62)
    assert.match(upstreamPayload.source_code, /public class Main/)
    assert.match(upstreamPayload.source_code, /pwwkew/)
  } finally {
    if (previousJudge0Url === undefined) delete process.env.JUDGE0_URL
    else process.env.JUDGE0_URL = previousJudge0Url
    await new Promise((resolve) => runner.close(resolve))
    await new Promise((resolve) => upstream.close(resolve))
  }
})