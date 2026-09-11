import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { counts, loadSupabaseConfig, readPublishedRows } from './supabase_client.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function localCounts() {
  const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'questions.json'), 'utf8'))
  return counts(questions.map((question) => ({ question_type: question.type, subject_id: question.subjectId })))
}

async function main() {
  const { anonKey } = loadSupabaseConfig()
  const key = process.env.SUPABASE_ANON_KEY || anonKey
  if (!key) throw new Error('Missing public key. Set SUPABASE_ANON_KEY or configure supabase/config.js.')
  const actual = counts(await readPublishedRows(key))
  const expected = localCounts()
  const matches = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(JSON.stringify({ matches, expected, actual }, null, 2))
  if (!matches) process.exitCode = 2
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
