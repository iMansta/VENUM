import { createClient } from '@supabase/supabase-js';
import { verifyGuildMembershipServer } from '../server/verifyGuild.mjs';

const MIGRATION_EMAIL_DOMAIN = String(
  process.env.AUTH_MIGRATION_EMAIL_DOMAIN || 'example.com'
)
  .trim()
  .toLowerCase();

const toEmail = (nickname) =>
  `${String(nickname).trim().toLowerCase()}@${MIGRATION_EMAIL_DOMAIN}`;

const getAdminClient = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL e chave administrativa não configurados (SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY)'
    );
  }
  return createClient(url, key);
};

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const nickname = String(req.body?.nickname || '').trim();
    const password = String(req.body?.password || '');

    if (!nickname || !password) {
      res.status(400).json({ success: false, error: 'Nickname e senha são obrigatórios' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'A senha deve ter pelo menos 6 caracteres' });
      return;
    }

    const guildCheck = await verifyGuildMembershipServer(nickname);
    if (!guildCheck.valid) {
      res.status(403).json({ success: false, error: guildCheck.error || 'Guilda inválida' });
      return;
    }

    const supabase = getAdminClient();

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, username')
      .or(`username.ilike.${nickname},albion_character_name.ilike.${nickname}`)
      .limit(1)
      .maybeSingle();

    // Se já existe perfil, não força criação de novo auth user.
    if (existingProfile?.id) {
      res.status(200).json({
        success: true,
        alreadyExists: true,
        email: toEmail(nickname),
        message: 'Perfil já existe',
      });
      return;
    }

    const email = toEmail(nickname);
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: nickname,
        full_name: nickname,
        albion_player_id: guildCheck.playerId,
      },
    });

    if (createError) {
      const msg = String(createError.message || '');
      if (/already registered|already exists/i.test(msg)) {
        res.status(200).json({
          success: true,
          alreadyExists: true,
          email,
          message: 'Conta já existia',
        });
        return;
      }

      res.status(400).json({ success: false, error: msg || 'Falha ao criar usuário' });
      return;
    }

    if (created?.user?.id) {
      await supabase
        .from('profiles')
        .upsert(
          {
            id: created.user.id,
            username: nickname,
            full_name: nickname,
            albion_character_name: nickname,
            albion_player_id: guildCheck.playerId,
            guild_verified: true,
            last_guild_verified_at: new Date().toISOString(),
            is_active: true,
          },
          { onConflict: 'id' }
        );
    }

    res.status(200).json({
      success: true,
      created: true,
      email,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno ao provisionar conta',
    });
  }
}
