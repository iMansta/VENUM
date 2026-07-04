import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  Send,
  X,
  Pencil,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  getContentEvents,
  createContentEvent,
  deleteContentEvent,
  CONTENT_ROLE_PRESETS,
  CONTENT_TYPE_SUGGESTIONS,
} from '@/lib/supabase/content';

const slug = (s) =>
  String(s || 'role')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'role';

const Content = ({ userId, userRole }) => {
  const isOfficer = userRole === 'admin' || userRole === 'officer';
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [roles, setRoles] = useState([]);

  const loadEvents = async () => {
    setLoading(true);
    const { success, data } = await getContentEvents();
    if (success) setEvents(data);
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const totalSlots = useMemo(
    () => roles.reduce((sum, r) => sum + (Number(r.slots) || 0), 0),
    [roles]
  );

  const addPresetRole = (preset) => {
    if (roles.some((r) => r.id === preset.id)) return;
    setRoles((prev) => [...prev, { ...preset, slots: 1 }]);
  };

  const addCustomRole = () => {
    const base = 'Personalizado';
    let id = slug(base);
    let n = 1;
    while (roles.some((r) => r.id === id)) {
      id = `${slug(base)}_${n++}`;
    }
    setRoles((prev) => [...prev, { id, label: base, emoji: '🎭', slots: 1, custom: true }]);
  };

  const updateRole = (id, patch) =>
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRole = (id) => setRoles((prev) => prev.filter((r) => r.id !== id));

  const resetForm = () => {
    setTitle('');
    setContentType('');
    setDescription('');
    setEventDate('');
    setEventTime('');
    setMaxParticipants(10);
    setRoles([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedback({ type: 'error', msg: 'Informe um título para o conteúdo.' });
      return;
    }
    if (roles.length === 0) {
      setFeedback({ type: 'error', msg: 'Adicione pelo menos uma role.' });
      return;
    }
    setSaving(true);
    setFeedback(null);

    const startsAt =
      eventDate && eventTime ? new Date(`${eventDate}T${eventTime}:00`).toISOString() : null;
    const [y, m, d] = (eventDate || '').split('-');
    const displayDate = eventDate ? `${d}/${m}/${y}` : '';

    const { success, error } = await createContentEvent({
      title: title.trim(),
      contentType: contentType.trim(),
      description: description.trim(),
      eventDate: displayDate,
      eventTime,
      startsAt,
      maxParticipants: Number(maxParticipants) || null,
      roles: roles.map((r) => ({
        id: r.id,
        label: r.label,
        emoji: r.emoji,
        slots: Number(r.slots) || 0,
      })),
      createdBy: userId,
    });

    setSaving(false);
    if (success) {
      setFeedback({ type: 'success', msg: 'Conteúdo criado! O Celeste vai publicá-lo no Discord.' });
      resetForm();
      setShowForm(false);
      loadEvents();
    } else {
      setFeedback({ type: 'error', msg: error || 'Falha ao criar conteúdo.' });
    }
  };

  const handleDelete = async (id) => {
    const { success } = await deleteContentEvent(id);
    if (success) loadEvents();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-red-500" />
            Content
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Crie conteúdos (DG Avalonia, Baú Dourado, CTA...) com roles customizadas. O bot Celeste
            publica no Discord com botões de inscrição.
          </p>
        </div>
        {isOfficer && (
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setFeedback(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Fechar' : 'Novo conteúdo'}
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={[
            'mb-4 px-4 py-3 rounded-lg text-sm',
            feedback.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30',
          ].join(' ')}
        >
          {feedback.msg}
        </div>
      )}

      {showForm && isOfficer && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-8 space-y-5"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Título *</label>
              <p className="text-xs text-gray-500 mb-2">Nome que aparece no Discord. Ex: AVA B2B VENUM</p>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                placeholder="AVA B2B VENUM"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tipo de conteúdo</label>
              <p className="text-xs text-gray-500 mb-2">Categoria do evento. Escolha ou digite.</p>
              <input
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                list="content-types"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                placeholder="DG Avalonia"
              />
              <datalist id="content-types">
                {CONTENT_TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
            <p className="text-xs text-gray-500 mb-2">
              Requisitos, IP mínimo, sets, saída, fee, prioridades. Aparece no embed do Discord.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 resize-y"
              placeholder={'Off tank 1500 avg\nCobra 1500 set\nFee 350k 10 Man\nSaída: LYN portal'}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Data</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Hora</label>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Qtd. participantes
              </label>
              <input
                type="number"
                min={1}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Roles ({roles.length}) · {totalSlots} vagas
              </label>
              <button
                type="button"
                onClick={addCustomRole}
                className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300"
              >
                <Plus className="w-3 h-3" /> Role personalizada
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Clique para adicionar roles. Ajuste o número de vagas e renomeie as personalizadas.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {CONTENT_ROLE_PRESETS.map((preset) => {
                const added = roles.some((r) => r.id === preset.id);
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => addPresetRole(preset)}
                    disabled={added}
                    className={[
                      'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      added
                        ? 'bg-slate-800 border-slate-700 text-gray-600 cursor-not-allowed'
                        : 'bg-slate-800 border-slate-700 text-gray-200 hover:border-red-500',
                    ].join(' ')}
                  >
                    {preset.emoji} {preset.label}
                  </button>
                );
              })}
            </div>

            {roles.length > 0 && (
              <div className="space-y-2">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2"
                  >
                    <input
                      value={r.emoji}
                      onChange={(e) => updateRole(r.id, { emoji: e.target.value })}
                      className="w-12 text-center bg-slate-900 border border-slate-700 rounded px-1 py-1 text-sm"
                    />
                    <input
                      value={r.label}
                      onChange={(e) => updateRole(r.id, { label: e.target.value })}
                      readOnly={!r.custom}
                      className={[
                        'flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white',
                        r.custom ? 'focus:outline-none focus:border-red-500' : 'text-gray-300',
                      ].join(' ')}
                    />
                    {r.custom && <Pencil className="w-3.5 h-3.5 text-gray-500" />}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">Vagas</span>
                      <input
                        type="number"
                        min={0}
                        value={r.slots}
                        onChange={(e) => updateRole(r.id, { slots: e.target.value })}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRole(r.id)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publicar no Discord
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Nenhum conteúdo criado ainda.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {events.map((ev) => {
            const signups = ev.discord_content_signups || [];
            const evRoles = Array.isArray(ev.roles) ? ev.roles : [];
            return (
              <div
                key={ev.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-white font-semibold">{ev.title}</h3>
                    {ev.content_type && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                        {ev.content_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {ev.discord_notified ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> No Discord
                      </span>
                    ) : (
                      <span className="text-xs text-yellow-400">Enviando...</span>
                    )}
                    {isOfficer && (
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {ev.description && (
                  <p className="text-sm text-gray-400 mt-3 whitespace-pre-line line-clamp-4">
                    {ev.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
                  {ev.event_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {ev.event_date}
                    </span>
                  )}
                  {ev.event_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {ev.event_time}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {signups.length}
                    {ev.max_participants ? `/${ev.max_participants}` : ''}
                  </span>
                </div>

                {evRoles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {evRoles.map((r) => {
                      const count = signups.filter((s) => s.role_id === r.id).length;
                      return (
                        <span
                          key={r.id}
                          className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-gray-300"
                        >
                          {r.emoji} {r.label} {count}/{r.slots || 0}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Content;
