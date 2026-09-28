import { createClient } from '@supabase/supabase-js'

// URL oficial del proyecto Supabase
const SUPABASE_URL = 'https://yupaibsqnxfismckuqje.supabase.co'
// Anon public key estándar para autenticación en cliente
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cGFpYnNxbnhmaXNtY2t1cWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3ODYwMTgsImV4cCI6MjA4NTM2MjAxOH0.pHvAOBk53Zpo7Y6BO3kQDTpjpWAJK3DXM6bQB0aeprM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

