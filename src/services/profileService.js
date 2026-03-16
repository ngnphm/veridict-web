import { supabase } from '../lib/supabase'

function mapProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    claimsCreated: row.claims_created ?? 0,
    claimsProven: row.claims_proven ?? 0,
    claimsBusted: row.claims_busted ?? 0,
    betsWon: row.bets_won ?? 0,
    betsLost: row.bets_lost ?? 0,
    totalWinnings: row.total_winnings ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return mapProfile(data)
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return mapProfile(data)
}

export async function updateProfile(userId, { displayName, username }) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName || null,
      username,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return mapProfile(data)
}

export async function fetchParticipantProfiles(userIds) {
  if (!userIds.length) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds)
  if (error) throw error
  return (data || []).map(mapProfile)
}
