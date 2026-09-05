# UCL Pick'em 2026/27

React + Vite + Supabase frontend for the private Champions League Pick'em.

## Before deploying

1. In Vercel, add:
   - `VITE_SUPABASE_URL` = `https://jcldmptmiynlzxlnsiut.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your Supabase **publishable** key.
2. Do not put a Supabase secret key in the browser.
3. The Supabase database must contain the Pick'em schema and RPC functions.
4. Load the official 2026/27 league-phase fixtures into `public.fixtures`.
5. Create the first player account, then mark that profile `is_admin = true` in Supabase.

The frontend is deliberately separated from the scoring rules because the scoring system has not been finalized yet.
