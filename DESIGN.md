# Java Expert - The Quiz

## Product design

**Status:** Design proposal  
**Relationship:** Standalone companion project for `javexp`  
**Audience:** Java engineers preparing for interviews and practicing production reasoning  
**Design principle:** The quiz should test understanding, not reward memorized trivia.

---

## 1. Product goal

`javexp` is the reference site. `Java Expert - The Quiz` is the active practice loop around it:

1. Select the Java subjects to practice.
2. Generate a balanced test from a curated question bank.
3. Answer multiple-choice, short-answer, and one medium coding question.
4. Submit once, or submit after each question in practice mode.
5. See the score, the correct answer, an explanation, source links, and the related `javexp` subject.
6. Record weak areas and use them to generate the next test.
7. Surface important topics that are missing from `javexp`.

The quiz is not a generic question generator. Every question has a subject mapping, difficulty, answer rubric, explanation, provenance, and validation state.

---

## 2. Scope of the first version

### Required in MVP

- Multiple-choice questions with exactly four answers and exactly one correct answer.
- Short-answer questions expected to take one or two lines.
- One medium-level LeetCode slot per test, configurable on or off.
- Subject and category selection based on the `javexp` catalog.
- Test configuration before generation.
- Generation status page with progress and ready state.
- In-app notification when a requested test is ready.
- Immediate score calculation after submission.
- Correct answer and explanation shown after submission.
- Source attribution and links on every question.
- Suggestions for new `javexp` areas when a question has no good subject mapping.
- History of completed tests and per-subject performance.
- Deterministic short-answer rubrics with partial credit.
- A stateless Java coding runner with public examples and private hidden tests.

### Later, not required for the first slice

- Email, Telegram, or Slack notifications.
- Shared tests and public leaderboards.
- Team or company question packs.
- Adaptive difficulty that changes during the same test.
- User-authored questions and moderation workflows.

Start with a small vertical slice: a fixed question bank, three existing `javexp` categories, one complete generation flow, one notification type, and one score report. Do not begin with an unrestricted web scraper or a fully autonomous question-writing system. That would produce a very confident pile of rubbish.

---

## 3. Current `javexp` integration boundary

The inspected `javexp` catalog currently contains **50 subjects across 14 categories**. Important existing areas include:

- Java runtime: `equals()` and `hashCode()`, Java Memory Model.
- Design patterns: Rule Engine, Singleton, Strategy, Factory Method, Builder, Decorator, Chain of Responsibility.
- Collections and caching: LRU Cache, LFU Cache.
- Data structures and algorithms: tree traversal, binary search tree, binary search, sliding window.
- Concurrency and async: CompletableFuture, race conditions, virtual threads, Reactor, Vert.x.
- Backend and data systems: Kafka, Redis, Aerospike, ClickHouse, Apache Pinot, Iceberg, Parquet, Pulsar, Flink.
- Kubernetes and containers: Kubernetes object families, services, storage, policy, YAML, Helm, Docker lifecycle and registries.
- Testing and engineering: JUnit, Testcontainers.
- System design: rate limiter and circuit breaker.

The quiz project should not import `src/data.ts` directly. That would couple two applications to one implementation file. Instead, `javexp` should expose or generate a versioned catalog manifest:

```json
{
  "catalogId": "javexp",
  "catalogVersion": "0.1.0",
  "subjects": [
    {
      "id": "java-memory-model",
      "title": "Java Memory Model",
      "categoryId": "java-runtime",
      "levels": ["Advanced"],
      "url": "https://javexp.example/#java-memory-model",
      "tags": ["threads", "visibility", "volatile"]
    }
  ]
}
```

The quiz stores the catalog version used for each generated test. If a subject is renamed or removed later, historical results remain understandable.

### Synchronization rules

- `javexp` owns subject identity, category identity, titles, and subject URLs.
- The quiz owns question content, rubrics, question provenance, and quiz history.
- A question can map to one primary subject and several related subjects.
- A question without a strong mapping is not silently attached to a nearby subject. It becomes a candidate for a new-area suggestion.
- Core anchor subjects should never disappear just because a user filters another category. The quiz should preserve the same stable taxonomy users see in `javexp`.

