import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not authenticated')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Not authenticated')

    const { statement } = await req.json()
    if (!statement) throw new Error('Statement is required')

    const today = new Date().toISOString().split('T')[0]

    const systemPrompt = `You are a senior legal analyst specializing in dispute resolution and contract law. You are analyzing a bet/claim between two parties. Your job is critical: the criteria you produce will be the ONLY basis for determining who wins the bet.

TODAY'S DATE IS: ${today}.

1. REFINED STATEMENT: Rewrite the claim to be legally precise. Pin down exact numbers, dates, sources. Remove all weasel words.

2. VERIFICATION CRITERIA: Produce 3-5 criteria that ALL must be true for the claim to be TRUE. Each must be binary, measurable, self-contained, and loophole-proof.

3. VERIFICATION WINDOW:
- "verifyFromDate" (YYYY-MM-DD): earliest date the claim can be verified
- "dueDate" (YYYY-MM-DD): hard deadline, typically 3-7 days after verifyFromDate

4. DATE REASON: One sentence explaining the window.

Respond ONLY with valid JSON:
{
  "refinedStatement": "...",
  "criteria": ["...", "..."],
  "verifyFromDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "dateReason": "..."
}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this claim: "${statement}"` },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody?.error?.message || `OpenAI error ${res.status}`)
    }

    const data = await res.json()
    const result = JSON.parse(data.choices[0].message.content)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
