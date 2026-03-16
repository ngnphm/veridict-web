import { supabase } from '../lib/supabase'

function mapClaim(row) {
  if (!row) return null
  return {
    id: row.id,
    ownerId: row.owner_id,
    statement: row.statement,
    description: row.description,
    verifyFromDate: row.verify_from_date,
    dueDate: row.due_date,
    status: row.status,
    result: row.result,
    totalForAmount: row.total_for_amount ?? 0,
    totalAgainstAmount: row.total_against_amount ?? 0,
    participantCount: row.participant_count ?? 0,
    shareCode: row.share_code,
    isPublic: row.is_public,
    verificationCriteria: row.verification_criteria,
    votingDeadline: row.voting_deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchPublicClaims() {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data || []).map(mapClaim)
}

export async function fetchMyClaims(userId) {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapClaim)
}

export async function fetchClaimsIBetOn(userId) {
  const { data, error } = await supabase
    .from('bets')
    .select('claim_id')
    .eq('user_id', userId)
  if (error) throw error

  const claimIds = [...new Set((data || []).map(b => b.claim_id))]
  if (!claimIds.length) return []

  const { data: claims, error: claimsError } = await supabase
    .from('claims')
    .select('*')
    .in('id', claimIds)
    .order('created_at', { ascending: false })
  if (claimsError) throw claimsError
  return (claims || []).map(mapClaim)
}

export async function fetchClaimById(id) {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return mapClaim(data)
}

export async function fetchClaimByShareCode(code) {
  const { data, error } = await supabase
    .rpc('get_claim_by_share_code', { code })
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Claim not found.')
  return mapClaim(data[0])
}

export async function createClaim({
  ownerId,
  statement,
  description,
  verifyFromDate,
  dueDate,
  isPublic,
  verificationCriteria,
}) {
  // Generate share code
  const shareCode = Array.from({ length: 12 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
      Math.floor(Math.random() * 62)
    ]
  ).join('')

  const { data, error } = await supabase
    .from('claims')
    .insert({
      owner_id: ownerId,
      statement,
      description: description || null,
      verify_from_date: verifyFromDate || null,
      due_date: dueDate,
      status: 'pending',
      total_for_amount: 0,
      total_against_amount: 0,
      participant_count: 0,
      share_code: shareCode,
      is_public: isPublic,
      verification_criteria: verificationCriteria?.length ? verificationCriteria : null,
    })
    .select()
    .single()
  if (error) throw error
  return mapClaim(data)
}

export async function resolveClaim(id, result) {
  const { data, error } = await supabase
    .from('claims')
    .update({ result, status: 'resolved', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapClaim(data)
}

export async function deleteClaim(id) {
  const { error } = await supabase.from('claims').delete().eq('id', id)
  if (error) throw error
}