---

## 4. User flows

### 4.1 Generate a test now

1. Select **Create test**.
2. Choose mode: `Practice` or `Interview simulation`.
3. Choose subjects or categories.
4. Choose question types and counts.
5. Choose difficulty and optional time limit.
6. Choose whether to include one LeetCode medium question.
7. Review the estimated composition.
8. Select **Generate test**.
9. The request is queued and receives a test ID immediately.
10. The user can stay on the page, leave, or continue browsing `javexp`.
11. When ready, the test appears in the in-app notification center. Browser push is an optional notification channel.
12. Select **Start test**.

For a small, already validated bank, generation should normally be immediate. The asynchronous job model is still used so the user experience does not change when a future test needs source retrieval, validation, or model generation.

### 4.2 Practice mode

- Show one question at a time.
- Allow **Check answer** after each question.
- Reveal the correct answer and explanation immediately.
- Do not allow changing the answer after checking.
- Keep a running score, but make the final score the official result.
- Allow the user to bookmark a question for review.

### 4.3 Interview simulation

- Show the full test without explanations.
- Enforce the time limit if configured.
- Do not reveal whether an answer is correct until submission.
- For the short-answer question, show the rubric and ideal answer only after submission.
- For the coding slot, show the editor and return compile, runtime, wrong-answer, timeout, and accepted results from the stateless runner.

### 4.4 Generate a focused test from weak areas

After a completed test, show:

- Lowest scoring subjects.
- Questions answered slowly or with low confidence.
- Suggested `javexp` reading links.
- A button to generate a follow-up test containing only those subjects.

This is more useful than pretending the user needs another random set of questions.

---

## 5. Test configuration

The generator must support configuring the exact composition. The first screen should expose these controls:

| Setting | MVP behavior |
|---|---|
| Categories | Select one or more of the `javexp` categories |
| Subjects | Select individual subjects, overriding category selection |
| Multiple-choice | On/off, count 0 to 20 |
| Short answer | On/off, count 0 to 10 |
| LeetCode medium | Off, one question, or one question selected from chosen algorithm subjects |
| Difficulty | Foundations, Intermediate, Advanced, or mixed |
| Mode | Practice or interview simulation |
| Time limit | None, 15, 30, 45, or 60 minutes |
| Explanations | Immediate in practice mode, after submission in simulation mode |
| Avoid repeats | Prefer unseen questions, then least recently seen |
| Source policy | Curated bank only in MVP; no live web scraping during a test |

The UI should show a composition preview before generation:

```text
Java Memory Model + CompletableFuture

8 multiple-choice   2 short answer   1 LeetCode medium
Estimated time: 35 minutes
Difficulty: Intermediate / Advanced
```

A user can choose a single type, for example:

- Only multiple-choice questions.
- Only short answers for concurrency.
- Only one LeetCode medium problem.
- A full mixed interview simulation.

Configuration is stored with the test request so the result can be reproduced and audited.

---

## 6. Question types

### 6.1 Multiple-choice

Contract:

- Exactly four options.
- Exactly one correct option.
- Distractors must be plausible but unambiguously wrong under the stated assumptions.
- The question must include assumptions such as Java version, thread count, or configuration when they affect the answer.
- The explanation must state why the correct option is correct and why the important distractors are wrong.

Example shape:

```json
{
  "id": "q-jmm-0001",
  "type": "multiple_choice",
  "subjectId": "java-memory-model",
  "difficulty": "advanced",
  "prompt": "A worker reads a volatile boolean flag in a loop. What guarantee does volatile provide here?",
  "options": [
    {"id": "a", "text": "Visibility and ordering for accesses to the flag"},
    {"id": "b", "text": "Atomicity for every compound operation"},
    {"id": "c", "text": "Mutual exclusion around the loop body"},
    {"id": "d", "text": "A guarantee that the loop will terminate"}
  ],
  "correctOptionId": "a",
  "explanation": "volatile provides visibility and ordering for the volatile field. It does not make operations such as count++ atomic and it does not provide a lock.",
  "references": [
    {"label": "Java Language Specification, Threads and Locks", "url": "https://docs.oracle.com/javase/specs/jls/se26/html/jls-17.html"}
  ]
}
```

