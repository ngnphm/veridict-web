const OPENAI_API_KEY = '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'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

async function chat(messages, temperature = 0.2) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error: ${err}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('No response from AI.')
  return JSON.parse(content)
}

export async function generateVerificationCriteria(statement) {
  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `You are a senior legal analyst specializing in dispute resolution and contract law. You are analyzing a bet/claim between two parties. Your job is critical: the criteria you produce will be the ONLY basis for determining who wins the bet. If there are ANY loopholes, the losing party WILL exploit them to avoid paying.

TODAY'S DATE IS: ${today}. Use this as your reference for all date reasoning. When the claim mentions relative time like "end of year", "next month", "by summer", always resolve it to the correct calendar date based on today's date.

Your task:

1. STATEMENT ANALYSIS: Read the claim carefully. Identify every piece of ambiguity, vague language, undefined term, missing qualifier, or loophole that could let someone twist the meaning later.

2. REFINED STATEMENT: Rewrite the claim so it is legally precise and impossible to misinterpret. Pin down exact numbers, dates, sources, and definitions. Remove all weasel words (e.g. "around", "about", "soon", "significantly").

3. VERIFICATION CRITERIA: Produce 3-5 criteria that ALL must be true for the claim to be considered TRUE. Each criterion must be:
- Binary: unambiguously true or false, no gray area
- Measurable: references a specific number, date, source, or observable fact
- Self-contained: understandable without needing the original claim
- Loophole-proof: written so it cannot be satisfied by a technicality

4. VERIFICATION WINDOW: Determine two dates:
- "verifyFromDate" (YYYY-MM-DD): The earliest date the claim can be verified.
- "dueDate" (YYYY-MM-DD): The latest date by which the claim MUST be verified (typically 3-7 days after verifyFromDate).
Both dates must be no more than one year out from today.

5. DATE REASON: One sentence explaining the verification window you chose.

Respond ONLY with valid JSON in this exact format:
{
  "refinedStatement": "...",
  "criteria": ["...", "...", ...],
  "verifyFromDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "dateReason": "..."
}`

  return chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Analyze this claim: "${statement}"` },
  ], 0.2)
}

export async function verifyCriteria(statement, criteria) {
  const today = new Date().toISOString().split('T')[0]
  const criteriaList = criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')

  const systemPrompt = `You are a fact-checking analyst. Today's date is ${today}. You are given a claim statement and a list of verification criteria. Your job is to evaluate each criterion based on publicly known information as of today. Be objective and honest.

For each criterion, determine:
- "met": true if the criterion is satisfied based on current known facts, false otherwise
- "reasoning": one sentence explaining why it is met or not met

Also provide a short "summary" of the overall verdict.

Respond ONLY with valid JSON in this exact format:
{
  "results": [
    {"criterion": "the criterion text", "met": true/false, "reasoning": "..."},
    ...
  ],
  "summary": "Overall verdict summary"
}`

  return chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Claim: "${statement}"\n\nCriteria to verify:\n${criteriaList}` },
  ], 0.1)
}
