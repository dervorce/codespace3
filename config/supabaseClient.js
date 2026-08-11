const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment');
}

// Server-side client using the service role key, which bypasses Row Level
// Security. That's appropriate here because this Express server is the
// trusted backend making all the access-control decisions itself (see
// middleware/jwtAuth.js and middleware/gitAuth.js).
//
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to a browser or client — it has
// full read/write access to every table, RLS or not.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

module.exports = supabase;
