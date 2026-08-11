const supabase = require('../config/supabaseClient');

const TABLE = 'repositories';

async function findByOwnerAndName(ownerUsername, name) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('owner_username', ownerUsername.toLowerCase())
    .eq('name', name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listByOwner(ownerUsername) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('owner_username', ownerUsername.toLowerCase())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function create({ name, ownerId, ownerUsername, description = '', isPrivate = false }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name,
      owner_id: ownerId,
      owner_username: ownerUsername.toLowerCase(),
      description,
      is_private: isPrivate,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function remove(ownerUsername, name) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('owner_username', ownerUsername.toLowerCase())
    .eq('name', name)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { findByOwnerAndName, listByOwner, create, remove, findById };
