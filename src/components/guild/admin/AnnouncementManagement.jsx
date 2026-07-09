import { useEffect, useRef, useState } from 'react';
import { Megaphone, Plus, Trash2, RefreshCw, Send, AtSign, AlertTriangle } from 'lucide-react';
import {
  createGuildAnnouncement,
  deleteGuildAnnouncement,
  getGuildAnnouncements,
  updateGuildAnnouncement,
} from '@/lib/supabase/announcements';
import EmojiPicker from '@/components/common/EmojiPicker';

const EMPTY_FORM = { title: '', message: '', priority: 'normal', mention: 'none' };

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal', badge: 'bg-slate-700 text-slate-300' },
  { value: 'important', label: 'Importante', badge: 'bg-amber-500/20 text-amber-300' },
  { value: 'urgent', label: 'Urgente', badge: 'bg-red-500/20 text-red-300' },
];

const MENTION_OPTIONS = [
  { value: 'none', label: 'Sem menção' },
  { value: 'here', label: '@here' },
  { value: 'everyone', label: '@everyone' },
];

const priorityBadge = (value) =>
  PRIORITY_OPTIONS.find((p) => p.value === value)?.badge || PRIORITY_OPTIONS[0].badge;
const priorityLabel = (value) =>
  PRIORITY_OPTIONS.find((p) => p.value === value)?.label || 'Normal';

const AnnouncementManagement = ({ userId }) => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const titleRef = useRef(null);
  const messageRef = useRef(null);

  // Insere o emoji na posição atual do cursor do campo controlado.
  const insertAtCursor = (field, ref, emoji) => {
    const el = ref.current;
    setForm((f) => {
      const value = f[field] || '';
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const next = value.slice(0, start) + emoji + value.slice(end);
      requestAnimationFrame(() => {
        if (el) {
          const pos = start + emoji.length;
          el.focus();
          el.setSelectionRange(pos, pos);
        }
      });
      return { ...f, [field]: next };
    });
  };

  const flash = (msg, isError = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    const { success, data, error } = await getGuildAnnouncements(100);
    if (!success) {
      flash(error || 'Falha ao carregar avisos', true);
      setLoading(false);
      return;
    }
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      flash('Título e mensagem são obrigatórios.', true);
      return;
    }
    setSaving(true);
    const result = await createGuildAnnouncement({
      title: form.title.trim(),
      message: form.message.trim(),
      priority: form.priority,
      mention: form.mention,
      created_by: userId,
    });
    setSaving(false);
    if (!result.success) {
      flash(result.error || 'Erro ao criar aviso.', true);
      return;
    }
    setForm(EMPTY_FORM);
    flash('Aviso criado no site e pendente de publicação no Discord.');
    load();
  };

  const toggleActive = async (item) => {
    const result = await updateGuildAnnouncement(item.id, {
      is_active: !item.is_active,
      discord_notified: item.is_active ? item.discord_notified : false,
    });
    if (!result.success) {
      flash(result.error || 'Erro ao atualizar aviso.', true);
      return;
    }
    load();
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Excluir aviso "${item.title}"?`)) return;
    const result = await deleteGuildAnnouncement(item.id);
    if (!result.success) {
      flash(result.error || 'Erro ao excluir aviso.', true);
      return;
    }
    flash('Aviso excluído.');
    load();
  };

  const publishNow = async (item) => {
    const result = await updateGuildAnnouncement(item.id, {
      is_active: true,
      discord_notified: false,
      discord_message_id: null,
    });
    if (!result.success) {
      flash(result.error || 'Erro ao solicitar publicação.', true);
      return;
    }
    flash('Publicação solicitada. A Celeste D enviará no próximo ciclo.');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-400" />
          Avisos da Guilda
        </h3>
        <button
          type="button"
          onClick={load}
          className="text-gray-400 hover:text-white transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            feedback.isError
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3"
      >
        <p className="text-sm text-gray-400">
          Avisos publicados aqui serão enviados ao Discord automaticamente pela Celeste D com
          destaque (embed colorido por prioridade e menção opcional).
        </p>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">Título</label>
            <EmojiPicker onSelect={(emoji) => insertAtCursor('title', titleRef, emoji)} />
          </div>
          <input
            ref={titleRef}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Título do aviso"
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">Mensagem</label>
            <EmojiPicker onSelect={(emoji) => insertAtCursor('message', messageRef, emoji)} />
          </div>
          <textarea
            ref={messageRef}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Mensagem do aviso"
            rows={4}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Prioridade
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <AtSign className="w-3.5 h-3.5" /> Menção no Discord
            </label>
            <select
              value={form.mention}
              onChange={(e) => setForm((f) => ({ ...f, mention: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
            >
              {MENTION_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {saving ? 'Publicando…' : 'Criar aviso'}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando avisos…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum aviso cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/60 border border-slate-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium">{item.title}</p>
                    <span className={`px-2 py-0.5 rounded text-[11px] ${priorityBadge(item.priority)}`}>
                      {priorityLabel(item.priority)}
                    </span>
                    {item.mention && item.mention !== 'none' && (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-sky-500/20 text-sky-300 inline-flex items-center gap-1">
                        <AtSign className="w-3 h-3" />
                        {item.mention}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{item.message}</p>
                  <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-3">
                    <span>{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                    <span>{item.discord_notified ? 'Publicado no Discord' : 'Pendente de publicação'}</span>
                    <span>{item.is_active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => publishNow(item)}
                    className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 inline-flex items-center gap-1"
                    title="Forçar envio ao Discord"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publicar agora
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(item)}
                    className={`px-2 py-1 rounded text-xs ${
                      item.is_active
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="text-red-400 hover:text-red-300 p-1"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementManagement;

