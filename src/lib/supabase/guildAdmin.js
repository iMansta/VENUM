import { supabase } from './client';

export const generateGuildAdminPairingToken = async () => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    }

    const response = await fetch('/api/guild-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: 'generate-token' }),
    });

    const json = await response.json();
    if (!response.ok || !json?.ok) {
      return { success: false, error: json?.error || 'Falha ao gerar token' };
    }

    return {
      success: true,
      data: {
        token: json.token,
        expiresAt: json.expiresAt,
        ttlMinutes: json.ttlMinutes,
        issuedBy: json.issuedBy,
      },
    };
  } catch (error) {
    console.error('Generate guild admin pairing token error:', error);
    return { success: false, error: error.message || 'Erro ao gerar token' };
  }
};

export const submitGuildAdminMetrics = async ({ silverAmount, seasonPoints, memberCount, note }) => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    }

    const response = await fetch('/api/guild-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'submit-metrics',
        silverAmount,
        seasonPoints,
        memberCount,
        note,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json?.ok) {
      return { success: false, error: json?.error || 'Falha ao enviar métricas' };
    }

    return {
      success: true,
      data: {
        collectedAt: json.collectedAt,
        silverAmount: json.silverAmount,
        seasonPoints: json.seasonPoints,
        memberCount: json.memberCount,
        submittedBy: json.submittedBy,
      },
    };
  } catch (error) {
    console.error('Submit guild admin metrics error:', error);
    return { success: false, error: error.message || 'Erro ao enviar métricas' };
  }
};
