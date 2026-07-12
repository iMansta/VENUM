/**
 * Serviço de pareamento e ingestão de métricas administrativas da guilda.
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const GUILD_NAME = process.env.GUILD_NAME || 'I V E N U M I';
const ALBION_GUILD_ID = process.env.ALBION_GUILD_ID || '-TW40MAhRHGsv3ow5h_Zdw';
const TOKEN_TTL_MINUTES = Number(process.env.GUILD_ADMIN_TOKEN_TTL_MINUTES || 15);
const ADMIN_ROLES = new Set(['admin', 'staff']);

const toNullableNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

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

async function getProfileFromAccessToken(accessToken) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, error: 'Sessão inválida ou expirada' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile?.id) {
    return { ok: false, status: 403, error: 'Perfil não encontrado' };
  }
  if (!profile.is_active) {
    return { ok: false, status: 403, error: 'Perfil inativo' };
  }
  if (!ADMIN_ROLES.has(String(profile.role || '').toLowerCase())) {
    return { ok: false, status: 403, error: 'Apenas admin/staff podem gerar token de pareamento' };
  }

  return { ok: true, profile };
}

export async function createGuildAdminPairingToken(accessToken) {
  const auth = await getProfileFromAccessToken(accessToken);
  if (!auth.ok) return auth;

  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  let token = '';
  let inserted = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    token = generatePairingCode();
    const { data, error } = await supabase
      .from('guild_admin_pairing_tokens')
      .insert({
        token,
        profile_id: auth.profile.id,
        username: auth.profile.username || auth.profile.full_name || null,
        expires_at: expiresAt,
      })
      .select('id, token, expires_at, created_at')
      .single();
    if (!error && data) {
      inserted = data;
      break;
    }
  }

  if (!inserted) {
    return { ok: false, status: 500, error: 'Falha ao gerar token de pareamento' };
  }

  return {
    ok: true,
    token: inserted.token,
    expiresAt: inserted.expires_at,
    ttlMinutes: TOKEN_TTL_MINUTES,
    issuedBy: auth.profile.username || auth.profile.full_name || auth.profile.id,
  };
}

async function resolvePairingToken(pairingToken) {
  const token = String(pairingToken || '').trim().toUpperCase();
  if (!token || token.length < 6) {
    return { ok: false, status: 401, error: 'Token de pareamento inválido' };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('guild_admin_pairing_tokens')
    .select('id, token, profile_id, username, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !data?.id) {
    return { ok: false, status: 401, error: 'Token de pareamento não encontrado' };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: 'Token de pareamento expirado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, is_active')
    .eq('id', data.profile_id)
    .maybeSingle();

  if (!profile?.id || !profile.is_active || !ADMIN_ROLES.has(String(profile.role || '').toLowerCase())) {
    return { ok: false, status: 403, error: 'Administrador do token sem permissão ativa' };
  }

  return { ok: true, tokenRow: data, profile };
}

export async function ingestGuildAdminMetrics(payload = {}, pairingToken = '') {
  const pairing = await resolvePairingToken(pairingToken);
  if (!pairing.ok) return pairing;

  const silverAmount = toNullableNumber(payload.silverAmount ?? payload.silver_amount);
  const seasonPoints = toNullableNumber(payload.seasonPoints ?? payload.season_points);
  const memberCount = toNullableNumber(payload.memberCount ?? payload.member_count);
  const note = String(payload.note || payload.admin_note || '').trim().slice(0, 500);
  const clientId = String(payload.clientId || payload.client_id || '').trim().slice(0, 120);

  if (silverAmount == null && seasonPoints == null && memberCount == null) {
    return {
      ok: false,
      status: 400,
      error: 'Informe ao menos prata, pontos de temporada ou quantidade de membros',
    };
  }

  const supabase = getSupabaseAdmin();

  let previous = null;
  try {
    const { data } = await supabase
      .from('guild_metrics_snapshots')
      .select(
        'collected_at, member_count, silver_amount, season_points, kill_fame, death_fame, total_fame, alliance_tag, alliance_name, hideout_count, territory_count, headquarters, payload'
      )
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    previous = data || null;
  } catch {
    previous = null;
  }

  const snapshot = {
    guild_id: ALBION_GUILD_ID,
    guild_name: GUILD_NAME,
    member_count: memberCount ?? toNumber(previous?.member_count),
    silver_amount: silverAmount ?? toNullableNumber(previous?.silver_amount),
    season_points: seasonPoints ?? toNullableNumber(previous?.season_points),
    kill_fame: toNullableNumber(previous?.kill_fame),
    death_fame: toNullableNumber(previous?.death_fame),
    total_fame: toNullableNumber(previous?.total_fame),
    alliance_tag: previous?.alliance_tag || null,
    alliance_name: previous?.alliance_name || null,
    hideout_count: toNullableNumber(previous?.hideout_count),
    territory_count: toNullableNumber(previous?.territory_count),
    headquarters: previous?.headquarters || null,
    properties: previous?.payload || null,
    source: 'admin_anaconda',
    payload: {
      submitted_via: 'anaconda_admin',
      note: note || null,
      previous_snapshot_at: previous?.collected_at || null,
    },
    submitted_by: pairing.profile.id,
    submitted_by_username:
      pairing.profile.username || pairing.profile.full_name || pairing.tokenRow.username || null,
    client_id: clientId || null,
    admin_note: note || null,
    verified_by_admin: true,
    collected_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase
    .from('guild_metrics_snapshots')
    .insert(snapshot)
    .select('id, collected_at, silver_amount, season_points, member_count, source, submitted_by_username')
    .single();

  if (error) {
    return { ok: false, status: 500, error: error.message || 'Falha ao gravar snapshot' };
  }

  await supabase
    .from('guild_admin_pairing_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', pairing.tokenRow.id);

  return {
    ok: true,
    snapshotId: inserted.id,
    collectedAt: inserted.collected_at,
    silverAmount: inserted.silver_amount,
    seasonPoints: inserted.season_points,
    memberCount: inserted.member_count,
    source: inserted.source,
    submittedBy: inserted.submitted_by_username,
  };
}
