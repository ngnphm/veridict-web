import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
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

    const { statement, criteria } = await req.json()
    if (!statement || !criteria) throw new Error('Statement and criteria are required')

    const today = new Date().toISOString().split('T')[0]
    const criteriaList = criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')

    const systemPrompt = `You are a fact-checking analyst. Today's date is ${today}. Evaluate each criterion based on publicly known information as of today.

For each criterion:
- "met": true if satisfied based on current known facts, false otherwise
- "reasoning": one sentence explaining why

Also provide a short "summary" of the overall verdict.

Respond ONLY with valid JSON:
{
  "results": [
    {"criterion": "...", "met": true/false, "reasoning": "..."}
  ],
  "summary": "..."
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
          { role: 'user', content: `Claim: "${statement}"\n\nCriteria:\n${criteriaList}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) throw new Error('OpenAI request failed')

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