### 6.2 Short answer

Contract:

- Prompt asks for a bounded answer, normally one or two lines.
- Scoring uses a rubric, not exact string matching.
- The user sees the expected answer, required concepts, missing concepts, and explanation.
- The accepted answer can have several technically correct phrasings.

Example rubric:

```json
{
  "type": "short_answer",
  "prompt": "Why can HashMap be unsafe when multiple threads modify it concurrently?",
  "idealAnswer": "HashMap is not synchronized, so concurrent structural updates can race and produce inconsistent behavior. Use external synchronization or a concurrent map when the access pattern requires it.",
  "requiredConcepts": [
    "HashMap is not thread-safe",
    "concurrent structural modification can race",
    "a synchronization strategy or concurrent collection is needed"
  ],
  "commonMistakes": [
    "claims that HashMap is always safe for concurrent reads and writes",
    "confuses fail-fast iteration with thread safety"
  ]
}
```

### 6.3 LeetCode medium

The MVP should store a problem reference, not copy LeetCode content into the project:

- Problem title.
- Official URL.
- Difficulty.
- Topic tags.
- Related `javexp` subjects.
- A short original instruction such as `Open the official problem, solve it in Java, and record your result.`
- Optional hint strategy written by this project.

For example, `Top K Frequent Elements` maps naturally to `collections-caching` and can reinforce hash maps, counting, heaps, and complexity reasoning. The official page identifies it as Medium and requires better than `O(n log n)` time in the follow-up: `https://leetcode.com/problems/top-k-frequent-elements`.

Do not scrape or republish LeetCode statements, editorial text, or solutions. LeetCode's terms explicitly restrict scraping and treat questions and solutions as protected content. The product should deep-link to the official problem and maintain a small, licensed or original metadata catalog. The implemented local coding mode uses an original paraphrase and independent tests inspired by the same algorithmic pattern.

The implemented coding result flow:

1. `Run examples` executes only public sample cases.
2. `Submit solution` executes public plus private hidden cases through the runner.
3. The score report awards coding points only when the runner returns `accepted`.

The runner is stateless and stores no user history. Hidden cases live outside the static Pages artifact.

---

## 7. Question generation architecture

### 7.1 Use a curated bank first

The system should not generate every question from a live web search. Use a two-stage pipeline:

```text
Web and official documentation
        |
        v
Source registry and topic extraction
        |
        v
Original question bank with provenance
        |
        v
Validation: answer, distractors, rubric, mapping, references
        |
        v
Test composer and repetition control
        |
        v
User test
```

A generated test may select an existing validated question and randomize option order. New question generation is an editorial workflow, not an invisible step inside every user request.

### 7.2 Source policy

Use web sources as inspiration and evidence, then write original prompts and explanations:

- **Interview-oriented discovery:** Baeldung Java interview articles, GeeksforGeeks Java interview collections, and other clearly attributed public question indexes.
- **Cross-checking:** official Java Language Specification and Java API documentation.
- **Technology-specific authority:** official Kafka, Redis, Kubernetes, JUnit, Testcontainers, Flink, Pulsar, and vendor documentation.
- **LeetCode:** official problem page for the link and metadata only, subject to its terms.

The source registry should capture:

```text
sourceId
url
title
publisher
sourceType: interview_index | official_docs | problem_reference
retrievedAt
licenseStatus: link_only | attribution_allowed | approved_reuse | unknown
notes
```

Unknown license status means link and attribution only. Never copy paragraphs into the bank just because they are publicly visible.

### 7.3 Question authoring and validation

Each candidate question passes these checks:

