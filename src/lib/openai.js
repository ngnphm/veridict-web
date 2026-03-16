import { supabase } from './supabase'

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

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

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'AI request failed')
  return data
}

export async function generateVerificationCriteria(statement) {
  return callFunction('generate-criteria', { statement })
}

export async function verifyCriteria(statement, criteria) {
  return callFunction('verify-criteria', { statement, criteria })
}
