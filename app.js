const state = {
  questions: [],
  problems: new Map(),
  catalog: { version: 1, subjects: [] },
  activeQuestions: [],
  answers: new Map(),
  scores: new Map(),
  codeResults: new Map(),
  submitting: false,
  suggestions: [],
  questionSource: 'local',
  questionSourceMessage: '',
  submitted: false,
}

const byId = (id) => document.getElementById(id)

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function shuffle(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function questionPoints(question) {
  return question.points || (question.type === 'leetcode' ? 3 : question.type === 'short_answer' ? 2 : 1)
}

const QUESTION_RATINGS_KEY = 'java-expert-question-ratings'
const REMOVED_QUESTIONS_KEY = 'java-expert-removed-questions'
const QUESTION_RATING_LABELS = {
  good: 'Good',
  bad: 'Bad',
  need_explanation: 'Need explanation',
}

function questionRatings() {
  try {
    const ratings = JSON.parse(localStorage.getItem(QUESTION_RATINGS_KEY) || '{}')
    return ratings && typeof ratings === 'object' && !Array.isArray(ratings) ? ratings : {}
  } catch {
    return {}
  }
}

function removedQuestionIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(REMOVED_QUESTIONS_KEY) || '[]')
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

function ratingStatusText(rating) {
  if (rating === 'good') return 'Marked good. It stays available for future quizzes.'
  if (rating === 'bad') return 'Marked bad. It will be left out of future quizzes on this browser.'
  if (rating === 'need_explanation') return 'Explanation requested. The result review will call this out.'
  return 'No feedback selected.'
}

function questionRatingMarkup(question) {
  const rating = questionRatings()[question.id] || ''
  const buttons = Object.entries(QUESTION_RATING_LABELS).map(([value, label]) => `<button type="button" class="question-rating-button ${rating === value ? 'is-selected' : ''}" data-rating="${value}" data-question="${question.id}" aria-pressed="${rating === value}">${label}</button>`).join('')
  return `<fieldset class="question-rating" data-rating-for="${question.id}"><legend>Question feedback</legend><p>Optional. Help improve this question for future practice.</p><div class="question-rating-actions">${buttons}</div><span class="question-rating-status" data-rating-status-for="${question.id}" role="status">${ratingStatusText(rating)}</span></fieldset>`
}

function updateQuestionRatingUI(questionId) {
  const rating = questionRatings()[questionId] || ''
  document.querySelectorAll(`[data-question-id="${questionId}"]`).forEach((card) => {
    card.querySelectorAll('[data-rating]').forEach((button) => {
      const selected = button.dataset.rating === rating
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    const status = card.querySelector(`[data-rating-status-for="${questionId}"]`)
    if (status) status.textContent = ratingStatusText(rating)
    card.classList.toggle('has-question-feedback', Boolean(rating))
  })
}

function setQuestionRating(questionId, rating) {
  const ratings = questionRatings()
  const nextRating = ratings[questionId] === rating ? '' : rating
  if (nextRating) ratings[questionId] = nextRating
  else delete ratings[questionId]
  localStorage.setItem(QUESTION_RATINGS_KEY, JSON.stringify(ratings))

  const removed = new Set(removedQuestionIds())
  if (nextRating === 'bad') removed.add(questionId)
  else removed.delete(questionId)
  localStorage.setItem(REMOVED_QUESTIONS_KEY, JSON.stringify([...removed]))

  updateQuestionRatingUI(questionId)
  renderComposition()
  const question = state.questions.find((item) => item.id === questionId)
  if (nextRating === 'bad' && question) {
    const available = state.questions.filter((item) => item.subjectId === question.subjectId && !removed.has(item.id)).length
    byId('notification').hidden = false
    byId('notification').textContent = `Question removed from future quizzes. ${available} questions remain for ${question.subjectTitle}; below 10, the bank needs a replacement question.`
  }
  if (state.submitted) renderResults()
}

function buildPool() {
  const selectedSubject = byId('subject-filter').value
  const category = byId('category-filter').value
  const type = byId('question-type').value
  const includeLeetcode = byId('include-leetcode').checked
  const subject = new URLSearchParams(window.location.search).get('subject')
  const removed = new Set(removedQuestionIds())
  return state.questions.filter((question) => {
    if (removed.has(question.id)) return false
    if ((selectedSubject !== 'all' && question.subjectId !== selectedSubject) || (selectedSubject === 'all' && subject && question.subjectId !== subject)) return false
    if (category !== 'all' && question.categoryId !== category) return false
    if (type !== 'mixed' && question.type !== type) return false
    return includeLeetcode || question.type !== 'leetcode'
  })
}

function populateFilters() {
  const subjectFilter = byId('subject-filter')
  const categoryFilter = byId('category-filter')
  const availableSubjects = new Set(state.questions.map((question) => question.subjectId))
  const subjects = state.catalog.subjects.filter((subject) => availableSubjects.has(subject.slug))
  subjectFilter.innerHTML = '<option value="all">All subjects</option>' + subjects.map((subject) => `<option value="${escapeHtml(subject.slug)}">${escapeHtml(subject.title)}</option>`).join('')
  const categories = new Map(state.questions.map((question) => [question.categoryId, question.categoryTitle]))
  categoryFilter.innerHTML = '<option value="all">All mapped javexp subjects</option>' + [...categories.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, title]) => `<option value="${escapeHtml(id)}">${escapeHtml(title)}</option>`).join('')
}

