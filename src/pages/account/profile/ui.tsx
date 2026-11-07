import { useEffect, useRef } from 'react';

// Building blocks shared by Profile, My Family and Settings, styled after the
// app's components: white-outlined field boxes, #1a1a1a modals with a back
// arrow and a cream (#F4F2EE) Save button, and Yes/No alert boxes.

export const CREAM = '#F4F2EE';

export const BackArrowIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
  </svg>
);

export const PersonIcon = ({ className = 'w-9 h-9' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2.25c-4.14 0-7.5 2.52-7.5 5.63 0 .62.5 1.12 1.12 1.12h12.76c.62 0 1.12-.5 1.12-1.12 0-3.11-3.36-5.63-7.5-5.63Z" />
  </svg>
);

export const ChevronDownIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
  </svg>
);

export const CheckIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

export const SmallSpinner = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <span className={`${className} inline-block border-2 border-white/40 border-t-white rounded-full animate-spin`} />
);

/** Full-screen dimmed layer; clicking outside the content or pressing Escape closes it. */
export const Overlay = ({ onClose, children, dim = 'bg-black/90' }: {
  onClose?: () => void;
  children: React.ReactNode;
  dim?: string;
}) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  // The layer scrolls (not the dialog), so a picker's menu can hang over the
  // dialog's Save button as in the app, and tall dialogs still fit a phone.
  const outside = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose?.(); };
  return (
    <div className={`fixed inset-0 z-[200] overflow-y-auto ${dim}`} onMouseDown={outside}>
      <div className="min-h-full flex items-center justify-center px-4 py-6" onMouseDown={outside}>
        {children}
      </div>
    </div>
  );
};

/** The app's edit modal: #1a1a1a box, white border, back arrow, centred title. */
export const AppModal = ({ title, onClose, children, wide = false }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <Overlay onClose={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`relative w-full ${wide ? 'max-w-[480px]' : 'max-w-[420px]'} bg-[#1a1a1a] border border-white rounded-xl px-6 py-5`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Back"
        className="absolute top-5 left-5 p-1 text-white hover:text-gray-300 transition-colors"
      >
        <BackArrowIcon />
      </button>
      <h3 className="text-white text-lg font-medium text-center mt-2.5 mb-5 px-8">{title}</h3>
      {children}
    </div>
  </Overlay>
);

export const SaveButton = ({ disabled, onClick, children = 'Save', type = 'button', className = '' }: {
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  type?: 'button' | 'submit';
  className?: string;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`w-full py-[15px] rounded-lg text-base font-medium text-black transition-colors bg-[#F4F2EE] hover:bg-white disabled:bg-[#666] disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

/** The app's Yes/No alert (or a message-only alert when no actions are given). */
export const AlertBox = ({ message, onYes, onNo, yesLabel = 'Yes', noLabel = 'No', busy, onDismiss }: {
  message: React.ReactNode;
  onYes?: () => void;
  onNo?: () => void;
  yesLabel?: string;
  noLabel?: string;
  busy?: boolean;
  onDismiss?: () => void;
}) => (
  <Overlay onClose={onDismiss || onNo} dim="bg-black/80">
    <div role="alertdialog" aria-modal="true" className="w-full max-w-[320px] bg-[#1a1a1a] border border-white rounded-xl px-6 py-5">
      <p className={`text-white text-base text-center leading-[22px] ${onYes ? 'mb-5' : ''}`}>{message}</p>
      {onYes && (
        <div className="flex justify-around">
          <button type="button" onClick={onNo} disabled={busy}
            className="min-w-[60px] px-5 py-2.5 rounded-lg text-white font-medium hover:bg-white/10 transition-colors disabled:opacity-40">
            {noLabel}
          </button>
          <button type="button" onClick={onYes} disabled={busy}
            className="min-w-[60px] px-5 py-2.5 rounded-lg text-white font-medium hover:bg-white/10 transition-colors disabled:opacity-40">
            {busy ? <SmallSpinner className="w-4 h-4 align-middle" /> : yesLabel}
          </button>
        </div>
      )}
    </div>
  </Overlay>
);

/** A labelled, white-outlined value box that opens an editor when clicked. */
export const FieldBox = ({ label, value, onClick, disabled = false, muted = false, className = '' }: {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  /** Read-only (no editor). */
  disabled?: boolean;
  /** The app's greyed "can't edit yet" look. */
  muted?: boolean;
  className?: string;
}) => {
  const interactive = !!onClick && !disabled;
  const box = `w-full min-h-[52px] rounded-lg border px-[15px] py-[14px] text-left text-base truncate transition-colors ${
    muted ? 'bg-[#2a2a2a] border-white/70 text-[#999] opacity-70' : 'bg-black border-white text-white'
  } ${interactive ? 'hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50' : ''}`;
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-white text-base font-medium mb-2">{label}</p>
      {interactive ? (
        <button type="button" onClick={onClick} className={box}>{value}</button>
      ) : (
        <div className={box}>{value}</div>
      )}
    </div>
  );
};

/** A titled section card (the app's section headings, given card chrome for the wide layout). */
export const SectionCard = ({ title, children, className = '', titleClassName = 'text-white' }: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
}) => (
  <section className={`bg-[#111] border border-[#222] rounded-2xl p-5 md:p-7 ${className}`}>
    {title && <h3 className={`text-xl font-medium mb-5 ${titleClassName}`}>{title}</h3>}
    {children}
  </section>
);

/** Round profile photo with the app's white "+" badge when editable. */
export const Avatar = ({
  url,
  sizeClass = 'w-[72px] h-[72px]',
  badgeClass = 'w-6 h-6 text-[15px]',
  onPick,
  uploading = false,
  label = 'Change profile photo',
}: {
  url?: string;
  sizeClass?: string;
  badgeClass?: string;
  onPick?: (file: File) => void;
  uploading?: boolean;
  label?: string;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const inner = (
    <>
      <span className="absolute inset-0 rounded-full overflow-hidden bg-[#1A1A1A] border-2 border-[#2A2A2A] flex items-center justify-center">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <PersonIcon className="w-1/2 h-1/2 text-[#888]" />
        )}
        {uploading && (
          <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <SmallSpinner />
          </span>
        )}
      </span>
      {onPick && !uploading && (
        <span className={`absolute bottom-0 right-0 rounded-full bg-white border-2 border-black text-black font-bold flex items-center justify-center leading-none ${badgeClass}`}>
          +
        </span>
      )}
    </>
  );
  if (!onPick) {
    return <span className={`relative block flex-shrink-0 ${sizeClass}`}>{inner}</span>;
  }
  return (
    <>
      <button
        type="button"
        aria-label={label}
        disabled={uploading}
        onClick={() => input.current?.click()}
        className={`relative block flex-shrink-0 rounded-full hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${sizeClass}`}
      >
        {inner}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,.heic"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPick(f);
        }}
      />
    </>
  );
};

/** A small dismissible error line. */
export const ErrorNote = ({ text, onDismiss }: { text: string; onDismiss?: () => void }) => (
  <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
    <span>{text}</span>
    {onDismiss && (
      <button type="button" onClick={onDismiss} className="text-red-300/80 hover:text-white" aria-label="Dismiss">✕</button>
    )}
  </div>
);
