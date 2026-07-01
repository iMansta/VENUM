/**
 * Envia embeds para Discord via webhook.
 */
export async function sendDiscordWebhook(webhookUrl, payload) {
  if (!webhookUrl) {
    console.warn('[DISCORD] Webhook URL não configurada — mensagem ignorada');
    return false;
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[DISCORD] Falha:', res.status, text);
    return false;
  }
  return true;
}

export async function notifyMissionCreated(mission, webhookUrl) {
  const embed = {
    title: '🎯 Nova Missão da Guilda',
    description: mission.description || 'Sem descrição',
    color: 0xef4444,
    fields: [
      { name: 'Título', value: mission.title, inline: true },
      { name: 'Tipo', value: mission.mission_type, inline: true },
      { name: 'Recompensa', value: `${mission.points_reward} pontos`, inline: true },
      {
        name: 'Meta',
        value: `${mission.target_quantity}${mission.target_item ? ` × ${mission.target_item}` : ''}`,
        inline: false,
      },
    ],
    footer: { text: 'Guilda I V E N U M I — Hub VENUM' },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook(webhookUrl, { embeds: [embed] });
}

export async function notifyGuildEvent(event, webhookUrl) {
  const embed = {
    title: '⚔️ Evento detectado',
    description: event.summary || 'Atividade registrada',
    color: 0xf59e0b,
    fields: (event.fields || []).map((f) => ({
      name: f.name,
      value: String(f.value),
      inline: f.inline ?? true,
    })),
    footer: { text: 'Coletor VENUM — I V E N U M I' },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook(webhookUrl, { embeds: [embed] });
}
