import { supabase } from './supabase'

const BASE = 'https://xonquattjmsikcsxudig.supabase.co/functions/v1'

async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const res = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`Bad response: ${text.slice(0, 200)}`) }
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`)
  return data
}

export async function generateVerificationCriteria(statement) {
  return callFunction('generate-criteria', { statement })
}

export async function verifyCriteria(statement, criteria) {
  return callFunction('verify-criteria', { statement, criteria })
}