1. **Subject fit:** it maps to a current `javexp` subject or is explicitly marked as a new-area candidate.
2. **Technical truth:** the answer is checked against an authoritative reference.
3. **Version context:** Java version or tool version is stated when behavior changes by version.
4. **Single-answer proof:** multiple-choice questions have one defensible correct option.
5. **Distractor quality:** distractors represent realistic misconceptions, not jokes.
6. **Explanation quality:** the explanation teaches the rule and the boundary where it stops applying.
7. **Short-answer rubric:** required concepts and common mistakes are present.
8. **Difficulty:** the expected reasoning level is justified.
9. **Duplicate check:** semantic similarity and normalized prompt checks prevent near duplicates.
10. **Human review:** new or low-confidence questions remain unpublished until reviewed.

The LLM can propose wording, distractors, and an explanation. It must not be treated as the final authority. The final record includes validation status and reviewer identity or automated-check evidence.

### 7.4 Test generation job

Use a job record even if most MVP tests finish quickly:

```text
requested -> queued -> composing -> validating -> ready
                                      |
                                      -> failed
ready -> started -> submitted -> scored
```

A job contains:

- `testId` and `requestId`.
- User configuration.
- `catalogVersion`.
- Selected question IDs and ordering seed.
- Generation status and progress.
- Error code if failed.
- Created and completed timestamps.
- Notification delivery status.

The composer should first satisfy hard constraints, then optimize soft constraints:

- Hard: requested counts, types, selected subjects, one correct option, one LeetCode slot if enabled.
- Soft: balanced subject coverage, difficulty mix, no recent repeats, varied wording, estimated duration.

If the requested configuration cannot be satisfied, show the exact shortage, for example: `Only 3 validated short-answer questions exist for Apache Flink. Generate with 2, or include another subject.` Do not silently substitute unrelated questions.

---

## 8. Notifications

### MVP recommendation

Use two levels:

1. **In-app notification:** always available, reliable, and easy to verify.
2. **Browser notification:** opt-in Web Push or local browser notification when the user leaves the generation page.

The user should see:

```text
Your test is ready
8 multiple-choice, 2 short answer, 1 LeetCode medium
Java Memory Model + CompletableFuture
[Start test]
```

If generation fails:

```text
Test generation failed
Reason: only 1 validated short-answer question exists for this selection.
[Adjust configuration]
```

### Later notification adapters

Add email, Telegram, and Slack only after the in-app job and notification records work. Each adapter should be explicit, opt-in, and independently retryable. The job is complete when the test is ready, not when one external channel succeeds.

### Notification data model

```text
Notification
- id
- userId
- type: test_ready | test_failed | review_reminder
- entityId: testId
- channel: in_app | browser | email | telegram | slack
- status: pending | delivered | failed | dismissed
- createdAt
- deliveredAt
```

Verify notification state by reading back the notification record. Do not call a send response proof of delivery.

---

## 9. Scoring model

### 9.1 Default points

| Question type | Full credit | Partial credit | Default weight |
|---|---:|---:|---:|
| Multiple-choice | 1 | 0 | 1 |
| Short answer | 2 | 1 if materially correct but incomplete | 2 |
| LeetCode slot | 3 | 1 for partial progress, 0 if not solved | 3, reported separately |

The default test score excludes the LeetCode slot from the knowledge percentage and reports it separately:

```text
Knowledge score: 14 / 16 = 87.5%
Coding score: 2 / 3
Overall weighted score: 16 / 19 = 84.2%
```

This avoids making a successful or failed external coding platform session look like a failure to understand Java runtime behavior.

### 9.2 Short-answer scoring

Each short answer has a rubric with required concepts. A simple MVP evaluator:

- `2 points`: all critical concepts are present and no material contradiction.
- `1 point`: the central idea is present but one important detail is missing or imprecise.
- `0 points`: incorrect, contradictory, irrelevant, or blank.

AI-assisted scoring should return:

```text
score: 1
confidence: 0.82
matchedConcepts: [...]
missingConcepts: [...]
contradictions: [...]
reason: "You identified visibility but not the lack of atomicity for compound operations."
```