function usedCodingProblems() {
  try { return JSON.parse(localStorage.getItem('java-expert-used-coding') || '[]') } catch { return [] }
}

function pickCodingProblem(pool) {
  const codingPool = pool.filter((question) => question.type === 'leetcode')
  if (!codingPool.length) return null
  const used = usedCodingProblems()
  const fresh = codingPool.filter((question) => !used.includes(question.problemId))
  const chosen = shuffle(fresh.length ? fresh : codingPool)[0]
  const nextUsed = [...used.filter((problemId) => problemId !== chosen.problemId), chosen.problemId].slice(-3)
  localStorage.setItem('java-expert-used-coding', JSON.stringify(nextUsed))
  return chosen
}

function takeQuestions(pool, type, count, selected) {
  const selectedIds = new Set(selected.map((question) => question.id))
  const candidates = shuffle(pool.filter((question) => question.type === type && !selectedIds.has(question.id)))
  selected.push(...candidates.slice(0, count))
}

function composeMixedTest(pool, requested) {
  const selected = []
  const targetCoding = byId('include-leetcode').checked ? 1 : 0
  takeQuestions(pool, 'multiple_choice', Math.min(7, requested - targetCoding), selected)
  takeQuestions(pool, 'short_answer', Math.min(2, requested - targetCoding - selected.length), selected)
  if (targetCoding && selected.length < requested) {
    const coding = pickCodingProblem(pool)
    if (coding) selected.push(coding)
  }
  if (selected.length < requested) {
    const remaining = shuffle(pool.filter((question) => !selected.some((item) => item.id === question.id)))
    selected.push(...remaining.slice(0, requested - selected.length))
  }
  return shuffle(selected.slice(0, requested))
}

function renderComposition() {
  const pool = buildPool()
  if (!pool.length) {
    byId('composition').textContent = 'No questions match this configuration. Turn on the LeetCode slot or choose another type.'
    return
  }
  const requested = Number(byId('question-count').value)
  const count = Math.min(Math.max(requested || 1, 1), pool.length)
  if (byId('question-type').value === 'mixed' && count === 10 && byId('include-leetcode').checked) {
    byId('composition').textContent = '10 questions · 7 multiple-choice · 2 short answer · 1 coding problem'
    return
  }
  const counts = pool.slice(0, count).reduce((result, question) => {
    result[question.type] = (result[question.type] || 0) + 1
    return result
  }, {})
  const composition = Object.entries(counts).map(([type, value]) => `${value} ${type === 'multiple_choice' ? 'multiple-choice' : type === 'short_answer' ? 'short answer' : 'coding'}`).join(' · ')
  byId('composition').textContent = `${count} questions · ${composition}`
}

