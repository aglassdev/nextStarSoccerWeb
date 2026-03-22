import { useState, useEffect, useRef } from "react";
import Navigation from "../components/layout/Navigation";
import LoadingScreen from "../components/common/LoadingScreen";
import {
  googleCalendarService,
  CalendarEvent,
  isEventCancelled,
} from "../services/googleCalendar";

const BUTTON_WIDTH = 140;

interface FilterOption {
  id: string;
  label: string;
  color: string;
  selected: boolean;
}

const CalendarPage = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todaysEvents, setTodaysEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthChanging, setMonthChanging] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterVisible, setFilterVisible] = useState(false);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([
    { id: "evening-training", label: "Evening Group Training", color: "#E50101", selected: true },
    { id: "morning-training", label: "Morning Group Training", color: "#FF8A14", selected: true },
    { id: "next-star-x-nike-evening", label: "Next Star x Nike Evening", color: "#06B6D4", selected: true },
    { id: "youth-group-camp", label: "Camp, Youth Group", color: "#008806", selected: true },
    { id: "college-pro-group-camp", label: "Camp, College/Pro", color: "#9FDC59", selected: true },
    { id: "camp-morning", label: "Camp Morning Session", color: "#1976D2", selected: true },
    { id: "camp-afternoon", label: "Camp Afternoon Session", color: "#29B6F6", selected: true },
    { id: "clinic", label: "Clinic", color: "#FF00FF", selected: true },
    { id: "showcase", label: "Showcase", color: "#800080", selected: true },
    { id: "other", label: "Other Events", color: "#D3D3D3", selected: true },
  ]);

  const monthScrollRef = useRef<HTMLDivElement>(null);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const generateMonthsArray = () => {
    const monthsArray = [];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    for (let i = 0; i < 12; i++) {
      const monthIndex = (currentMonth + i) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      const shouldShowYear = year > currentYear;

      monthsArray.push({
        month: monthIndex,
        year: year,
        display: months[monthIndex],
        yearDisplay: shouldShowYear ? year.toString() : null,
      });
    }
    return monthsArray;
  };

  const monthsArray = generateMonthsArray();

  const fetchEvents = async (isInitialLoad = false, month?: number, year?: number) => {
    try {
      if (!isInitialLoad) {
        setMonthChanging(true);
      }

      const targetMonth = month !== undefined ? month : selectedMonth;
      const targetYear = year !== undefined ? year : selectedYear;

      console.log(`Fetching events for ${months[targetMonth]} ${targetYear}`);

      const monthEvents = await googleCalendarService.getEventsForMonth(
        targetYear,
        targetMonth,
        "public"
      );

      console.log(`Received ${monthEvents.length} events`);
      setEvents(monthEvents);

      const todayEvents = await googleCalendarService.getTodaysEvents();
      setTodaysEvents(todayEvents);

      if (isInitialLoad) {
        setLoading(false);
      } else {
        setMonthChanging(false);
      }
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      setLoading(false);
      setMonthChanging(false);
    }
  };

  useEffect(() => {
    fetchEvents(true);
  }, []);

  useEffect(() => {
    const filtered = events.filter((event) => {
      const eventType = getEventTypeFromTitle(event.title);
      const filterOption = filterOptions.find((option) => option.id === eventType);
      return filterOption
        ? filterOption.selected
        : filterOptions.find((option) => option.id === "other")?.selected || false;
    });
    setFilteredEvents(filtered);
  }, [events, filterOptions]);

  const getEventTypeFromTitle = (title: string): string => {
    if (!title || typeof title !== "string") return "other";
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("morning group training")) return "morning-training";
    if (lowerTitle.includes("next star x nike evening")) return "next-star-x-nike-evening";
    if (lowerTitle.includes("evening group training")) return "evening-training";
    if (lowerTitle.includes("youth group")) return "youth-group-camp";
    if (lowerTitle.includes("college/pro group")) return "college-pro-group-camp";
    if (lowerTitle.includes("camp morning")) return "camp-morning";
    if (lowerTitle.includes("camp afternoon")) return "camp-afternoon";
    if (lowerTitle.includes("clinic")) return "clinic";
    if (lowerTitle.includes("showcase")) return "showcase";
    return "other";
  };

  const getEventColor = (title: string) => {
    if (!title || typeof title !== "string") return "#D3D3D3";
    const eventType = getEventTypeFromTitle(title);
    const filterOption = filterOptions.find((option) => option.id === eventType);
    return filterOption?.color || "#D3D3D3";
  };

  const getLocationName = (location: string): string => {
    if (!location) return '';
    // Extract just the name before the first comma
    const parts = location.split(',');
    return parts[0].trim();
  };

  const formatEventDate = (dateTimeString: string): string => {
    const date = new Date(dateTimeString);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const handleMonthChange = (monthIndex: number, year: number, arrayIndex: number) => {
    if (currentMonthIndex === arrayIndex) return;

    setSelectedMonth(monthIndex);
    setSelectedYear(year);
    setCurrentMonthIndex(arrayIndex);
    fetchEvents(false, monthIndex, year);

    if (monthScrollRef.current) {
      const scrollLeft = arrayIndex * BUTTON_WIDTH - (monthScrollRef.current.offsetWidth / 2) + (BUTTON_WIDTH / 2);
      monthScrollRef.current.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  };

  const toggleFilter = (filterId: string) => {
    setFilterOptions((prev) =>
      prev.map((option) =>
        option.id === filterId ? { ...option, selected: !option.selected } : option
      )
    );
  };

  const resetFilters = () => {
    setFilterOptions((prev) => prev.map((option) => ({ ...option, selected: true })));
  };

  // Generate calendar grid
  const generateCalendarDays = () => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];

    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const getEventsForDay = (day: number): CalendarEvent[] => {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEvents.filter((event) => {
      const eventDate = event.startDateTime.split('T')[0];
      return eventDate === dateStr;
    });
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      day === today.getDate() &&
      selectedMonth === today.getMonth() &&
      selectedYear === today.getFullYear()
    );
  };

  if (loading) {
    return (
      <div className="h-screen bg-black overflow-hidden">
        <Navigation />
        <LoadingScreen />
      </div>
    );
  }

  const calendarDays = generateCalendarDays();
  const today = new Date();

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <div className="pt-20 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 mt-8">
            <h1 className="text-white text-3xl font-bold">Calendar</h1>
          </div>

          {/* Today's Events Card */}
          {todaysEvents.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Today's Events</h2>
                <div className="text-white text-sm opacity-90">
                  {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto">
                {todaysEvents.map((event) => {
                  const { time } = googleCalendarService.formatEventDateTime(
                    event.startDateTime,
                    event.endDateTime,
                    event.dateOnly || false
                  );
                  const isCancelled = isEventCancelled(event);
                  const eventColor = getEventColor(event.title);

                  return (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="flex-1 min-w-[280px] bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className="w-1 h-16 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: isCancelled ? '#DC2626' : eventColor }}
                          />
                          <div className="flex-1">
                            <h3 className="text-white font-bold text-base">{event.title}</h3>
                            <p className="text-white/80 text-sm mt-1">{time}</p>
                            {event.location && (
                              <p className="text-white/70 text-sm mt-1">{getLocationName(event.location)}</p>
                            )}
                          </div>
                        </div>
                        {isCancelled && (
                          <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                            CANCELLED
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Month Navigation */}
          <div className="bg-gray-900 rounded-lg p-2 mb-6 overflow-hidden">
            <div
              ref={monthScrollRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth relative"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Sliding white background box */}
              <div
                className="absolute top-0 bg-white rounded-lg transition-all duration-300 ease-in-out"
                style={{
                  width: `${BUTTON_WIDTH}px`,
                  height: 'calc(100% - 0px)',
                  transform: `translateX(${currentMonthIndex * (BUTTON_WIDTH + 8)}px)`,
                  zIndex: 0
                }}
              />
              {monthsArray.map((monthData, index) => {
                const isSelected = index === currentMonthIndex;

                return (
                  <button
                    key={`${monthData.month}-${monthData.year}-${index}`}
                    className={`flex-shrink-0 px-6 py-3 rounded-lg transition-all duration-200 relative z-10 ${
                      isSelected
                        ? "text-black font-bold"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                    style={{ minWidth: `${BUTTON_WIDTH}px` }}
                    onClick={() => !monthChanging && handleMonthChange(monthData.month, monthData.year, index)}
                    disabled={monthChanging}
                  >
                    <div className="text-center">
                      <div className="text-base">{monthData.display}</div>
                      {monthData.yearDisplay && (
                        <div className="text-xs opacity-75 mt-0.5">{monthData.yearDisplay}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Button */}
          <div className="flex items-center justify-start mb-6">
            <button
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
              onClick={() => setFilterVisible(true)}
            >
              <span className="text-base font-medium">Filter</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 3h14M3 8h10M5 13h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-700">
              {daysOfWeek.map((day) => (
                <div
                  key={day}
                  className="text-center py-3 text-gray-400 text-sm font-medium"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[120px] border-r border-b border-gray-800 bg-gray-950"
                    />
                  );
                }

                const dayEvents = getEventsForDay(day);
                const isTodayDate = isToday(day);
                
                // For today's date, combine regular day events with today's events
                const displayEvents = isTodayDate && todaysEvents.length > 0
                  ? todaysEvents
                  : dayEvents;

                return (
                  <div
                    key={day}
                    className={`min-h-[120px] border-r border-b border-gray-800 p-2 ${
                      isTodayDate ? 'bg-gray-800' : 'bg-gray-900'
                    }`}
                  >
                    <div
                      className={`text-sm font-medium mb-2 ${
                        isTodayDate
                          ? 'text-white bg-blue-600 rounded-full w-7 h-7 flex items-center justify-center'
                          : 'text-gray-400'
                      }`}
                    >
                      {day}
                    </div>

                    <div className="space-y-1">
                      {displayEvents.map((event) => {
                        const isCancelled = isEventCancelled(event);
                        const eventColor = getEventColor(event.title);
                        const { time } = googleCalendarService.formatEventDateTime(
                          event.startDateTime,
                          event.endDateTime,
                          event.dateOnly || false
                        );

                        return (
                          <button
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            className={`text-xs px-2 py-1 rounded flex items-start gap-1.5 w-full text-left hover:bg-gray-800 transition-colors ${
                              isCancelled ? 'opacity-50' : ''
                            }`}
                            title={`${event.title} - ${time}`}
                          >
                            <div 
                              className="w-1 h-4 rounded-full flex-shrink-0 mt-0.5"
                              style={{ backgroundColor: isCancelled ? '#DC2626' : eventColor }}
                            />
                            <span className={`text-white flex-1 line-clamp-2 ${isCancelled ? 'line-through' : ''}`}>
                              {event.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {monthChanging && (
            <div className="mt-8">
              <LoadingScreen message="Loading events..." />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Next Star Soccer. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-0 flex-1">
                  {/* Color marker along entire left side */}
                  <div
                    className="w-1 self-stretch rounded-l-lg flex-shrink-0 -ml-6 -my-6 mr-6"
                    style={{ backgroundColor: getEventColor(selectedEvent.title) }}
                  />
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedEvent.title}</h2>
                    {isEventCancelled(selectedEvent) && (
                      <span className="inline-block bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
                        CANCELLED
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-white transition-colors ml-4"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="flex gap-6">
                {/* Left side - Details */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">Date</h3>
                    <p className="text-white">
                      {formatEventDate(selectedEvent.startDateTime)}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">Time</h3>
                    <p className="text-white">
                      {googleCalendarService.formatEventDateTime(
                        selectedEvent.startDateTime,
                        selectedEvent.endDateTime,
                        selectedEvent.dateOnly || false
                      ).time}
                    </p>
                  </div>

                  {selectedEvent.location && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-1">Location</h3>
                      <p className="text-white">{getLocationName(selectedEvent.location)}</p>
                    </div>
                  )}

                  {selectedEvent.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-1">Description</h3>
                      <p className="text-white whitespace-pre-wrap">{selectedEvent.description}</p>
                    </div>
                  )}
                </div>

                {/* Right side - Square Map */}
                {selectedEvent.location && (
                  <div className="w-80 h-80 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      style={{ border: 0 }}
                      src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(selectedEvent.location)}&maptype=satellite`}
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {filterVisible && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-start p-4"
          onClick={() => setFilterVisible(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl mt-20 ml-4 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Filter Events</h3>
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => toggleFilter(option.id)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                    <span className="text-sm text-gray-900">{option.label}</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      option.selected
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300"
                    }`}
                  >
                    {option.selected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                        <path d="M2 6 L5 9 L10 3" stroke="white" strokeWidth="2" fill="none" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                onClick={resetFilters}
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
