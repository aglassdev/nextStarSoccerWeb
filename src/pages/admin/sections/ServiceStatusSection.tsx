import { useState, useEffect } from 'react';
import {
  StatusKey,
  StatusSection,
  STATUS_META,
  STATUS_ORDER,
  loadStatusSections,
  saveStatusSections,
} from '../../../services/statusService';

// ── Editor for the public status page (status.nextstarsoccer.com) ──────────────
const ServiceStatusSection = () => {
  const [sections, setSections] = useState<StatusSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setSections(await loadStatusSections());
      setLoading(false);
    })();
  }, []);

  const markDirty = () => { setSaved(false); setError(''); };

  // ── Item mutations ──
  const setItemStatus = (si: number, ii: number, status: StatusKey) => {
    setSections((prev) => prev.map((s, i) =>
      i === si ? { ...s, items: s.items.map((it, j) => j === ii ? { ...it, status } : it) } : s));
    markDirty();
  };
  const setItemName = (si: number, ii: number, name: string) => {
    setSections((prev) => prev.map((s, i) =>
      i === si ? { ...s, items: s.items.map((it, j) => j === ii ? { ...it, name } : it) } : s));
    markDirty();
  };
  const removeItem = (si: number, ii: number) => {
    setSections((prev) => prev.map((s, i) =>
      i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s));
    markDirty();
  };
  const addItem = (si: number) => {
    setSections((prev) => prev.map((s, i) =>
      i === si ? { ...s, items: [...s.items, { name: 'New Service', status: 'operational' as StatusKey }] } : s));
    markDirty();
  };

  // ── Section mutations ──
  const setSectionTitle = (si: number, title: string) => {
    setSections((prev) => prev.map((s, i) => i === si ? { ...s, title } : s));
    markDirty();
  };
  const removeSection = (si: number) => {
    setSections((prev) => prev.filter((_, i) => i !== si));
    markDirty();
  };
  const addSection = () => {
    setSections((prev) => [...prev, { title: 'New Section', items: [] }]);
    markDirty();
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await saveStatusSections(sections);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    setLoading(true);
    setSections(await loadStatusSections());
    setLoading(false);
    setSaved(false);
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-[15px] font-medium font-mono">
            <span className="text-white/25">{'// '}</span>service status
          </h2>
          <p className="text-white/25 text-[11px] font-mono mt-0.5">
            edits the public page at status.nextstarsoccer.com
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            className="px-3 py-2 text-[12px] font-mono text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors"
          >
            Reload
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-[12px] font-mono bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-[12px] font-mono">{error}</div>
      )}

      {/* Sections */}
      {sections.map((section, si) => (
        <div key={si} className="bg-[#131211] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
            <input
              value={section.title}
              onChange={(e) => setSectionTitle(si, e.target.value)}
              className="flex-1 bg-transparent text-white/80 text-[13px] font-mono font-medium focus:outline-none focus:text-white"
            />
            <button
              onClick={() => addItem(si)}
              className="text-[11px] font-mono text-white/40 hover:text-white transition-colors"
            >
              + item
            </button>
            <button
              onClick={() => removeSection(si)}
              className="text-[11px] font-mono text-white/30 hover:text-red-400 transition-colors"
            >
              delete section
            </button>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {section.items.length === 0 ? (
              <p className="text-white/20 text-[12px] font-mono text-center py-5">no services — add one</p>
            ) : (
              section.items.map((item, ii) => {
                const meta = STATUS_META[item.status];
                return (
                  <div key={ii} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <input
                      value={item.name}
                      onChange={(e) => setItemName(si, ii, e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-white text-[13px] font-mono focus:outline-none focus:bg-white/[0.03] rounded px-1.5 py-1"
                    />
                    <select
                      value={item.status}
                      onChange={(e) => setItemStatus(si, ii, e.target.value as StatusKey)}
                      className={`bg-[#0d0d0d] border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] font-mono focus:outline-none focus:border-white/30 ${meta.text}`}
                    >
                      {STATUS_ORDER.map((k) => (
                        <option key={k} value={k} className="bg-[#0d0d0d] text-white">
                          {STATUS_META[k].label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeItem(si, ii)}
                      className="text-white/25 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove service"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}

      <button
        onClick={addSection}
        className="w-full py-3 text-[12px] font-mono text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl transition-colors"
      >
        + add section
      </button>
    </div>
  );
};

export default ServiceStatusSection;
