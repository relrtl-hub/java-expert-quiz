# Supabase setup for the quiz

## Create the free project

Open the official Supabase dashboard:

https://supabase.com/dashboard

Create a new project on the Free plan. Supabase currently allows two active free projects per organization. Free projects can pause after about seven days of low activity, so this is suitable for the quiz MVP, not an uptime promise.

Official platform documentation:

https://supabase.com/docs/guides/platform

## Load the question bank

1. Open the Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`. It is small and only creates the table, grants, policy, and trigger.
4. Do not paste the generated `supabase/seed.sql` into SQL Editor. The bank is uploaded in REST batches instead.
5. Open Table Editor and confirm `public.quiz_questions` contains the same published row count reported by `npm run supabase-seed`.
6. Confirm the RLS policy named `public can read published quiz questions` exists.

The seed contains public question payloads, including answers and explanations because the current browser quiz grades locally. It does not contain the private coding tests.

## Connect the static quiz locally

1. Copy `supabase/config.example.js` to `supabase/config.js`.
2. In Supabase, open Project Settings, then API.
3. Copy the Project URL into `supabaseUrl`.
4. Copy only the public publishable key, historically labelled `anon`, into `supabaseAnonKey`.
5. Never copy the service-role key into this file, the browser, Git, or GitHub Pages.
6. Reload the quiz.

The browser tries the published Supabase rows first. If the config is absent or the request fails, it falls back to `data/questions.json`, so local development remains usable.

## Bulk seed without a giant SQL statement

The repository includes a batch uploader that uses the Supabase REST API. It sends 50 upserts per request, so the question bank never becomes one oversized SQL paste.

From Git Bash in the repository:

```bash
export SUPABASE_SERVICE_ROLE_KEY='[paste temporarily; never commit or send this value]'
npm run supabase-seed
unset SUPABASE_SERVICE_ROLE_KEY
```

The script reads the project URL from ignored `supabase/config.js`, uploads the public payloads, then reads the published rows back and verifies the total. A service-role or new secret key is required because the public anon key is intentionally read-only. The write credential is read only from the process environment and is never written to the repository.

To verify later using the public read-only key:

```bash
npm run supabase-verify
```

For small schema or migration SQL files, use the Supabase Management API instead of the dashboard editor:

```bash
export SUPABASE_ACCESS_TOKEN='[temporary Supabase personal access token]'
npm run supabase-sql -- supabase/schema.sql
unset SUPABASE_ACCESS_TOKEN
```

The Management API token needs database query permission. This path is for SQL statements such as schema changes; use `supabase-seed` for the question payloads.

## Security boundary

- Public client: read-only published questions through RLS.
- Authoring: Supabase SQL Editor or a future private admin path.
- Java execution: the separate runner, with hidden tests outside Supabase and outside the static artifact.
- No accounts or synchronized progress are enabled by this first DB slice.