Scores below a confidence threshold should be marked `Needs review` and allow the user to adjust the score. The ideal answer and explanation are always visible after submission.

### 9.3 Optional configuration

Later, users can choose:

- Equal weighting by question.
- Interview weighting, where short answers and coding count more.
- Practice mode with no score, only feedback.

The saved test always stores the scoring policy used at the time, so later configuration changes do not rewrite history.

---

## 10. Result and explanation experience

After submission, show the score first, then the learning detail:

1. Total score and percentage.
2. Category and subject breakdown.
3. Correct, partial, and incorrect counts.
4. Time used versus configured time.
5. Question review list.
6. For each question:
   - User answer.
   - Correct answer or ideal answer.
   - Explanation.
   - Why the distractors fail, where applicable.
   - Related `javexp` subject.
   - Source and official reference links.
   - `Review this subject` action.
7. Suggested follow-up test.
8. New `javexp` area suggestions discovered during the test.

Explanations should follow this structure:

```text
Correct answer
The rule
Why the tempting answer is wrong
Small example or boundary case
Read next in javexp
Authoritative reference
```

For a question about `CompletableFuture`, for example, the explanation should distinguish a non-async continuation from an async continuation and mention the default executor behavior when relevant. The point is to correct the mental model, not merely display a green checkmark.

---

## 11. Suggesting new areas for `javexp`

The quiz should generate suggestions from coverage gaps, not from random model enthusiasm. A candidate appears when one of these is true:

- Several validated questions cannot map cleanly to an existing subject.
- A source cluster is repeatedly requested but not covered.
- A wrong answer pattern shows a missing prerequisite.
- An existing `javexp` subject is too broad for the question volume.
- A technology has current interview relevance and an authoritative reference set.

A suggestion record should include:

```text
suggestionId
label
reason
supportingQuestionIds
sourceUrls
estimatedSubjectCount
priority
status: proposed | accepted | rejected | merged
```

### Initial recommendations for `javexp`

Based on the current 50-subject catalog and the researched interview sources, the strongest additions are:

1. **JVM internals and garbage collection**
   - Covers class loading, heap and allocation, JIT compilation, GC behavior, pauses, memory leaks, profiling, and production diagnosis.
   - This is the clearest senior-interview gap in the current catalog.

2. **Java collections and generics**
   - Covers HashMap internals, ArrayList versus LinkedList, ConcurrentHashMap, iterators, generics, type erasure, Comparable, and Comparator.
   - It connects directly to the existing LRU/LFU, tree, and algorithm subjects.

3. **Streams and modern Java language features**
   - Covers stream laziness, intermediate versus terminal operations, parallel stream tradeoffs, Optional, records, sealed classes, pattern matching, and virtual-thread-era APIs.
   - It would connect the existing concurrency and runtime subjects to current Java practice.

4. **Exceptions, I/O, and resource management**
   - Covers checked versus unchecked exceptions, try-with-resources, suppressed exceptions, NIO, timeouts, and cancellation.
   - This is a high-value interview area and a prerequisite for production-quality examples.

Treat these as proposed areas. The quiz should show the evidence and let the `javexp` owner accept or reject the suggestion.

---

## 12. Suggested technical architecture

```text
Public GitHub repository
    |
    +--> GitHub Actions: lint, build, deploy
    |       |
    |       v
    |   GitHub Pages: static React application
    |       |
    |       v
    |   Public browser client
    |       |
    |       v
    |   Supabase or another HTTPS backend
    |       |-- Auth and Row-Level Security
    |       |-- Edge/API functions
    |       |-- PostgreSQL
    |       |-- Realtime or notification state
    |       +-- Optional queue and worker
    |
    +--> Versioned question bank and javexp catalog in the repository
```

### 12.1 What GitHub Pages can and cannot do

GitHub Pages can host the public frontend and static content. It cannot run PostgreSQL, a private API, a background worker, or a secret LLM key. The database must live outside the repository and outside the Pages runtime.

