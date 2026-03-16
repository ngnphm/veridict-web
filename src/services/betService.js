import { supabase } from '../lib/supabase'

function mapBet(row) {
  return {
    id: row.id,
    claimId: row.claim_id,
    userId: row.user_id,
    side: row.side,
    amount: row.amount,
    createdAt: row.created_at,
  }
}

export async function fetchBets(claimId) {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapBet)
}

export async function placeBet(claimId, _userId, side, amount) {
  const { data, error } = await supabase
    .rpc('place_bet', {
      p_claim_id: claimId,
      p_side: side,
      p_amount: amount,
    })
  if (error) throw error
  return mapBet(data?.[0] ?? data)
}
