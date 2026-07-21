import { supabase } from './client';

export const generateCelestePairingToken = async () => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return { success: false, error: 'Faça login para gerar o token' };
    }

    const res = await fetch('/api/celeste-pairing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: 'generate-token' }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.ok) {
      return { success: false, error: payload?.error || `HTTP ${res.status}` };
    }

    return {
      success: true,
      token: payload.token,
      expiresAt: payload.expiresAt,
      ttlMinutes: payload.ttlMinutes,
      username: payload.username,
    };
  } catch (error) {
    console.error('generateCelestePairingToken error:', error);
    return { success: false, error: error.message };
  }
};
