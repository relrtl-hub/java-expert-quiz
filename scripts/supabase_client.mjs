import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readLocalConfig() {
  const configPath = path.join(ROOT, 'supabase', 'config.js')
  if (!fs.existsSync(configPath)) return {}
  const text = fs.readFileSync(configPath, 'utf8')
  const url = text.match(/supabaseUrl\s*:\s*['\"]([^'\"]*)['\"]/)?.[1] || ''
  const anonKey = text.match(/supabaseAnonKey\s*:\s*['\"]([^'\"]*)['\"]/)?.[1] || ''
  return { url, anonKey }
}

export function loadSupabaseConfig() {
  const local = readLocalConfig()
  const url = process.env.SUPABASE_URL || local.url
  const anonKey = process.env.SUPABASE_ANON_KEY || local.anonKey
  if (!url) throw new Error('Missing Supabase URL. Set SUPABASE_URL or create supabase/config.js.')
  return { url: url.replace(/\/$/, ''), anonKey }
}

export function requireWriteKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!key) {
    throw new Error('Missing write credential. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY in the environment; never put it in supabase/config.js.')
  }
  return key
}

export function requireManagementToken() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN. Create a Supabase Personal Access Token for the Management API and set it only in the environment.')
  return token
}

export function projectRef(url) {
  return new URL(url).hostname.split('.')[0]
}

export async function readPublishedRows(key) {
  const { url } = loadSupabaseConfig()
  const response = await fetch(`${url}/rest/v1/quiz_questions?select=id,question_type,subject_id&published=eq.true&order=id.asc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })
  if (!response.ok) throw new Error(`Supabase read failed with HTTP ${response.status}`)
  return response.json()
}

export function counts(rows) {
  const byType = {}
  const bySubject = {}
  for (const row of rows) {
    byType[row.question_type] = (byType[row.question_type] || 0) + 1
    bySubject[row.subject_id] = (bySubject[row.subject_id] || 0) + 1
  }
  return {
    total: rows.length,
    byType: Object.fromEntries(Object.entries(byType).sort(([left], [right]) => left.localeCompare(right))),
    bySubject: Object.fromEntries(Object.entries(bySubject).sort(([left], [right]) => left.localeCompare(right))),
  }
}
