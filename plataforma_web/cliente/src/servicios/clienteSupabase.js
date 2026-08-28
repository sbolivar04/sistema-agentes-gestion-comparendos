import { createClient } from '@supabase/supabase-js'

// URL oficial del proyecto Supabase
const SUPABASE_URL = 'https://yupaibsqnxfismckuqje.supabase.co'
// Anon public key estándar para autenticación en cliente
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cGFpYnNxbnhmaXNtY2t1cWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjg0NjksImV4cCI6MjA3MTkwNDQ2OX0.p6z_1GZ9u9eQp1x3J1V7g4K0d7h2M3x9Q5w8E2r1T4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