function sourceMarkup(question) {
  return `<div class="source-box"><span><strong>Source</strong><br /><a href="${question.source.url}" target="_blank" rel="noreferrer">${escapeHtml(question.source.label)}</a></span><span>${escapeHtml(question.source.note || '')}</span></div>`
}

function suggestionStatuses() {
  try { return JSON.parse(localStorage.getItem('java-expert-suggestion-status') || '{}') } catch { return {} }
}

window.setSuggestionDecision = (suggestionId, decision) => {
  const nextStatuses = suggestionStatuses()
  nextStatuses[suggestionId] = decision
  localStorage.setItem('java-expert-suggestion-status', JSON.stringify(nextStatuses))
  renderSuggestions()
}

function renderSuggestions() {
  const statuses = suggestionStatuses()
  const availableSuggestions = state.suggestions.filter((suggestion) => !['added', 'dismissed'].includes(statuses[suggestion.title])).slice(0, 1)
  if (!availableSuggestions.length) {
    byId('suggestion-list').innerHTML = '<p class="microcopy">No more saved suggestions for now. The candidate list can be expanded later.</p>'
    return
  }
  byId('suggestion-list').innerHTML = availableSuggestions.map((suggestion) => {
    const status = statuses[suggestion.title] || ''
    const statusMarkup = status === 'added'
      ? '<strong class="suggestion-status added">Added to your quiz backlog</strong>'
      : status === 'dismissed'
        ? '<strong class="suggestion-status dismissed">Not added</strong>'
        : `<div class="suggestion-actions"><button type="button" class="secondary-button" data-suggestion-action="added" data-suggestion-id="${escapeHtml(suggestion.title)}" onclick="window.setSuggestionDecision(this.dataset.suggestionId, this.dataset.suggestionAction)">Add subject</button><button type="button" class="text-button" data-suggestion-action="dismissed" data-suggestion-id="${escapeHtml(suggestion.title)}" onclick="window.setSuggestionDecision(this.dataset.suggestionId, this.dataset.suggestionAction)">Not now</button></div>`
    return `<article class="suggestion-card"><h3>${escapeHtml(suggestion.title)}</h3><p>${escapeHtml(suggestion.reason)}</p><ul>${suggestion.candidateSubjects.map((subject) => `<li>${escapeHtml(subject)}</li>`).join('')}</ul><p><a href="${suggestion.source.url}" target="_blank" rel="noreferrer">${escapeHtml(suggestion.source.label)} ↗</a></p>${statusMarkup}</article>`
  }).join('')
}

function codingMarkup(question, problem) {
  if (!problem) return '<div class="code-result error">This coding problem is not configured.</div>'
  const samples = problem.samples.map((sample) => `<li><code>${escapeHtml(JSON.stringify(sample.input))}</code> → <strong>${sample.expected}</strong></li>`).join('')
  return `<section class="coding-workspace" aria-label="Java coding workspace">
    <div class="problem-context"><div><strong>${escapeHtml(problem.methodSignature)}</strong><p>Public examples</p></div><ul>${samples}</ul><details><summary>Constraints</summary><ul>${problem.constraints.map((constraint) => `<li>${escapeHtml(constraint)}</li>`).join('')}</ul></details></div>
    <label class="editor-label" for="editor-${question.id}">Your Java solution</label>
    <textarea id="editor-${question.id}" class="code-editor" data-code-editor="${question.id}" spellcheck="false">${escapeHtml(problem.starterCode)}</textarea>
    <div class="code-actions"><button type="button" class="secondary-button" data-code-action="sample" data-question="${question.id}">Run examples</button><button type="button" class="primary-button" data-code-action="submit" data-question="${question.id}">Submit solution <span>→</span></button></div>
    <div class="code-result" data-code-result="${question.id}" role="status">Runner idle. Run the examples before submitting.</div>
  </section>`
}

