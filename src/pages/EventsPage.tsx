import { useState } from 'react';

const EventsPage = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const upcomingEvents = [
    {
      id: 1,
      title: 'Team Training Session',
      date: '2026-01-28',
      time: '3:00 PM - 5:00 PM',
      location: 'Main Field, Soccer Complex',
      signedUp: true,
      capacity: 20,
      enrolled: 15,
    },
    {
      id: 2,
      title: 'Individual Skills Training',
      date: '2026-01-30',
      time: '4:00 PM - 5:00 PM',
      location: 'Training Facility A',
      signedUp: false,
      capacity: 10,
      enrolled: 8,
    },
    {
      id: 3,
      title: 'Small Group Session',
      date: '2026-02-02',
      time: '2:00 PM - 3:30 PM',
      location: 'Field 2',
      signedUp: true,
      capacity: 8,
      enrolled: 6,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Events</h1>
          <p className="text-gray-400 mt-1">Manage your soccer training sessions</p>
        </div>
        <button className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors">
          + Create Event
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'upcoming'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'past'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Past Events
        </button>
      </div>

      {/* Events List */}
      {activeTab === 'upcoming' ? (
        <div className="grid gap-4">
          {upcomingEvents.map((event) => (
            <div
              key={event.id}
              className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* Event Info */}
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
                      {new Date(event.date).getDate()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-400">
                          📅 {new Date(event.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                        <p className="text-sm text-gray-400">🕐 {event.time}</p>
                        <p className="text-sm text-gray-400">📍 {event.location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions & Status */}
                <div className="flex flex-col items-end gap-3">
                  {event.signedUp ? (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full">
                        ✓ Signed Up
                      </span>
                      <button className="text-red-400 hover:text-red-300 text-sm font-medium">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors">
                      Sign Up
                    </button>
                  )}
                  <div className="text-sm text-gray-400">
                    {event.enrolled} / {event.capacity} enrolled
                  </div>
                  <div className="w-32 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(event.enrolled / event.capacity) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400">No past events to display</p>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
