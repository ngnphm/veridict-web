import { supabase } from '../lib/supabase'

function mapVote(row) {
  return {
    id: row.id,
    claimId: row.claim_id,
    userId: row.user_id,
    vote: row.vote,
    createdAt: row.created_at,
  }
}

export async function fetchVotes(claimId) {
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('claim_id', claimId)
  if (error) throw error
  return (data || []).map(mapVote)
}

export async function castVote(claimId, userId, vote) {
  const { data, error } = await supabase
    .from('votes')
    .insert({ claim_id: claimId, user_id: userId, vote })
    .select()
    .single()
  if (error) throw error
  return mapVote(data)
}