function codingExampleResultsMarkup(examples) {
  if (!Array.isArray(examples) || !examples.length) return ''
  const rows = examples.map((example) => {
    const actual = example.actual === null ? 'No result' : String(example.actual)
    const status = example.passed ? 'Passed' : 'Wrong'
    return `<article class="code-example-result ${example.passed ? 'passed' : 'failed'}"><div><strong>Example ${example.index}</strong><span class="example-status">${status}</span></div><p><b>Input:</b> <code>${escapeHtml(JSON.stringify(example.input))}</code></p><p><b>Expected:</b> ${escapeHtml(String(example.expected))}<br /><b>Your result:</b> ${escapeHtml(actual)}</p></article>`
  }).join('')
  return `<div class="code-example-results"><strong>Public example results</strong>${rows}</div>`
}

function renderQuestion(question, index) {
  const label = question.type === 'multiple_choice' ? 'Multiple-choice' : question.type === 'short_answer' ? 'Short answer' : 'LeetCode medium'
  const meta = `<div class="question-meta"><span>${String(index + 1).padStart(2, '0')}</span><span>${label}</span><span>${escapeHtml(question.subjectTitle)}</span><span>${escapeHtml(question.difficulty)}</span><span>${questionPoints(question)} points</span></div>`
  if (question.type === 'multiple_choice') {
    const options = question.options.map((option) => `<button type="button" class="option" data-option="${option.id}" data-question="${question.id}" aria-pressed="false"><span class="option-text">${escapeHtml(option.text)}</span></button>`).join('')
    return `<article class="question-card" data-question-id="${question.id}">${meta}<p class="question-prompt">${escapeHtml(question.prompt)}</p><div>${options}</div><div class="answer-feedback" data-feedback-for="${question.id}"></div>${sourceMarkup(question)}</article>`
  }
  if (question.type === 'short_answer') {
    return `<article class="question-card" data-question-id="${question.id}">${meta}<p class="question-prompt">${escapeHtml(question.prompt)}</p><textarea name="${question.id}" placeholder="Write your answer here..."></textarea><div class="answer-feedback" data-feedback-for="${question.id}"></div>${sourceMarkup(question)}</article>`
  }
  return `<article class="question-card" data-question-id="${question.id}">${meta}<p class="question-prompt">${escapeHtml(question.prompt)}</p>${codingMarkup(question, state.problems.get(question.problemId))}<div class="answer-feedback" data-feedback-for="${question.id}"></div>${sourceMarkup(question)}</article>`
}

