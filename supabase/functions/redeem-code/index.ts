import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = await req.json()
    const normalizedCode = String(code ?? '').trim().toUpperCase()

    if (!normalizedCode) {
      return new Response(JSON.stringify({ error: 'Code is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Redeem the code — returns the user_id
    const { data: userId, error: redeemError } = await supabase
      .rpc('redeem_login_code', { p_code: normalizedCode })

    if (redeemError || !userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: 'User email not found for code login' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    })

    const tokenHash =
      linkData?.properties?.hashed_token ??
      linkData?.properties?.hashedToken ??
      linkData?.hashed_token ??
      linkData?.action_link?.match(/[?&]token_hash=([^&]+)/)?.[1]

    if (linkError || !tokenHash) {
      return new Response(JSON.stringify({ error: 'Failed to prepare login session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      email: userData.user.email,
      token_hash: tokenHash,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
