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
3. Run `supabase/schema.sql`.
4. Run `supabase/seed.sql`.
5. Open Table Editor and confirm `public.quiz_questions` contains the 16 public question rows.
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

## Security boundary

- Public client: read-only published questions through RLS.
- Authoring: Supabase SQL Editor or a future private admin path.
- Java execution: the separate runner, with hidden tests outside Supabase and outside the static artifact.
- No accounts or synchronized progress are enabled by this first DB slice.
