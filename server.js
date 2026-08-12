require('dotenv').config();
const app = require('./app');
const supabase = require('./config/supabaseClient');
const PORT = process.env.PORT || 4000;

async function start() {
  // Supabase's client is just a thin REST wrapper (no persistent
  // "connection" to hold open), but we do a quick sanity query on boot so
  // a bad URL/key or a missing schema fails loudly instead of on the
  // first request.
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    console.error('Supabase check failed:', error.message);
    console.error('Have you run supabase/schema.sql against your project yet?');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Git hosting prototype listening on http://localhost:${PORT}`);
  });
}

start();
