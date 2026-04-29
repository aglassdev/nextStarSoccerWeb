import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

interface SessionReview {
  $id: string;
  $createdAt: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  sessionRating: number | null;
  coachingRating: number | null;
  comment: string | null;
  dismissed: boolean;
}

interface ReviewGroup {
  eventTitle: string;
  eventId: string;
  reviews: SessionReview[];
  dismissed: number;
  avgSession: number;
  avgCoaching: number;
  earliestDate: string;
  latestDate: string;
}

// ── Star Rating ───────────────────────────────────────────────────────────────
const Stars = ({ value, max = 5 }: { value: number; max?: number }) => (
  <span className="tracking-tight">
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} style={{ color: i < Math.round(value) ? '#facc15' : 'rgba(255,255,255,0.15)', fontSize: 14 }}>
        ★
      </span>
    ))}
  </span>
);

// ── Session Review Card ───────────────────────────────────────────────────────
const ReviewGroupCard = ({ group }: { group: ReviewGroup }) => {
  const date = new Date(group.earliestDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });

  const comments = group.reviews
    .map(r => r.comment?.trim())
    .filter((c): c is string => !!c);

  return (
    <div className="bg-[#1d1c21] rounded-lg border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <p className="text-white text-[15px] font-medium leading-snug mb-1">
          {group.eventTitle || '(Untitled Event)'}
        </p>
        <p className="text-white/35 text-[12px]">{date}</p>
      </div>

      {/* Ratings */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-8">
        {group.avgSession > 0 ? (
          <div>
            <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1.5">
              Avg Session
            </p>
            <div className="flex items-center gap-2">
              <Stars value={group.avgSession} />
              <span className="text-white/60 text-[12px] tabular-nums">
                {group.avgSession.toFixed(1)}
              </span>
            </div>
          </div>
        ) : null}

        {group.avgCoaching > 0 ? (
          <div>
            <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1.5">
              Avg Coaching
            </p>
            <div className="flex items-center gap-2">
              <Stars value={group.avgCoaching} />
              <span className="text-white/60 text-[12px] tabular-nums">
                {group.avgCoaching.toFixed(1)}
              </span>
            </div>
          </div>
        ) : null}

        <div className="ml-auto text-right">
          <p className="text-white/20 text-[11px]">
            {group.reviews.length} {group.reviews.length === 1 ? 'review' : 'reviews'}
            {group.dismissed > 0 && (
              <span> · {group.dismissed} dismissed</span>
            )}
          </p>
        </div>
      </div>

      {/* Comments */}
      {comments.length > 0 ? (
        <div className="px-5 py-4 space-y-3">
          <p className="text-white/25 text-[10px] uppercase tracking-widest mb-3">Comments</p>
          {comments.map((comment, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="text-white/20 text-[12px] mt-0.5 flex-shrink-0">"</span>
              <p className="text-white/70 text-[13px] leading-snug">{comment}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-4">
          <p className="text-white/20 text-[12px]">No comments left</p>
        </div>
      )}
    </div>
  );
};

// ── Main Section ──────────────────────────────────────────────────────────────
const SessionReviewsSection = () => {
  const [reviews, setReviews] = useState<SessionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await databases.listDocuments(
          databaseId,
          collections.sessionReviews,
          [Query.limit(500), Query.orderDesc('$createdAt')],
        );
        setReviews(res.documents as unknown as SessionReview[]);
      } catch (err: any) {
        setError(err?.message || 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const buildGroups = (): ReviewGroup[] => {
    const map = new Map<string, ReviewGroup>();

    for (const r of reviews) {
      const key = r.eventId || r.eventTitle;
      if (!map.has(key)) {
        map.set(key, {
          eventTitle: r.eventTitle || '(Untitled Event)',
          eventId: r.eventId,
          reviews: [],
          dismissed: 0,
          avgSession: 0,
          avgCoaching: 0,
          earliestDate: r.$createdAt,
          latestDate: r.$createdAt,
        });
      }
      const group = map.get(key)!;

      if (r.dismissed) {
        group.dismissed += 1;
      } else {
        group.reviews.push(r);
      }

      if (r.$createdAt < group.earliestDate) group.earliestDate = r.$createdAt;
      if (r.$createdAt > group.latestDate) group.latestDate = r.$createdAt;
    }

    for (const group of map.values()) {
      const withSession = group.reviews.filter(r => r.sessionRating !== null);
      const withCoaching = group.reviews.filter(r => r.coachingRating !== null);
      group.avgSession = withSession.length
        ? withSession.reduce((s, r) => s + r.sessionRating!, 0) / withSession.length
        : 0;
      group.avgCoaching = withCoaching.length
        ? withCoaching.reduce((s, r) => s + r.coachingRating!, 0) / withCoaching.length
        : 0;
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime(),
    );
  };

  const allGroups = buildGroups();
  const filteredGroups = search.trim()
    ? allGroups.filter(g =>
        g.eventTitle.toLowerCase().includes(search.toLowerCase()),
      )
    : allGroups;

  const totalReviews = allGroups.reduce((s, g) => s + g.reviews.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-10 text-center">
        <p className="text-white/40 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-7 max-w-[860px] space-y-6">

      {/* Summary */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-white text-[22px] font-semibold leading-none tabular-nums">{totalReviews}</p>
          <p className="text-white/40 text-[11px] mt-1">reviews submitted</p>
        </div>
        <div className="w-px h-8 bg-white/[0.08]" />
        <div>
          <p className="text-white text-[22px] font-semibold leading-none tabular-nums">{allGroups.length}</p>
          <p className="text-white/40 text-[11px] mt-1">sessions reviewed</p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by session name…"
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-[13px] placeholder:text-white/25 outline-none focus:border-white/20 transition-colors"
      />

      {/* Cards */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/25 text-sm">
            {search ? 'No sessions match your search' : 'No reviews yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => (
            <ReviewGroupCard key={group.eventId || group.eventTitle} group={group} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionReviewsSection;
