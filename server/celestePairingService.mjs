/**
 * Pareamento Anaconda (membros) — vincula client_id ↔ profile_id.
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const TOKEN_TTL_MINUTES = Number(process.env.CELESTE_PAIRING_TOKEN_TTL_MINUTES || 15);

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'Configure SUPABASE_URL e chave admin (SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY) na Vercel'
    );
  }
  return createClient(url, key);
}

function generatePairingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function getActiveProfileFromAccessToken(accessToken) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, error: 'Sessão inválida ou expirada' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, full_name, albion_character_name, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile?.id) {
    return { ok: false, status: 403, error: 'Perfil não encontrado' };
  }
  if (profile.is_active === false) {
    return { ok: false, status: 403, error: 'Perfil inativo' };
  }

  return { ok: true, profile };
}

export async function createCelestePairingToken(accessToken) {
  const auth = await getActiveProfileFromAccessToken(accessToken);
  if (!auth.ok) return auth;

  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  let inserted = null;
  let lastError = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generatePairingCode();
    const { data, error } = await supabase
      .from('celeste_pairing_tokens')
      .insert({
        token,
        profile_id: auth.profile.id,
        username:
          auth.profile.username ||
          auth.profile.albion_character_name ||
          auth.profile.full_name ||
          null,
        expires_at: expiresAt,
      })
      .select('id, token, expires_at, created_at')
      .single();
    if (!error && data) {
      inserted = data;
      break;
    }
    lastError = error?.message || lastError;
  }

  if (!inserted) {
    return {
      ok: false,
      status: 500,
      error: `Falha ao gerar token de pareamento${lastError ? `: ${lastError}` : ''}`,
    };
  }

  return {
    ok: true,
    token: inserted.token,
    expiresAt: inserted.expires_at,
    ttlMinutes: TOKEN_TTL_MINUTES,
    profileId: auth.profile.id,
    username:
      auth.profile.username ||
      auth.profile.albion_character_name ||
      auth.profile.full_name ||
      auth.profile.id,
  };
}

export async function redeemCelestePairingToken({ token, clientId }) {
  const normalized = String(token || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');
  const client_id = String(clientId || '').trim();

  if (!normalized || normalized.length < 6) {
    return { ok: false, status: 400, error: 'Token de pareamento inválido' };
  }
  if (!client_id) {
    return { ok: false, status: 400, error: 'clientId obrigatório' };
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: row, error } = await supabase
    .from('celeste_pairing_tokens')
    .select('id, token, profile_id, username, expires_at, used_at')
    .eq('token', normalized)
    .maybeSingle();

  if (error || !row?.id) {
    return { ok: false, status: 401, error: 'Token inválido ou expirado' };
  }
  if (row.used_at) {
    return { ok: false, status: 401, error: 'Token já utilizado' };
  }
  if (row.expires_at && row.expires_at <= now) {
    return { ok: false, status: 401, error: 'Token expirado — gere outro no painel VENUM' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, albion_character_name, full_name, is_active')
    .eq('id', row.profile_id)
    .maybeSingle();

  if (profileError || !profile?.id || profile.is_active === false) {
    return { ok: false, status: 403, error: 'Perfil associado ao token não está disponível' };
  }

  const { error: useError } = await supabase
    .from('celeste_pairing_tokens')
    .update({ used_at: now, used_by_client_id: client_id })
    .eq('id', row.id)
    .is('used_at', null);

  if (useError) {
    return { ok: false, status: 409, error: 'Token já foi utilizado por outro cliente' };
  }

  const displayName =
    profile.username ||
    profile.albion_character_name ||
    profile.full_name ||
    row.username ||
    profile.id;

  await supabase.from('celeste_clients').upsert(
    {
      client_id,
      profile_id: profile.id,
      username: displayName,
      last_seen_at: now,
    },
    { onConflict: 'client_id' }
  );

  return {
    ok: true,
    profileId: profile.id,
    username: displayName,
    albionCharacterName: profile.albion_character_name || null,
  };
}
