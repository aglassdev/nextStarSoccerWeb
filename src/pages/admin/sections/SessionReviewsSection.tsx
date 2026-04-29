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
  latestDate: string;
}

// ── Star Rating ───────────────────────────────────────────────────────────────
const Stars = ({ value, max = 5 }: { value: number; max?: number }) => (
  <span className="text-[13px] tracking-tight">
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} style={{ color: i < Math.round(value) ? '#facc15' : 'rgba(255,255,255,0.15)' }}>
        ★
      </span>
    ))}
  </span>
);

// ── Average Badge ─────────────────────────────────────────────────────────────
const AvgBadge = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-white/40 text-[11px]">{label}</span>
    <Stars value={value} />
    <span className="text-white/60 text-[11px] tabular-nums">{value.toFixed(1)}</span>
  </div>
);

// ── Review Card ───────────────────────────────────────────────────────────────
const ReviewCard = ({
  review,
  userName,
}: {
  review: SessionReview;
  userName: string;
}) => {
  const date = new Date(review.$createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });

  return (
    <div className="px-5 py-4 border-b border-white/[0.05] last:border-0">
      <div className="flex items-start justify-between gap-4">
        {/* Left: user + ratings */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-medium">
                {(userName[0] || '?').toUpperCase()}
              </span>
            </div>
            <span className="text-white text-[13px] truncate">{userName}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-2">
            {review.sessionRating !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/35 text-[11px]">Session</span>
                <Stars value={review.sessionRating} />
              </div>
            )}
            {review.coachingRating !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/35 text-[11px]">Coaching</span>
                <Stars value={review.coachingRating} />
              </div>
            )}
          </div>
          {review.comment && (
            <p className="text-white/70 text-[13px] leading-snug">{review.comment}</p>
          )}
        </div>

        {/* Right: date */}
        <span className="text-white/25 text-[11px] flex-shrink-0 mt-0.5">{date}</span>
      </div>
    </div>
  );
};

