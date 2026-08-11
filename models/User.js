const bcrypt = require('bcryptjs');
const supabase = require('../config/supabaseClient');

const TABLE = 'users';

async function findByUsername(username) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByUsernameOrEmail(username, email) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .or(`username.eq.${username.toLowerCase()},email.eq.${email.toLowerCase()}`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create({ username, email, password }) {
  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ username: username.toLowerCase(), email: email.toLowerCase(), password_hash })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function comparePassword(user, candidatePassword) {
  return bcrypt.compare(candidatePassword, user.password_hash);
}

module.exports = { findByUsername, findByUsernameOrEmail, create, comparePassword };
