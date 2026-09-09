-- Java Expert quiz question store.
-- Run this in the Supabase SQL Editor after creating a Free project.
-- Do not put runner hidden tests in this database.

create table if not exists public.quiz_questions (
  id text primary key,
  subject_id text not null,
  question_type text not null check (question_type in ('multiple_choice', 'short_answer', 'leetcode')),
  published boolean not null default false,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quiz_questions_subject_idx
  on public.quiz_questions (subject_id)
  where published = true;

alter table public.quiz_questions enable row level security;

drop policy if exists "public can read published quiz questions" on public.quiz_questions;
create policy "public can read published quiz questions"
  on public.quiz_questions
  for select
  to anon, authenticated
  using (published = true);

grant select on public.quiz_questions to anon, authenticated;
revoke insert, update, delete on public.quiz_questions from anon, authenticated;

create or replace function public.set_quiz_questions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quiz_questions_updated_at on public.quiz_questions;
create trigger quiz_questions_updated_at
before update on public.quiz_questions
for each row execute function public.set_quiz_questions_updated_at();