// ── Main Section ──────────────────────────────────────────────────────────────
const SessionReviewsSection = () => {
  const [reviews, setReviews] = useState<SessionReview[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch all reviews
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await databases.listDocuments(
          databaseId,
          collections.sessionReviews,
          [Query.limit(500), Query.orderDesc('$createdAt')],
        );
        const docs = res.documents as unknown as SessionReview[];
        setReviews(docs);

        // Look up user names for non-dismissed reviews
        const userIds = [...new Set(docs.filter(r => !r.dismissed).map(r => r.userId))];
        if (userIds.length > 0) {
          await resolveUserNames(userIds);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const resolveUserNames = async (userIds: string[]) => {
    const nameMap: Record<string, string> = {};

    const collectionsToSearch = [
      collections.youthPlayers,
      collections.collegiatePlayers,
      collections.professionalPlayers,
      collections.parentUsers,
      collections.coaches,
    ].filter(Boolean) as string[];

    await Promise.all(
      collectionsToSearch.map(async (colId) => {
        try {
          const res = await databases.listDocuments(databaseId, colId, [
            Query.limit(500),
          ]);
          for (const doc of res.documents as any[]) {
            if (doc.userId && userIds.includes(doc.userId)) {
              const first = doc.firstName || '';
              const last = doc.lastName || '';
              const full = `${first} ${last}`.trim();
              if (full && !nameMap[doc.userId]) {
                nameMap[doc.userId] = full;
              }
            }
          }
        } catch { /* skip collection if inaccessible */ }
      }),
    );

    setUserNames(prev => ({ ...prev, ...nameMap }));
  };

  // Group reviews by event
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
          latestDate: r.$createdAt,
        });
      }
      const group = map.get(key)!;
      if (r.dismissed) {
        group.dismissed += 1;
      } else {
        group.reviews.push(r);
        if (r.$createdAt > group.latestDate) group.latestDate = r.$createdAt;
      }
    }

    // Compute averages
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

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allGroups = buildGroups();
  const filteredGroups = search.trim()
    ? allGroups.filter(g =>
        g.eventTitle.toLowerCase().includes(search.toLowerCase()),
      )
    : allGroups;

  const totalReviews = allGroups.reduce((s, g) => s + g.reviews.length, 0);
  const totalDismissed = allGroups.reduce((s, g) => s + g.dismissed, 0);
  const overallAvgSession = (() => {
    const rated = reviews.filter(r => !r.dismissed && r.sessionRating !== null);
    return rated.length ? rated.reduce((s, r) => s + r.sessionRating!, 0) / rated.length : 0;
  })();
  const overallAvgCoaching = (() => {
    const rated = reviews.filter(r => !r.dismissed && r.coachingRating !== null);
    return rated.length ? rated.reduce((s, r) => s + r.coachingRating!, 0) / rated.length : 0;
  })();

  // ── Render ────────────────────────────────────────────────────────────────
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
    <div className="px-8 py-7 max-w-[900px] space-y-6">

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-white text-[22px] font-semibold leading-none tabular-nums">{totalReviews}</p>
          <p className="text-white/40 text-[11px] mt-1">reviews submitted</p>
        </div>
        <div className="w-px h-8 bg-white/[0.08]" />
        <div>
          <p className="text-white text-[22px] font-semibold leading-none tabular-nums">{allGroups.length}</p>
          <p className="text-white/40 text-[11px] mt-1">sessions reviewed</p>
        </div>
        {totalReviews > 0 && (
          <>
            <div className="w-px h-8 bg-white/[0.08]" />
            <div className="flex flex-col gap-1">
              <AvgBadge label="Avg session" value={overallAvgSession} />
              <AvgBadge label="Avg coaching" value={overallAvgCoaching} />
            </div>
          </>
        )}
        {totalDismissed > 0 && (
          <>
            <div className="w-px h-8 bg-white/[0.08]" />
            <div>
              <p className="text-white/40 text-[22px] font-semibold leading-none tabular-nums">{totalDismissed}</p>
              <p className="text-white/25 text-[11px] mt-1">dismissed</p>
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by session name…"
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-[13px] placeholder:text-white/25 outline-none focus:border-white/20 transition-colors"
      />

      {/* Groups */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/25 text-sm">
            {search ? 'No sessions match your search' : 'No reviews yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const key = group.eventId || group.eventTitle;
            const expanded = expandedGroups.has(key);
            const hasReviews = group.reviews.length > 0;

            return (
              <div
                key={key}
                className="bg-[#1d1c21] rounded-lg border border-white/[0.08] overflow-hidden"
              >
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-start justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-[13px] font-medium leading-snug truncate">
                      {group.eventTitle}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-1.5">
                      <span className="text-white/40 text-[11px]">
                        {group.reviews.length} {group.reviews.length === 1 ? 'review' : 'reviews'}
                        {group.dismissed > 0 && (
                          <span className="text-white/20"> · {group.dismissed} dismissed</span>
                        )}
                      </span>
                      {group.avgSession > 0 && (
                        <AvgBadge label="Session" value={group.avgSession} />
                      )}
                      {group.avgCoaching > 0 && (
                        <AvgBadge label="Coaching" value={group.avgCoaching} />
                      )}
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5 transition-transform duration-150"
                    style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Review list */}
                {expanded && (
                  <div className="border-t border-white/[0.06]">
                    {!hasReviews ? (
                      <p className="px-5 py-4 text-white/25 text-[13px]">
                        All {group.dismissed} {group.dismissed === 1 ? 'review was' : 'reviews were'} dismissed
                      </p>
                    ) : (
                      group.reviews.map(review => (
                        <ReviewCard
                          key={review.$id}
                          review={review}
                          userName={
                            userNames[review.userId] ||
                            `${review.userId.slice(0, 8)}…`
                          }
                        />
                      ))
                    )}
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

export default SessionReviewsSection;
