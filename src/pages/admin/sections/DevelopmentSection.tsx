import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT as string;
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID as string;
const API_KEY = import.meta.env.VITE_APPWRITE_API_KEY as string | undefined;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtBytes = (b: number) => {
  if (!b) return '0 B';
  const k = 1024;
  const sz = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sz[i]}`;
};
const fmtNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};

interface UsageSeries { date: string; value: number }

interface ProjectUsage {
  requests: UsageSeries[];
  network: UsageSeries[];
  executions: UsageSeries[];
  storage: UsageSeries[];
  users: UsageSeries[];
  documents: UsageSeries[];
  files: UsageSeries[];
  sessions: UsageSeries[];
}

interface Stats {
  totalUsers: number | null;
  totalRequests: number | null;
  totalBandwidth: number | null;
  totalExecutions: number | null;
  storageUsed: number | null;
  totalDocuments: number | null;
  totalFiles: number | null;
  activeSessions: number | null;
  requestSeries: number[];
  executionSeries: number[];
}

interface CollectionCount { label: string; count: number; collectionId: string | undefined }

// ── Sparkline bar chart ────────────────────────────────────────────────────────
const BarSparkline = ({ data, color = 'rgba(255,255,255,0.5)' }: { data: number[]; color?: string }) => {
  if (!data.length) return <div className="w-full h-full bg-white/[0.03] rounded" />;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px w-full h-full">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm min-h-px transition-all duration-300"
          style={{
            height: `${Math.max(4, (v / max) * 100)}%`,
            backgroundColor: color,
            opacity: i === data.length - 1 ? 1 : 0.4 + (i / data.length) * 0.6,
          }}
        />
      ))}
    </div>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, sub, accent = false, sparkline, sparklineColor,
}: {
  label: string; value: string | null; sub?: string;
  accent?: boolean; sparkline?: number[]; sparklineColor?: string;
}) => (
  <div className="bg-[#131211] border border-white/[0.07] rounded-xl p-4 flex flex-col gap-3 overflow-hidden relative">
    <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">{label}</p>
    <div className="flex-1">
      {value === null ? (
        <div className="h-7 w-20 bg-white/[0.06] rounded animate-pulse" />
      ) : (
        <p className={`text-2xl font-mono font-semibold leading-none ${accent ? 'text-green-400' : 'text-white'}`}>
          {value}
        </p>
      )}
      {sub && <p className="text-[11px] text-white/30 mt-1.5 font-mono">{sub}</p>}
    </div>
    {sparkline && sparkline.length > 0 && (
      <div className="h-8 w-full">
        <BarSparkline data={sparkline} color={sparklineColor ?? (accent ? '#4ade80' : 'rgba(255,255,255,0.35)')} />
      </div>
    )}
  </div>
);

// ── Main section ──────────────────────────────────────────────────────────────
const DevelopmentSection = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: null, totalRequests: null, totalBandwidth: null,
    totalExecutions: null, storageUsed: null, totalDocuments: null,
    totalFiles: null, activeSessions: null, requestSeries: [], executionSeries: [],
  });
  const [collCounts, setCollCounts] = useState<CollectionCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // ── Collection counts (no API key needed) ────────────────────────────
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
            const res = await databases.listDocuments(databaseId, def.collectionId, [Query.limit(1)]);
            return { ...def, count: (res as any).total ?? 0 };
          } catch { return { ...def, count: 0 }; }
        })
      );
      setCollCounts(counts);

      // ── Project usage API (requires VITE_APPWRITE_API_KEY) ──────────────
      if (!API_KEY) {
        setApiKeyMissing(true);
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        'x-appwrite-project': PROJECT_ID,
        'x-appwrite-key': API_KEY,
        'Content-Type': 'application/json',
      };

      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

      const [usageRes, usersRes] = await Promise.all([
        fetch(`${ENDPOINT}/project/usage?startDate=${startDate}&endDate=${endDate}`, { headers }).catch(() => null),
        fetch(`${ENDPOINT}/users?queries=${encodeURIComponent(JSON.stringify([{ method: 'limit', values: [1] }]))}`, { headers }).catch(() => null),
      ]);

      let usage: Partial<ProjectUsage> = {};
      let totalUsers: number | null = null;

      if (usageRes?.ok) {
        try { usage = await usageRes.json(); } catch { /* ignore */ }
      }
      if (usersRes?.ok) {
        try {
          const ud = await usersRes.json();
          totalUsers = ud.total ?? null;
        } catch { /* ignore */ }
      }

      const sum = (series?: UsageSeries[]) => (series ?? []).reduce((acc, p) => acc + (p.value ?? 0), 0);
      const latest = (series?: UsageSeries[]) => series?.length ? series[series.length - 1].value : null;

      setStats({
        totalUsers,
        totalRequests: sum(usage.requests),
        totalBandwidth: sum(usage.network),
        totalExecutions: sum(usage.executions),
        storageUsed: latest(usage.storage),
        totalDocuments: latest(usage.documents),
        totalFiles: latest(usage.files),
        activeSessions: latest(usage.sessions),
        requestSeries: (usage.requests ?? []).map(p => p.value),
        executionSeries: (usage.executions ?? []).map(p => p.value),
      });

      setLoading(false);
    })();
  }, []);

  const maxCollCount = Math.max(...collCounts.map(c => c.count), 1);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-[15px] font-medium font-mono flex items-center gap-2">
            <span className="text-white/30">{'</'}</span>
            <span>System Overview</span>
            <span className="text-white/30">{'>'}</span>
          </h2>
          <p className="text-white/30 text-[11px] font-mono mt-0.5">last 30 days · {new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        {apiKeyMissing && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            <p className="text-amber-400 text-[11px] font-mono">Add <code className="bg-white/10 px-1 rounded">VITE_APPWRITE_API_KEY</code> to see usage stats</p>
          </div>
        )}
      </div>

      {/* Row 1 — 4 stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="// auth users"
          value={stats.totalUsers !== null ? fmtNum(stats.totalUsers) : (apiKeyMissing ? '—' : null)}
          sub="registered accounts"
          accent
        />
        <StatCard
          label="// api requests"
          value={stats.totalRequests !== null ? fmtNum(stats.totalRequests) : (apiKeyMissing ? '—' : null)}
          sub="last 30 days"
          sparkline={stats.requestSeries}
        />
        <StatCard
          label="// bandwidth"
          value={stats.totalBandwidth !== null ? fmtBytes(stats.totalBandwidth) : (apiKeyMissing ? '—' : null)}
          sub="data transferred"
        />
        <StatCard
          label="// fn executions"
          value={stats.totalExecutions !== null ? fmtNum(stats.totalExecutions) : (apiKeyMissing ? '—' : null)}
          sub="last 30 days"
          sparkline={stats.executionSeries}
          sparklineColor="#818cf8"
        />
      </div>

      {/* Row 2 — 4 more stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="// storage used"
          value={stats.storageUsed !== null ? fmtBytes(stats.storageUsed) : (apiKeyMissing ? '—' : null)}
          sub="across all buckets"
        />
        <StatCard
          label="// total documents"
          value={stats.totalDocuments !== null ? fmtNum(stats.totalDocuments) : (apiKeyMissing ? '—' : null)}
          sub="all collections"
          accent
        />
        <StatCard
          label="// stored files"
          value={stats.totalFiles !== null ? fmtNum(stats.totalFiles) : (apiKeyMissing ? '—' : null)}
          sub="across all buckets"
        />
        <StatCard
          label="// active sessions"
          value={stats.activeSessions !== null ? fmtNum(stats.activeSessions) : (apiKeyMissing ? '—' : null)}
          sub="current"
        />
      </div>

      {/* Row 3 — Charts */}
      {!apiKeyMissing && (stats.requestSeries.length > 0 || loading) && (
        <div className="grid grid-cols-2 gap-3">
          {/* Requests chart */}
          <div className="bg-[#131211] border border-white/[0.07] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">// api requests · 30d</p>
              {stats.totalRequests !== null && (
                <p className="text-white font-mono text-sm">{fmtNum(stats.totalRequests)} total</p>
              )}
            </div>
            <div className="h-20">
              {loading ? (
                <div className="w-full h-full bg-white/[0.03] rounded animate-pulse" />
              ) : (
                <BarSparkline data={stats.requestSeries} color="rgba(255,255,255,0.5)" />
              )}
            </div>
          </div>

          {/* Executions chart */}
          <div className="bg-[#131211] border border-white/[0.07] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">// fn executions · 30d</p>
              {stats.totalExecutions !== null && (
                <p className="text-white font-mono text-sm">{fmtNum(stats.totalExecutions)} total</p>
              )}
            </div>
            <div className="h-20">
              {loading ? (
                <div className="w-full h-full bg-white/[0.03] rounded animate-pulse" />
              ) : (
                <BarSparkline data={stats.executionSeries} color="#818cf8" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Row 4 — Collection breakdown */}
      <div className="bg-[#131211] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="flex items-center px-5 py-3.5 border-b border-white/[0.06]">
          <p className="text-[10px] font-mono tracking-widest text-white/35 uppercase">// collection breakdown</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-28 h-3 bg-white/[0.06] rounded animate-pulse" />
                  <div className="flex-1 h-2 bg-white/[0.03] rounded-full animate-pulse" />
                  <div className="w-12 h-3 bg-white/[0.06] rounded animate-pulse" />
                </div>
              ))
            : collCounts.map(col => (
                <div key={col.label} className="flex items-center gap-4 px-5 py-3">
                  <p className="text-white/60 text-[12px] font-mono w-36 flex-shrink-0">{col.label}</p>
                  <div className="flex-1 h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/30 rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(2, (col.count / maxCollCount) * 100)}%` }}
                    />
                  </div>
                  <p className="text-white font-mono text-[12px] w-14 text-right">{fmtNum(col.count)}</p>
                </div>
              ))
          }
        </div>
      </div>

    </div>
  );
};

export default DevelopmentSection;
