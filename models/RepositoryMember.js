const supabase = require('../config/supabaseClient');

async function listForUser(userId) {
  const { data, error } = await supabase
    .from('repository_members')
    .select('role, joined_at, repositories(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function find(repositoryId, userId) {
  const { data, error } = await supabase.from('repository_members')
    .select('role, joined_at').eq('repository_id', repositoryId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function add(repositoryId, userId, role = 'editor') {
  const { data, error } = await supabase.from('repository_members')
    .upsert({ repository_id: repositoryId, user_id: userId, role }, { onConflict: 'repository_id,user_id' })
    .select().single();
  if (error) throw error;
  return data;
}

async function listMembers(repositoryId) {
  const { data, error } = await supabase.from('repository_members')
    .select('role, joined_at, users(id, username, email)')
    .eq('repository_id', repositoryId).order('joined_at');
  if (error) throw error;
  return data || [];
}

module.exports = { listForUser, find, add, listMembers };
