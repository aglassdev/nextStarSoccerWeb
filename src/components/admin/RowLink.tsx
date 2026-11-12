import type { MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Admin tables whose rows open a page. Each cell's content is a real link, so
// right-clicking a row offers "Open Link in New Tab" (and cmd/ctrl-click or a
// middle click opens one), while a plain click anywhere on the row, the gaps
// between the links included, still opens it in place.

const openInNewTab = (to: string) => window.open(to, '_blank', 'noopener');

/** The row's own click handlers, for clicks that land outside a cell's link. */
export function useRowOpen() {
  const navigate = useNavigate();
  return (to: string) => ({
    onClick: (e: MouseEvent) => (e.metaKey || e.ctrlKey ? openInNewTab(to) : navigate(to)),
    onAuxClick: (e: MouseEvent) => {
      if (e.button === 1) openInNewTab(to);
    },
  });
}

/**
 * A cell's content as a link to the row's page. Give it the cell's padding
 * (the cell itself gets none, so the whole cell is the link). Only the first
 * cell's link is in the keyboard order, so a row is one tab stop.
 */
export function CellLink({
  to,
  first = false,
  className = '',
  title,
  children,
}: {
  to: string;
  first?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      tabIndex={first ? undefined : -1}
      title={title}
      // The row has its own handlers; this keeps it from opening the page twice
      onClick={e => e.stopPropagation()}
      onAuxClick={e => e.stopPropagation()}
      className={`block h-full ${className}`}
    >
      {children}
    </Link>
  );
}