async function loadQuestionBank(localQuestions) {
  const config = window.QUIZ_CONFIG || {}
  if (!config.supabaseUrl || !config.supabaseAnonKey) return localQuestions
  try {
    const endpoint = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/quiz_questions?select=payload&published=eq.true&order=id`
    const response = await fetch(endpoint, { headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` } })
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`)
    const rows = await response.json()
    const remoteQuestions = rows.map((row) => row.payload).filter(Boolean)
    if (!remoteQuestions.length) return localQuestions
    if (remoteQuestions.length < localQuestions.length) {
      state.questionSource = 'local-stale-supabase'
      state.questionSourceMessage = `Supabase returned ${remoteQuestions.length} questions, but the local bank has ${localQuestions.length}. Using the newer local bank until Supabase is reseeded.`
      return localQuestions
    }
    state.questionSource = 'supabase'
    return remoteQuestions
  } catch (error) {
    console.warn('Supabase question load failed; using local bank.', error)
    return localQuestions
  }
}

function generateTest() {
  const pool = buildPool()
  if (!pool.length) {
    byId('quiz-section').hidden = true
    byId('notification').hidden = false
    byId('notification').textContent = 'No questions match this configuration. Turn on the LeetCode slot or choose another type.'
    return
  }
  const requested = Number(byId('question-count').value)
  const count = Math.min(Math.max(requested || 1, 1), pool.length)
  const selected = byId('question-type').value === 'mixed'
    ? composeMixedTest(pool, count)
    : shuffle(pool).slice(0, count)
  state.activeQuestions = selected.slice(0, count)
  state.answers = new Map()
  state.scores = new Map()
  state.codeResults = new Map()
  state.submitting = false
  state.submitted = false
  byId('quiz-form').innerHTML = state.activeQuestions.map(renderQuestion).join('')
  byId('quiz-section').hidden = false
  byId('results').hidden = true
  byId('progress-pill').textContent = `0 / ${state.activeQuestions.length}`
  byId('notification').hidden = false
  const coding = state.activeQuestions.find((question) => question.type === 'leetcode')
  byId('notification').textContent = `Test ready · ${state.activeQuestions.length} questions: ${state.activeQuestions.filter((question) => question.type === 'multiple_choice').length} multiple-choice, ${state.activeQuestions.filter((question) => question.type === 'short_answer').length} short answer, ${coding ? `coding: ${coding.prompt.slice(0, 48)}…` : 'no coding'}.`
  byId('quiz-section').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function generateFixedTest() {
  const shortAnswers = shuffle(state.questions.filter((question) => question.type === 'short_answer'))
  const coding = pickCodingProblem(state.questions)
  if (shortAnswers.length < 10 || !coding) {
    byId('quiz-section').hidden = true
    byId('notification').hidden = false
    byId('notification').textContent = `The fixed test needs 10 short-answer questions and 1 coding problem. Available: ${shortAnswers.length} short-answer questions and ${coding ? 1 : 0} coding problems.`
    return
  }
  state.activeQuestions = [...shortAnswers.slice(0, 10), coding]
  state.answers = new Map()
  state.scores = new Map()
  state.codeResults = new Map()
  state.submitting = false
  state.submitted = false
  byId('quiz-form').innerHTML = state.activeQuestions.map(renderQuestion).join('')
  byId('quiz-section').hidden = false
  byId('results').hidden = true
  byId('progress-pill').textContent = `0 / ${state.activeQuestions.length}`
  byId('notification').hidden = false
  byId('notification').textContent = `Fixed interview test ready · 10 short-answer questions + 1 medium coding problem from the ${state.questionSource === 'supabase' ? 'Supabase live bank' : 'local curated bank'}.`
  byId('quiz-section').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function readAnswer(question) {
  if (question.type === 'multiple_choice') return state.answers.get(question.id) || ''
  return document.querySelector(`[name="${question.id}"]`)?.value.trim() || ''
}

function gradeShortAnswer(question, answer) {
  const normalized = answer.toLowerCase()
  const matched = question.rubric.filter((group) => group.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))
  return { score: matched.length, max: question.rubric.length, matched: matched.map((group) => group.label), missing: question.rubric.filter((group) => !matched.includes(group)).map((group) => group.label) }
}

function revealFeedback(question, answer, score) {
  const feedback = document.querySelector(`[data-feedback-for="${question.id}"]`)
  if (question.type === 'multiple_choice') {
    const correctText = question.options.find((option) => option.id === question.correctOptionId)?.text
    feedback.innerHTML = `<div class="explanation"><strong>${score ? 'Correct' : 'Review this'}</strong><p><b>Correct answer:</b> ${escapeHtml(correctText)}<br />${escapeHtml(question.explanation)}</p></div>`
    return
  }
  if (question.type === 'short_answer') {
    const grade = gradeShortAnswer(question, answer)
    feedback.innerHTML = `<div class="reference"><strong>Reference answer</strong><p>${escapeHtml(question.referenceAnswer)}</p></div><div class="explanation"><strong>Rubric score: ${grade.score} / ${grade.max}</strong><p>${escapeHtml(question.explanation)}</p>${grade.matched.length ? `<p><b>Matched:</b> ${escapeHtml(grade.matched.join(', '))}</p>` : ''}${grade.missing.length ? `<p><b>Missing:</b> ${escapeHtml(grade.missing.join(', '))}</p>` : ''}</div>`
    return
  }
  const result = state.codeResults.get(question.id)
  const status = result?.status === 'accepted' ? 'Code accepted' : result ? `${score} / ${questionPoints(question)} coding points` : 'Run the code to receive points'
  feedback.innerHTML = `<div class="reference"><strong>Reference approach</strong><p>${escapeHtml(question.referenceAnswer)}</p></div><div class="explanation"><strong>Why it matters</strong><p>${escapeHtml(question.explanation)}</p></div><div class="code-score-note"><strong>${status}</strong><span>Public examples are visible; hidden tests remain private and contribute to the coding score.</span></div>`
}

function calculateScore() {
  return state.activeQuestions.reduce((total, question) => total + (state.scores.get(question.id) || 0), 0)
}

function correctAnswer(question) {
  if (question.type === 'multiple_choice') return question.options.find((option) => option.id === question.correctOptionId)?.text || ''
  return question.referenceAnswer || ''
}

function codingScore(result, maximum) {
  if (!result) return 0
  if (result.status === 'accepted') return maximum
  if (result.status === 'compile_error' || result.status === 'runtime_error' || result.status === 'timeout') return 0
  const examples = Array.isArray(result.examples) ? result.examples : []
  const publicPassed = examples.filter((example) => example.passed).length
  if (examples.length && publicPassed === examples.length && result.total > examples.length) return Math.max(1, maximum - 1)
  return result.passed > 0 ? 1 : 0
}

function codingReviewMarkup(question) {
  const result = state.codeResults.get(question.id)
  if (!result) return '<div class="code-score-note"><strong>Code was not submitted</strong><span>Run examples, then submit the quiz to run public and hidden tests for points.</span></div>'
  const label = result.mode === 'sample' && result.status === 'accepted'
    ? 'Public examples passed'
    : result.status === 'accepted'
      ? 'Code accepted'
      : 'Code needs review'
  const points = result.mode === 'submit' ? codingScore(result, questionPoints(question)) : null
  const pointsText = points === null ? '' : ` · ${points} / ${questionPoints(question)} coding points`
  return `<div class="code-score-note"><strong>${label}</strong><span>${result.passed} / ${result.total} tests${pointsText} · ${escapeHtml(result.message)}</span></div>${codingExampleResultsMarkup(result.examples)}`
}

function reviewItemMarkup(question) {
  const score = state.scores.get(question.id) || 0
  const max = questionPoints(question)
  const status = score === max ? 'Correct' : score ? 'Partially correct' : 'Review this'
  const answerLabel = question.type === 'multiple_choice' ? 'Correct answer' : question.type === 'short_answer' ? 'Reference answer' : 'Reference approach'
  const rating = questionRatings()[question.id] || ''
  const ratingMarkup = rating === 'need_explanation'
    ? `<div class="review-feedback"><strong>More explanation requested</strong><p>This question was flagged for clearer wording or a deeper explanation. The current answer, explanation, and source are included here for review.</p></div>`
    : rating === 'bad'
      ? '<div class="review-feedback"><strong>Removed from future quizzes</strong><p>This question will stay out of future quiz pools on this browser.</p></div>'
      : rating === 'good'
        ? '<div class="review-feedback"><strong>Marked good</strong><p>This question remains available for future practice.</p></div>'
        : ''
  const codeReview = question.type === 'leetcode' ? codingReviewMarkup(question) : ''
  return `<details class="review-item" data-question-id="${question.id}" open><summary><span class="review-label">${escapeHtml(status)} · ${escapeHtml(question.type === 'multiple_choice' ? 'Multiple-choice' : question.type === 'short_answer' ? 'Short answer' : 'Coding')} · ${escapeHtml(question.subjectTitle)}</span><strong>${escapeHtml(question.prompt)}</strong><span class="review-score">${score} / ${max} points</span></summary><div class="review-explanation"><p><b>${answerLabel}:</b> ${escapeHtml(correctAnswer(question))}</p><div class="review-detail"><strong>Explanation</strong><p>${escapeHtml(question.explanation)}</p></div>${codeReview}${questionRatingMarkup(question)}${ratingMarkup}<p><b>Further reading:</b> <a href="${escapeHtml(question.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(question.source.label)} ↗</a></p></div></details>`
}

