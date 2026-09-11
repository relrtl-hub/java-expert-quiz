import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSupabaseConfig, projectRef, requireManagementToken } from './supabase_client.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const file = process.argv.find((value) => value.endsWith('.sql'))
  if (!file) throw new Error('Usage: npm run supabase-sql -- path/to/query.sql')
  const queryPath = path.resolve(ROOT, file)
  const query = fs.readFileSync(queryPath, 'utf8')
  const token = requireManagementToken()
  const { url } = loadSupabaseConfig()
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef(url)}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, read_only: false }),
  })
  if (!response.ok) throw new Error(`Supabase Management API returned HTTP ${response.status}`)
  console.log(JSON.stringify({ executed: queryPath.replace(`${ROOT}${path.sep}`, '') }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
