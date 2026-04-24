import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT as string;
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID as string;
const API_KEY = import.meta.env.VITE_APPWRITE_API_KEY as string | undefined;

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};

interface CollectionCount { label: string; count: number; collectionId: string | undefined }

interface FunctionStat {
  id: string;
  name: string;
  runtime: string;
  executions: number | null;
  enabled: boolean;
}

interface BucketStat {
  id: string;
  name: string;
  files: number | null;
}

// ── Stat card ──────────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, sub, accent = false,
}: {
  label: string; value: string | null; sub?: string; accent?: boolean;
}) => (
  <div className="bg-[#131211] border border-white/[0.07] rounded-xl p-5 flex flex-col gap-2">
    <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">{label}</p>
    {value === null ? (
      <div className="h-8 w-24 bg-white/[0.06] rounded animate-pulse mt-1" />
    ) : (
      <p className={`text-3xl font-mono font-semibold leading-none tabular-nums ${accent ? 'text-green-400' : 'text-white'}`}>
        {value}
      </p>
    )}
    {sub && <p className="text-[11px] text-white/30 font-mono">{sub}</p>}
  </div>
);

// ── Main ───────────────────────────────────────────────────────────────────────
const DevelopmentSection = () => {
  const [authUsers, setAuthUsers] = useState<number | null>(null);
  const [fnStats, setFnStats] = useState<FunctionStat[]>([]);
  const [bucketStats, setBucketStats] = useState<BucketStat[]>([]);
  const [collCounts, setCollCounts] = useState<CollectionCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // ── 1. Collection counts — SDK (no API key needed) ─────────────────
      const collDefs: CollectionCount[] = [
        { label: 'Parents', collectionId: collections.parentUsers, count: 0 },
        { label: 'Youth Players', collectionId: collections.youthPlayers, count: 0 },
        { label: 'Collegiate Players', collectionId: collections.collegiatePlayers, count: 0 },
        { label: 'Professional Players', collectionId: collections.professionalPlayers, count: 0 },
        { label: 'Coaches', collectionId: collections.coaches, count: 0 },
        { label: 'Messages', collectionId: collections.messages, count: 0 },
        { label: 'Bills', collectionId: collections.bills, count: 0 },
        { label: 'Payments', collectionId: collections.payments, count: 0 },
        { label: 'Inquiries', collectionId: collections.websiteInquiries, count: 0 },
        { label: 'Dev Support', collectionId: collections.devSupport, count: 0 },
      ];
      const counts = await Promise.all(
        collDefs.map(async (def) => {
          if (!def.collectionId) return { ...def, count: 0 };
          try {
            const r = await databases.listDocuments(databaseId, def.collectionId, [Query.limit(1)]);
            return { ...def, count: (r as any).total ?? 0 };
          } catch { return { ...def, count: 0 }; }
        })
      );
      setCollCounts(counts);

      if (!API_KEY) { setApiKeyMissing(true); setLoading(false); return; }

      const h = { 'x-appwrite-project': PROJECT_ID, 'x-appwrite-key': API_KEY };

      // ── 2. Auth users ──────────────────────────────────────────────────
      try {
        const r = await fetch(`${ENDPOINT}/users?limit=1`, { headers: h });
        if (r.ok) {
          const d = await r.json();
          setAuthUsers(d.total ?? 0);
        }
      } catch { /* silent */ }

      // ── 3. Functions list + per-function execution counts ──────────────
      try {
        const fnRes = await fetch(`${ENDPOINT}/functions?limit=25`, { headers: h });
        if (fnRes.ok) {
          const fnData = await fnRes.json();
          const fnList: any[] = fnData.functions ?? [];

          const withExec = await Promise.all(
            fnList.map(async (fn): Promise<FunctionStat> => {
              let execTotal: number | null = null;
              try {
                const er = await fetch(`${ENDPOINT}/functions/${fn.$id}/executions?limit=1`, { headers: h });
                if (er.ok) {
                  const ed = await er.json();
                  execTotal = ed.total ?? 0;
                }
              } catch { /* silent */ }
              return {
                id: fn.$id,
                name: fn.name,
                runtime: fn.runtime ?? '',
                executions: execTotal,
                enabled: fn.enabled !== false,
              };
            })
          );
          setFnStats(withExec);
        }
      } catch { /* silent */ }

      // ── 4. Storage buckets + per-bucket file counts ───────────────────
      try {
        const bkRes = await fetch(`${ENDPOINT}/storage/buckets?limit=25`, { headers: h });
        if (bkRes.ok) {
          const bkData = await bkRes.json();
          const bkList: any[] = bkData.buckets ?? [];

          const withFiles = await Promise.all(
            bkList.map(async (bk): Promise<BucketStat> => {
              let fileCount: number | null = null;
              try {
                const fr = await fetch(`${ENDPOINT}/storage/buckets/${bk.$id}/files?limit=1`, { headers: h });
                if (fr.ok) {
                  const fd = await fr.json();
                  fileCount = fd.total ?? 0;
                }
              } catch { /* silent */ }
              return { id: bk.$id, name: bk.name, files: fileCount };
            })
          );
          setBucketStats(withFiles);
        }
      } catch { /* silent */ }

      setLoading(false);
    })();
  }, []);

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalDocuments = collCounts.reduce((s, c) => s + c.count, 0);
  const totalExecutions = fnStats.length
    ? fnStats.reduce((s, f) => s + (f.executions ?? 0), 0)
    : null;
  const totalFiles = bucketStats.length
    ? bucketStats.reduce((s, b) => s + (b.files ?? 0), 0)
    : null;
  const maxCollCount = Math.max(...collCounts.map(c => c.count), 1);
  const maxExec = Math.max(...fnStats.map(f => f.executions ?? 0), 1);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-[15px] font-medium font-mono">
            <span className="text-white/25">{'// '}</span>system overview
          </h2>
          <p className="text-white/25 text-[11px] font-mono mt-0.5">
            {new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {apiKeyMissing && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            <p className="text-amber-400 text-[11px] font-mono">
              Add <code className="bg-white/10 px-1 rounded">VITE_APPWRITE_API_KEY</code> to Vercel env
            </p>
          </div>
        )}
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="// auth users"
          value={authUsers !== null ? fmtNum(authUsers) : (apiKeyMissing ? '—' : null)}
          sub="registered accounts"
          accent
        />
        <StatCard
          label="// fn executions"
          value={totalExecutions !== null ? fmtNum(totalExecutions) : (apiKeyMissing ? '—' : null)}
          sub="all-time across all functions"
        />
        <StatCard
          label="// stored files"
          value={totalFiles !== null ? fmtNum(totalFiles) : (apiKeyMissing ? '—' : null)}
          sub="across all storage buckets"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="// total db documents"
          value={fmtNum(totalDocuments)}
          sub="sum of all collections"
          accent
        />
        <StatCard
          label="// active functions"
          value={fnStats.length ? fmtNum(fnStats.filter(f => f.enabled).length) : (apiKeyMissing ? '—' : null)}
          sub={`of ${fnStats.length || '—'} deployed`}
        />
        <StatCard
          label="// storage buckets"
          value={bucketStats.length ? fmtNum(bucketStats.length) : (apiKeyMissing ? '—' : null)}
          sub="configured buckets"
        />
      </div>

      {/* Functions breakdown */}
      {!apiKeyMissing && (
        <div className="bg-[#131211] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="flex items-center px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">// functions</p>
            {!loading && <span className="ml-auto text-white/20 text-[11px] font-mono">{fnStats.length} deployed</span>}
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                    <div className="w-44 h-3 bg-white/[0.06] rounded" />
                    <div className="w-16 h-3 bg-white/[0.03] rounded" />
                    <div className="flex-1 h-2 bg-white/[0.03] rounded-full" />
                    <div className="w-12 h-3 bg-white/[0.06] rounded" />
                  </div>
                ))
              : fnStats.length === 0
                ? <p className="text-white/20 text-[12px] font-mono text-center py-6">no functions found</p>
                : fnStats.map(fn => (
                    <div key={fn.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex items-center gap-2 w-44 flex-shrink-0 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fn.enabled ? 'bg-green-400' : 'bg-white/20'}`} />
                        <p className="text-white/70 text-[12px] font-mono truncate">{fn.name}</p>
                      </div>
                      <span className="text-white/25 text-[11px] font-mono w-20 flex-shrink-0">{fn.runtime}</span>
                      <div className="flex-1 h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400/50 rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(2, ((fn.executions ?? 0) / maxExec) * 100)}%` }}
                        />
                      </div>
                      <p className="text-white font-mono text-[12px] w-16 text-right tabular-nums">
                        {fn.executions !== null ? fmtNum(fn.executions) : '—'}
                      </p>
                    </div>
                  ))
            }
          </div>
        </div>
      )}

      {/* Collection breakdown */}
      <div className="bg-[#131211] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="flex items-center px-5 py-3.5 border-b border-white/[0.06]">
          <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">// collection breakdown</p>
          {!loading && <span className="ml-auto text-white/20 text-[11px] font-mono">{fmtNum(totalDocuments)} total</span>}
        </div>
        <div className="divide-y divide-white/[0.04]">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                  <div className="w-32 h-3 bg-white/[0.06] rounded" />
                  <div className="flex-1 h-2 bg-white/[0.03] rounded-full" />
                  <div className="w-12 h-3 bg-white/[0.06] rounded" />
                </div>
              ))
            : collCounts.map(col => (
                <div key={col.label} className="flex items-center gap-4 px-5 py-3">
                  <p className="text-white/60 text-[12px] font-mono w-36 flex-shrink-0">{col.label}</p>
                  <div className="flex-1 h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/25 rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(2, (col.count / maxCollCount) * 100)}%` }}
                    />
                  </div>
                  <p className="text-white font-mono text-[12px] w-14 text-right tabular-nums">{fmtNum(col.count)}</p>
                </div>
              ))
          }
        </div>
      </div>

      {/* Storage buckets */}
      {!apiKeyMissing && bucketStats.length > 0 && (
        <div className="bg-[#131211] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="flex items-center px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">// storage buckets</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {bucketStats.map(bk => (
              <div key={bk.id} className="flex items-center gap-4 px-5 py-3">
                <p className="text-white/60 text-[12px] font-mono flex-1 truncate">{bk.name}</p>
                <p className="text-white/30 text-[11px] font-mono">{bk.id}</p>
                <p className="text-white font-mono text-[12px] w-20 text-right tabular-nums">
                  {bk.files !== null ? `${fmtNum(bk.files)} files` : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default DevelopmentSection;
