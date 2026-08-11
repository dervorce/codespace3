const supabase = require('../config/supabaseClient');

async function createMany(entries) {
  const { data, error } = await supabase.from('repository_uploads').insert(entries).select();
  if (error) throw error;
  return data || [];
}

async function list(repositoryId) {
  const { data, error } = await supabase.from('repository_uploads')
    .select('id, relative_path, language, size, notes, commit_hash, created_at, users(username)')
    .eq('repository_id', repositoryId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function find(id, repositoryId) {
  const { data, error } = await supabase.from('repository_uploads')
    .select('*, users(username)').eq('id', id).eq('repository_id', repositoryId).maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { createMany, list, find };
