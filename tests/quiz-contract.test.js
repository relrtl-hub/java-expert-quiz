const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('the quiz shell exposes the configuration and submission contract', () => {
  const html = read('index.html')

  for (const id of [
    'category-filter',
    'subject-filter',
    'question-type',
    'include-leetcode',
    'question-count',
    'generate-test',
    'quiz-form',
    'submit-test',
    'results',
    'notification',
    'subject-context',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`)
  }

  assert.match(html, /aria-live=["']polite["']/)
  assert.match(html, /app\.js/)
})

test('the question bank contains an expanded source-backed practice bank', () => {
  const questions = JSON.parse(read('data/questions.json'))

  assert.ok(questions.length >= 250)
  assert.ok(questions.filter((question) => question.type === 'multiple_choice').length >= 10)
  assert.ok(questions.filter((question) => question.type === 'short_answer').length >= 10)
  assert.ok(questions.filter((question) => question.type === 'leetcode').length >= 1)
  assert.ok(questions.filter((question) => question.type === 'short_answer').length >= 10)
  const subjectCounts = questions.reduce((counts, question) => {
    counts[question.subjectId] = (counts[question.subjectId] || 0) + 1
    return counts
  }, {})
  assert.equal(Object.keys(subjectCounts).length, 29)
  for (const count of Object.values(subjectCounts)) assert.ok(count >= 10)

  for (const question of questions) {
    assert.ok(question.subjectId)
    assert.ok(question.source?.url)
    assert.match(question.source.url, /^https:\/\//)
    assert.ok(question.explanation)
  }

  for (const question of questions.filter((item) => item.type === 'multiple_choice')) {
    assert.equal(question.options.length, 4)
    assert.equal(question.options.filter((option) => option.id === question.correctOptionId).length, 1)
  }

  for (const question of questions.filter((item) => item.type === 'leetcode')) {
    assert.equal(question.difficulty, 'medium')
    assert.ok(question.problemId)
    assert.equal(question.points, 3)
  }
})

test('the javexp catalog contract uses the same stable slugs as quiz questions', () => {
  const catalog = JSON.parse(read('data/javexp-quiz-catalog.json'))
  const questions = JSON.parse(read('data/questions.json'))
  const catalogSlugs = new Set(catalog.subjects.map((subject) => subject.slug))
  const catalogBySlug = new Map(catalog.subjects.map((subject) => [subject.slug, subject]))
  assert.equal(catalog.version, 1)
  assert.equal(catalog.source, 'javexp')
  for (const slug of ['kafka', 'redis', 'junit', 'testcontainers', 'virtual-threads', 'kubernetes-components', 'openshift', 'binary-trees', 'graph-traversal', 'recursion-and-backtracking', 'dynamic-programming']) assert.ok(catalogSlugs.has(slug), slug)
  for (const question of questions) {
    assert.ok(catalogSlugs.has(question.subjectId), question.subjectId)
    assert.equal(catalogBySlug.get(question.subjectId).categoryId, question.categoryId)
  }
})

test('the browser app owns the local no-database quiz flow', () => {
  const app = read('app.js')
  const suggestions = JSON.parse(read('data/suggestions.json'))

  assert.match(app, /localStorage/)
  assert.match(app, /generate-test/)
  assert.match(app, /correctOptionId/)
  assert.match(app, /suggestion/)
  assert.match(app, /data-suggestion-action/)
  assert.match(app, /java-expert-suggestion-status/)
  assert.match(app, /availableSuggestions/)
  assert.ok(suggestions.length >= 2)
  assert.match(app, /data\/questions\.json/)
  assert.match(app, /data-option/)
  assert.match(app, /gradeShortAnswer/)
  assert.match(app, /Review every answer and explanation/)
  assert.match(app, /correctAnswer/)
  assert.match(app, /<details class="review-item"/)
  assert.match(app, /state\.activeQuestions\.map\(reviewItemMarkup\)/)
  assert.match(app, /Further reading/)
  assert.match(app, /<details class="review-item"[^>]*open/)
  assert.match(app, /<summary>/)
  assert.match(app, /runCode/)
  assert.match(app, /Public example results/)
  assert.match(app, /function codingScore/)
  assert.match(app, /coding points/)
  assert.match(app, /Your result/)
  assert.match(app, /No result/)
  assert.match(app, /data\/problems\.json/)
  assert.match(app, /data-code-action/)
  assert.match(app, /quiz-runner-url/)
  assert.match(app, /loadQuestionBank/)
  assert.match(app, /quiz_questions/)
  assert.match(app, /local-stale-supabase/)
  assert.match(app, /question.*one/)
  assert.match(app, /fixed-test/)
  assert.match(app, /10 short-answer questions/)
  assert.match(app, /7.*multiple-choice|multiple-choice.*7/)
  assert.match(app, /used-coding|coding.*history/)
  assert.match(app, /suggestionId.*added|added.*suggestionId/)
  assert.match(app, /rubric/)
  assert.match(app, /URLSearchParams/)
  assert.match(app, /javexp-quiz-catalog\.json/)

  const html = read('index.html')
  assert.match(html, /submit-test/)
  assert.match(html, /return-javexp/)
  assert.match(html, /supabase\/config\.js/)
  assert.match(html, /bank-source/)
  assert.match(html, /value="10"/)
  assert.match(html, /max="10000"/)
})

test('question feedback is optional, browser-local, and part of result review', () => {
  const app = read('app.js')

  assert.match(app, /QUESTION_RATINGS_KEY/)
  assert.match(app, /java-expert-question-ratings/)
  assert.match(app, /java-expert-removed-questions/)
  assert.match(app, /question-rating/)
  assert.match(app, /data-rating=/)
  assert.match(app, /good: 'Good'/)
  assert.match(app, /bad: 'Bad'/)
  assert.match(app, /need_explanation: 'Need explanation'/)
  assert.match(app, /aria-pressed/)
  assert.match(app, /rating === 'bad'/)
  assert.match(app, /removedQuestionIds/)
  assert.match(app, /available.*10|10.*available/)
  assert.match(app, /need_explanation/)
  assert.match(app, /More explanation requested/)
  assert.match(app, /codeResults/)
  assert.match(app, /state\.submitting/)
  assert.match(app, /Run examples, then submit the quiz/)
  assert.match(app, /review-item.*data-question-id/)

  const html = read('index.html')
  assert.match(html, /Question feedback/)
})

test('the optional Supabase question backend is read-only and seeded from the public bank', () => {
  const schema = read('supabase/schema.sql')
  const seed = read('supabase/seed.sql')
  const config = read('supabase/config.example.js')
  const questions = JSON.parse(read('data/questions.json'))

  assert.match(schema, /enable row level security/)
  assert.match(schema, /published = true/)
  assert.match(schema, /revoke insert, update, delete/)
  assert.equal((seed.match(/insert into public\.quiz_questions/g) || []).length, questions.length)
  assert.match(config, /supabaseAnonKey/)
  assert.doesNotMatch(config, /service_role/)
})

test('the coding problem catalog covers every coding question', () => {
  const questions = JSON.parse(read('data/questions.json')).filter((question) => question.type === 'leetcode')
  const problems = JSON.parse(read('data/problems.json'))
  const problemIds = new Set(problems.map((problem) => problem.id))
  assert.equal(problems.length, 13)
  for (const question of questions) assert.ok(problemIds.has(question.problemId), question.problemId)
})