function renderResults() {
  const score = calculateScore()
  const maxPoints = state.activeQuestions.reduce((total, question) => total + questionPoints(question), 0)
  const percent = maxPoints ? Math.round((score / maxPoints) * 100) : 0
  const bySubject = state.activeQuestions.reduce((result, question) => {
    const current = result[question.subjectTitle] || { score: 0, max: 0 }
    current.score += state.scores.get(question.id) || 0
    current.max += questionPoints(question)
    result[question.subjectTitle] = current
    return result
  }, {})
  const subjectRows = Object.entries(bySubject).map(([subject, value]) => `<div class="result-row"><span>${escapeHtml(subject)}</span><strong>${value.score} / ${value.max} points</strong></div>`).join('')
  const reviewMarkup = `<section class="review-list"><h3>Review every answer and explanation</h3>${state.activeQuestions.map(reviewItemMarkup).join('')}</section>`
  const requestedExplanations = state.activeQuestions.filter((question) => questionRatings()[question.id] === 'need_explanation').length
  const feedbackSummary = requestedExplanations ? `<div class="feedback-summary"><strong>${requestedExplanations} explanation request${requestedExplanations === 1 ? '' : 's'} recorded</strong><p>The flagged review items include the current explanation and source so they can be improved in a future bank update.</p></div>` : ''
  byId('results').innerHTML = `<div class="section-heading"><div><p class="eyebrow">04 / review</p><h2 id="results-title">Your result</h2></div><span class="pill">browser-local</span></div><div class="result-summary"><div class="score-number">${percent}%</div><div><p>${score} of ${maxPoints} points.</p><p class="microcopy">Every question includes its answer, explanation, and further-reading link. MCQs use exact answers, short answers use concept rubrics, and coding problems use runner tests.</p></div></div>${feedbackSummary}<div>${subjectRows}</div>${reviewMarkup}`
  byId('results').hidden = false
  byId('results').scrollIntoView({ behavior: 'smooth', block: 'start' })
  localStorage.setItem('java-expert-last-result', JSON.stringify({ score, maxPoints, percent, at: new Date().toISOString(), ratings: Object.fromEntries(state.activeQuestions.map((question) => [question.id, questionRatings()[question.id] || null])) }))
}