### 12.1.1 What Supabase is

Supabase is a hosted backend platform built around PostgreSQL. It gives an application a managed PostgreSQL database plus authentication, HTTPS data APIs, server-side functions, file storage, and realtime events. It is not part of GitHub and it does not run inside GitHub Pages. It is a separate online service that the GitHub Pages frontend can call over HTTPS.

For this project, Supabase would be optional infrastructure. The static MVP can work without it. If accounts and synchronized quiz history are added, Supabase becomes the place where that private application data lives.

There are two valid release modes:

#### Mode A: public static practice site

- GitHub Pages serves the React bundle, the versioned question bank, and the `javexp` catalog manifest.
- The browser composes tests locally.
- Answers, history, and preferences use `localStorage` or IndexedDB.
- No PostgreSQL is needed.
- Data is private to the current browser and does not sync between devices.

This is the right first release if the goal is a public, low-cost study site.

#### Mode B: public application with accounts and synchronization

- GitHub Pages still serves the frontend.
- A managed PostgreSQL provider stores questions, tests, answers, scores, and notifications.
- The browser calls HTTPS API or Edge Function endpoints. It never connects with a database password.
- Authentication identifies the user.
- Row-Level Security ensures one user cannot read another user’s tests or answers.
- Background generation and short-answer scoring run in a backend worker, not in the browser and not in GitHub Pages.

For the first hosted version, **Supabase is the simplest recommendation** because it bundles managed PostgreSQL, authentication, Row-Level Security, HTTPS APIs, Edge Functions, and realtime capabilities. An alternative is Neon or another managed PostgreSQL service plus a separate backend such as Cloudflare Workers, Vercel Functions, or a small hosted API.

### 12.2 Secrets and public configuration

The public repository may contain:

- SQL migrations and schema definitions.
- Seed question data that is intentionally public.
- Frontend configuration containing a public backend URL.
- A Supabase anonymous client key, only if Row-Level Security is correctly configured.

The repository must never contain:

- PostgreSQL username or password.
- Supabase service-role key.
- LLM provider key.
- Email, Telegram, Slack, or webhook secrets.
- Production database dumps containing user data.

Public frontend configuration is not a security boundary. Authorization must be enforced by the backend and database policies. GitHub Actions secrets or backend secret storage should hold privileged credentials.

### Recommended boundaries

- **Catalog adapter:** reads the versioned `javexp` manifest and validates subject IDs.
- **Question bank:** serves only validated questions to production tests.
- **Composer:** satisfies test configuration and repetition rules.
- **Generation worker:** creates or validates candidate questions, never bypassing review status.
- **Scoring service:** deterministic for multiple-choice, rubric-based for short answer, separate for LeetCode.
- **Notification service:** records delivery state per channel.
- **Analytics:** tracks subject coverage, accuracy, time, repeats, and gaps without changing question truth.

Use the same schema in local development and production. Run PostgreSQL locally through Docker Compose or the Supabase CLI, then apply versioned migrations to the managed production database. Do not make SQLite the production database and PostgreSQL a later rewrite; the two systems have different behavior around JSON, constraints, concurrent writes, and authentication integration.

For a public static-first release, omit the database entirely and keep progress local. Add PostgreSQL only when cross-device history, accounts, async generation, or notifications are needed.

---

## 13. Core data model

```text
SubjectRef
- catalogVersion
- subjectId
- categoryId
- titleSnapshot
- javexpUrl

Question
- id
- type
- subjectRef
- relatedSubjectIds
- difficulty
- prompt
- options or rubric
- answerKey
- explanation
- references
- provenance
- validationStatus
- version

TestRequest
- id
- userId
- configuration
- catalogVersion
- status
- seed
- createdAt

TestQuestion
- testId
- questionId
- position
- promptSnapshot
- optionsSnapshot

Answer
- testQuestionId
- response
- submittedAt
- score
- confidence
- feedback

TestResult
- testId
- rawPoints
- maxPoints
- knowledgePoints
- codingPoints
- percentage
- subjectBreakdown
- completedAt

AreaSuggestion
- id
- label
- reason
- evidenceQuestionIds
- supportingReferences
- status
```

