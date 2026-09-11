import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { counts, loadSupabaseConfig, readPublishedRows, requireWriteKey } from './supabase_client.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const QUESTIONS_PATH = path.join(ROOT, 'data', 'questions.json')
const BATCH_SIZE = 50

function rowsFromBank() {
  const questions = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'))
  return questions.map((question) => ({
    id: question.id,
    subject_id: question.subjectId,
    question_type: question.type,
    published: true,
    payload: question,
  }))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const { url } = loadSupabaseConfig()
  const rows = rowsFromBank()
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...counts(rows.map((row) => ({ question_type: row.question_type, subject_id: row.subject_id }))), batchSize: BATCH_SIZE }, null, 2))
    return
  }

  const key = requireWriteKey()
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE)
    const response = await fetch(`${url}/rest/v1/quiz_questions?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    })
    if (!response.ok) throw new Error(`Supabase batch ${start + 1}-${start + batch.length} failed with HTTP ${response.status}`)
    console.log(`Uploaded ${start + batch.length}/${rows.length}`)
  }

  const publicKey = process.env.SUPABASE_ANON_KEY || loadSupabaseConfig().anonKey || key
  const actual = await readPublishedRows(publicKey)
  const result = counts(actual)
  if (result.total !== rows.length) throw new Error(`Seed verification expected ${rows.length} published rows, got ${result.total}`)
  console.log(JSON.stringify({ uploaded: rows.length, verified: result }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