function runnerUrl() {
  return document.querySelector('meta[name="quiz-runner-url"]')?.content.replace(/\/$/, '') || ''
}

async function runCode(questionId, mode, button) {
  const question = state.activeQuestions.find((item) => item.id === questionId)
  const problem = question && state.problems.get(question.problemId)
  const editor = document.querySelector(`[data-code-editor="${questionId}"]`)
  const resultBox = document.querySelector(`[data-code-result="${questionId}"]`)
  if (!question || !problem || !editor || !resultBox) return
  const base = runnerUrl()
  if (!base) { resultBox.className = 'code-result error'; resultBox.textContent = 'Runner URL is not configured.'; return }
  button.disabled = true
  resultBox.className = 'code-result pending'
  resultBox.textContent = mode === 'sample' ? 'Running public examples...' : 'Compiling and checking public plus hidden tests...'
  try {
    const response = await fetch(`${base}/api/problems/${problem.id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceCode: editor.value, mode }) })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Runner request failed')
    state.codeResults.set(questionId, { ...payload, mode })
    resultBox.className = `code-result ${payload.status}`
    resultBox.innerHTML = `<strong>${escapeHtml(payload.message)}</strong><span>${payload.passed} / ${payload.total} tests · ${escapeHtml(payload.status)}</span>${codingExampleResultsMarkup(payload.examples)}${payload.details ? `<pre>${escapeHtml(payload.details)}</pre>` : ''}`
    if (mode === 'submit') {
      state.scores.set(question.id, codingScore(payload, questionPoints(question)))
      revealFeedback(question, editor.value, state.scores.get(question.id))
      if (state.submitted && !state.submitting) renderResults()
    }
  } catch (error) {
    resultBox.className = 'code-result error'
    resultBox.textContent = error.message
  } finally {
    button.disabled = false
  }
}

function bindEvents() {
  byId('generate-test').addEventListener('click', generateTest)
  byId('fixed-test').addEventListener('click', generateFixedTest)
  byId('quiz-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    state.submitting = true
    for (const question of state.activeQuestions.filter((item) => item.type === 'leetcode')) {
      const previous = state.codeResults.get(question.id)
      if (previous?.mode !== 'submit') {
        const submitButton = document.querySelector(`[data-code-action="submit"][data-question="${question.id}"]`)
        await runCode(question.id, 'submit', submitButton)
      }
    }
    state.submitting = false
    state.submitted = true
    state.activeQuestions.forEach((question) => {
      const answer = readAnswer(question)
      state.answers.set(question.id, answer)
      const score = question.type === 'multiple_choice' ? (answer === question.correctOptionId ? 1 : 0) : question.type === 'short_answer' ? gradeShortAnswer(question, answer).score : state.scores.get(question.id) || 0
      state.scores.set(question.id, score)
      revealFeedback(question, answer, score)
    })
    renderResults()
  })
  ;['subject-filter', 'category-filter', 'question-type', 'question-count', 'include-leetcode'].forEach((id) => byId(id).addEventListener('input', renderComposition))
  byId('quiz-form').addEventListener('click', (event) => {
    const ratingButton = event.target.closest('[data-rating]')
    if (ratingButton) {
      setQuestionRating(ratingButton.dataset.question, ratingButton.dataset.rating)
      return
    }
    const option = event.target.closest('[data-option]')
    if (option) {
      state.answers.set(option.dataset.question, option.dataset.option)
      option.closest('.question-card').querySelectorAll('[data-option]').forEach((candidate) => {
        const selected = candidate === option
        candidate.classList.toggle('is-selected', selected)
        candidate.setAttribute('aria-pressed', String(selected))
      })
      return
    }
    const codeButton = event.target.closest('[data-code-action]')
    if (codeButton) runCode(codeButton.dataset.question, codeButton.dataset.codeAction, codeButton)
  })
  byId('results').addEventListener('click', (event) => {
    const ratingButton = event.target.closest('[data-rating]')
    if (ratingButton) setQuestionRating(ratingButton.dataset.question, ratingButton.dataset.rating)
  })
}

async function init() {
  const [questionResponse, suggestionResponse, problemResponse, catalogResponse] = await Promise.all([fetch('data/questions.json'), fetch('data/suggestions.json'), fetch('data/problems.json'), fetch('data/javexp-quiz-catalog.json')])
  state.questions = await loadQuestionBank(await questionResponse.json())
  state.problems = new Map((await problemResponse.json()).map((problem) => [problem.id, problem]))
  state.catalog = await catalogResponse.json()
  state.suggestions = await suggestionResponse.json()
  populateFilters()
  const params = new URLSearchParams(window.location.search)
  const subject = params.get('subject')
  const returnUrl = params.get('return') || 'https://relrtl-hub.github.io/javexp/'
  byId('return-javexp').href = returnUrl
  if (params.get('question') === 'one') {
    byId('question-count').value = '1'
  }
  if (subject) {
    byId('subject-filter').value = state.catalog.subjects.some((item) => item.slug === subject) ? subject : 'all'
    const subjectTitle = state.catalog.subjects.find((item) => item.slug === subject)?.title || state.questions.find((question) => question.subjectId === subject)?.subjectTitle
    byId('subject-context').hidden = false
    byId('subject-context').textContent = subjectTitle ? `Focused quiz: ${subjectTitle}` : `No questions are currently mapped to subject “${subject}”.`
  }
  renderSuggestions()
  byId('bank-size').textContent = `${state.questions.length} questions loaded`
  byId('bank-source').textContent = state.questionSource === 'supabase' ? 'Supabase live bank' : state.questionSource === 'local-stale-supabase' ? 'Local JSON fallback · hosted bank behind' : 'Local JSON fallback'
  if (state.questionSourceMessage) {
    byId('notification').hidden = false
    byId('notification').textContent = state.questionSourceMessage
  }
  renderComposition()
  bindEvents()
  if (params.get('question') === 'one') generateTest()
}

init().catch((error) => {
  byId('notification').hidden = false
  byId('notification').textContent = `The local quiz data could not load: ${error.message}`
})