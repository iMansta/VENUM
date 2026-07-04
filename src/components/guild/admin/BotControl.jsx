import { useEffect, useState } from 'react';
import { Bot, Power, RefreshCw, Megaphone, Target, Swords, Shield, FileText } from 'lucide-react';
import { getBotSettings, updateBotSettings } from '@/lib/supabase/celesteBot';

const TOGGLES = [
  { key: 'missions_enabled', label: 'Anúncios de missões', icon: Target },
  { key: 'announcements_enabled', label: 'Avisos da guilda', icon: Megaphone },
  { key: 'killboard_enabled', label: 'Killboard', icon: Swords },
  { key: 'battleboard_enabled', label: 'Battleboard', icon: Shield },
  { key: 'content_enabled', label: 'Conteúdos (Content)', icon: FileText },
];

const BotControl = ({ userId }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await getBotSettings();
    if (res.success) setSettings(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const persist = async (patch) => {
    setSaving(true);
    setFeedback('');
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    const res = await updateBotSettings(patch, userId);
    if (res.success) {
      setSettings(res.data);
      setFeedback('Configuração salva. O bot aplica em até ~30s.');
    } else {
      setFeedback(`Erro: ${res.error}`);
      load();
    }
    setSaving(false);
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Carregando configurações do bot...</p>;
  }

  if (!settings) {
    return (
      <p className="text-gray-400 text-sm">
        Não foi possível carregar as configurações do bot.
      </p>
    );
  }

  const enabled = settings.enabled;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-indigo-400" />
        <h3 className="text-lg font-semibold text-white">Bot Discord — Celeste</h3>
      </div>

      <div
        className={`rounded-xl border p-5 ${
          enabled
            ? 'border-emerald-700/40 bg-emerald-950/20'
            : 'border-slate-700 bg-slate-900/50'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-medium flex items-center gap-2">
              <Power className={`w-4 h-4 ${enabled ? 'text-emerald-400' : 'text-gray-500'}`} />
              Bot {enabled ? 'ativado' : 'desativado'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Quando desativado, a Celeste para de publicar missões, avisos, killboard e conteúdos
              no Discord (o processo continua online, apenas silenciado).
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => persist({ enabled: !enabled })}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              enabled ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-300 font-medium">Módulos publicados pelo bot</p>
        {TOGGLES.map((t) => {
          const value = settings[t.key];
          return (
            <div
              key={t.key}
              className={`flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 ${
                enabled ? '' : 'opacity-50'
              }`}
            >
              <span className="flex items-center gap-2 text-sm text-white">
                <t.icon className="w-4 h-4 text-gray-400" />
                {t.label}
              </span>
              <button
                type="button"
                disabled={saving || !enabled}
                onClick={() => persist({ [t.key]: !value })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  value ? 'bg-indigo-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
          Recarregar
        </button>
        {feedback && <span className="text-xs text-gray-400">{feedback}</span>}
      </div>
    </div>
  );
};

export default BotControl;
