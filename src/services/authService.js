import { supabase } from '../lib/supabase'

export async function signUp(email, password, username) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existing) throw new Error('Username is already taken.')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })

  if (error) throw error

  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      username,
      claims_created: 0,
      claims_proven: 0,
      claims_busted: 0,
      bets_won: 0,
      bets_lost: 0,
      total_winnings: 0,
    })
    if (profileError) console.warn('Profile creation error:', profileError)
  }

  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signInWithApple() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  })
  if (error) throw error
}

export async function signInWithCode(code) {
  const res = await fetch(
    'https://xonquattjmsikcsxudig.supabase.co/functions/v1/redeem-code',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    }
  )

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Invalid or expired code')

  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
