// The month calendar at the top of the app's My Sessions screen: a white dot
// under each day with a session (up to three), no other decoration.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const SessionsCalendar = ({
  month,
  onChangeMonth,
  sessionsByDay,
}: {
  month: Date;
  onChangeMonth: (d: Date) => void;
  sessionsByDay: Map<string, number>;
}) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const startOffset = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startOffset + 1;
    return { date: new Date(year, monthIndex, dayNum), inMonth: dayNum >= 1 && dayNum <= daysInMonth };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2 lg:mb-4">
        <p className="text-white text-base lg:text-lg font-medium">
          {MONTHS[monthIndex]} {year}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeMonth(new Date(year, monthIndex - 1, 1))}
            aria-label="Previous month"
            className="w-9 h-9 -my-2 flex items-center justify-center rounded-full text-white text-lg lg:text-xl hover:bg-white/10 transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(new Date(year, monthIndex + 1, 1))}
            aria-label="Next month"
            className="w-9 h-9 -my-2 flex items-center justify-center rounded-full text-white text-lg lg:text-xl hover:bg-white/10 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d) => (
          <p key={d} className="text-center text-[#666] text-[11px] lg:text-xs font-medium">
            {d}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const count = cell.inMonth ? sessionsByDay.get(keyOf(cell.date)) || 0 : 0;
          return (
            <div key={i} className="h-9 lg:h-12 flex flex-col items-center justify-center">
              <span className={`text-[13px] lg:text-[15px] leading-none ${cell.inMonth ? 'text-white' : 'text-[#444]'}`}>
                {cell.date.getDate()}
              </span>
              <span className="flex gap-[3px] mt-[3px] h-1" aria-hidden>
                {Array.from({ length: Math.min(count, 3) }, (_, d) => (
                  <span key={d} className="w-1 h-1 rounded-full bg-white" />
                ))}
              </span>
              {count > 0 && <span className="sr-only">{count} session{count === 1 ? '' : 's'}</span>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end mt-1">
        <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5" />
        <span className="text-[#888] text-xs font-medium">Sessions</span>
      </div>
    </div>
  );
};

export default SessionsCalendar;
