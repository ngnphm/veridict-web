import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xonquattjmsikcsxudig.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvbnF1YXR0am1zaWtjc3h1ZGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzE5NDEsImV4cCI6MjA4OTE0Nzk0MX0._s94EZNFToPghakvLZxesa6xpEDUroUhaxoJwQigRVg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
