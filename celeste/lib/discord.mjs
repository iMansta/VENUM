export async function sendDiscordWebhook(webhookUrl, payload) {
  if (!webhookUrl) return false;
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

export async function notifyMissionCreated(mission, webhookUrl) {
  return sendDiscordWebhook(webhookUrl, {
    embeds: [{
      title: 'Nova Missão — I V E N U M I',
      description: mission.description || mission.title,
      color: 0xef4444,
      fields: [
        { name: 'Recompensa', value: `${mission.points_reward} pts`, inline: true },
      ],
    }],
  });
}
