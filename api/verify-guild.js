import { verifyGuildMembershipServer } from '../server/verifyGuild.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ valid: false, error: 'Method not allowed' });
    return;
  }

  const nickname = req.query?.nickname;
  const result = await verifyGuildMembershipServer(nickname);
  res.status(200).json(result);
}