Snapshot the question text and options into `TestQuestion`. If the bank changes after a test is generated, the historical test must still show exactly what the user saw.

---

## 14. Build plan

### Slice 1: prove the learning loop, implemented locally

- Create the standalone project.
- Import the versioned `javexp` catalog.
- Add a hand-curated question bank for the mapped Java subjects.
- Implement test configuration and immediate composition.
- Implement multiple-choice scoring, short-answer rubrics, and result explanations.
- Implement the stateless Java runner with public examples and private hidden tests.
- Add local Add subject / Not now actions for area suggestions.
- Store practice history locally in the browser.
- Publish the static frontend through GitHub Pages.

### Slice 2: add database-backed content and synchronized progress

- Add Supabase Free or another managed PostgreSQL backend.
- Add question and question-version tables for a larger curated bank.
- Add suggestion decisions and optional synchronized progress.
- Add authentication and Row-Level Security policies.
- Add queued generation job records and an HTTPS API.
- Add worker status polling.
- Add rubric-based scoring with confidence and review fallback.
- Add question history and repeat avoidance.

### Slice 3: add LeetCode and gap discovery

- Add a metadata-only LeetCode catalog with official links.
- Add coding slot tracking separate from knowledge score.
- Add weak-area test generation.
- Add `AreaSuggestion` records and an acceptance workflow.

### Slice 4: polish and notifications

- Add browser push.
- Store notification state in PostgreSQL and deliver notifications through backend adapters.
- Add accessible keyboard-first quiz flow.
- Add mobile layout.
- Add optional external notification adapters only after read-back verification is reliable.

---

## 15. Acceptance criteria

The first implementation is ready for review when:

- A user can select subjects and question types before generation.
- A generated test contains exactly the requested counts, within available validated inventory.
- Every multiple-choice question has four options and one correct answer.
- Every short-answer question has an ideal answer, rubric, and explanation.
- The test has either zero or one LeetCode medium slot according to configuration.
- A user can submit answers and receive a verified score.
- The correct answer and explanation are visible for every answered question.
- Each question links back to a `javexp` subject or is shown as a new-area candidate.
- A queued test can become `ready` and create an in-app notification.
- Failed generation explains the actual constraint that failed.
- Historical tests remain stable after the question bank or `javexp` catalog changes.
- The app does not scrape or republish LeetCode problem content.
- Lint, typecheck, build, route checks, and representative end-to-end quiz flows pass.

---

## 16. Researched source set

These sources informed the design. They are discovery and authority sources, not content to copy verbatim into the question bank.

- Baeldung, Java concurrency interview questions: https://www.baeldung.com/java-concurrency-interview-questions
- GeeksforGeeks, Java interview questions: https://www.geeksforgeeks.org/java/java-interview-questions/
- GeeksforGeeks, Java collections interview questions: https://www.geeksforgeeks.org/java/java-collections-interview-questions/
- InterviewsVector, Java interview question library and topic roadmap: https://www.interviewsvector.com/java
- Java Language Specification, Chapter 17 Threads and Locks: https://docs.oracle.com/javase/specs/jls/se26/html/jls-17.html
- Java SE API, HashMap: https://docs.oracle.com/en/java/javase/26/docs/api/java.base/java/util/HashMap.html
- Java SE API, CompletableFuture: https://docs.oracle.com/en/java/javase/26/docs/api/java.base/java/util/concurrent/CompletableFuture.html
- Testcontainers Kafka module: https://java.testcontainers.org/modules/kafka/
- LeetCode, Top K Frequent Elements: https://leetcode.com/problems/top-k-frequent-elements
- LeetCode Terms of Service: https://leetcode.com/terms/

Source pages change over time. The implementation should store retrieval time and preserve the source URL, not assume that a web page remains unchanged forever.
