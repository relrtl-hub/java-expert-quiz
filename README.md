# Java Expert - The Quiz

A small, public, static quiz companion for [javexp](https://github.com/relrtl-hub/javexp).

## Version 1

This first slice has no account system. It works without a database, and now has an optional Supabase question-bank adapter. It also uses a small stateless runner for Java code submissions.

- Questions are stored in `data/questions.json`.
- Suggested `javexp` areas are stored in `data/suggestions.json`.
- Tests are generated immediately in the browser.
- Multiple-choice questions are scored automatically.
- Short answers use transparent concept-group rubrics with partial credit.
- After submission, every question stays in the results review with its correct/reference answer, explanation, and further-reading link, including questions answered correctly.
- The LeetCode question has a real Java editor workflow with public examples and server-side hidden tests.
- The latest result is saved only in this browser's `localStorage`.
- The suggestion area stores your Add subject / Not now decision in this browser's `localStorage`.
- `data/javexp-quiz-catalog.json` is the versioned subject-slug contract shared with `javexp`.
- `SUPABASE_SETUP.md` documents the optional free hosted question bank, RLS schema, seed, and browser configuration.
- Every question includes a public source link and a note explaining whether it is paraphrased or synthesized.

The current bank contains 137 questions: 77 multiple-choice, 51 short-answer, and 9 medium coding questions, with at least five questions mapped to every current quiz subject. Coverage now includes Kafka, Redis, LRU/LFU caching, race conditions, JUnit, Testcontainers, rate limiting, circuit breakers, virtual threads, Project Reactor, Kubernetes, Docker, Apache Flink, ClickHouse, and JVM internals. The default interview test creates exactly 10 questions: 7 multiple-choice, 2 short answers, and 1 randomly rotated coding problem. A separate fixed mode creates 10 short-answer questions plus 1 coding problem. Coding prompts are original summaries linked to official LeetCode references and public CoderPad topic pages; the project does not copy CoderPad or LeetCode solutions. Coding keeps a higher 3-point weight; short answers use 2-point concept rubrics.

## Database direction

Supabase Free is now prepared as an optional question-bank backend. Without `supabase/config.js`, the app uses local JSON. With a configured project, it reads published rows through the Supabase REST API and falls back to local JSON if the request fails. The official free tier currently includes 500 MB of database storage and can pause inactive projects, so it is suitable for development and a small personal quiz but should not be treated as an uptime guarantee.

The current database slice adds questions with strict read-only RLS. Question versions, suggestion decisions, and optional synchronized progress remain later phases. It uses a public publishable key only. Service-role keys must stay server-side and never enter this repository.

## Run locally

The app loads JSON over HTTP, so serve the folder instead of opening `index.html` directly:

```bash
python -m http.server 4173
```

Open `http://127.0.0.1:4173/`. The page expects the local runner at `http://127.0.0.1:8787` for coding questions.

Start the development runner in a second terminal:

```bash
RUNNER_MODE=local node runner/server.js
```

Local mode uses the installed `javac` and `java` commands. It is for development only. A public deployment must use the adapter's Judge0 mode and keep `RUNNER_PROBLEMS_DIR` outside the public static repository.

## Runner deployment

The adapter exposes:

- `GET /health`
- `POST /api/problems/:problemId/run` with `{ "sourceCode": "...", "mode": "sample" | "submit" }`

Without `RUNNER_MODE=local`, it forwards a wrapped Java submission to Judge0 using `JUDGE0_URL`, `JUDGE0_API_KEY`, and each problem's configured `languageId`. Hidden cases are loaded from `runner/private-problems/`, which is ignored by Git and must be provisioned privately on the runner host. Never put that directory in the GitHub Pages artifact or a public repository.

## Checks

```bash
npm test
node --check app.js
node --check runner/server.js
```

## GitHub Pages

The repository includes `.github/workflows/pages.yml` for workflow-based GitHub Pages deployment. The workflow assembles only `index.html`, `styles.css`, `app.js`, and the public `data/` files into the Pages artifact. Runner code and hidden tests are excluded. Publishing is intentionally separate from local implementation. The workflow does not require PostgreSQL or Supabase.

GitHub Pages serves the static files. Browser-local progress is not shared between devices.
