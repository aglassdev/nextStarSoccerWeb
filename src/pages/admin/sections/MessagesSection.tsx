import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

type MessageTab = 'unread' | 'read' | 'all';

interface InquiryRecord {
  $id: string;
  $createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const MessagesSection = () => {
  const [messages, setMessages] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<MessageTab>('unread');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, [activeTab]);

  const fetchMessages = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.websiteInquiries, [
        Query.orderDesc('$createdAt'),
        Query.limit(5000),
      ]);
      let docs = res.documents as unknown as InquiryRecord[];

      if (activeTab === 'unread') {
        docs = docs.filter(d => d.read === false);
      } else if (activeTab === 'read') {
        docs = docs.filter(d => d.read === true);
      }

      setMessages(docs);
    } catch (err: any) {
      setError('Failed to load inquiries: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await databases.updateDocument(databaseId, collections.websiteInquiries, id, { read: true });
      setMessages(prev => prev.map(m => m.$id === id ? { ...m, read: true } : m));
    } catch { /* ignore */ }
  };

  const buildGmailUrl = (msg: InquiryRecord) => {
    const name = `${msg.firstName} ${msg.lastName}`.trim();
    const subject = `Re: ${msg.subject || 'Your Inquiry'}`;
    const body = `\n\n\n────────────────────\nOriginal message from ${name} (${msg.email}):\nSubject: ${msg.subject || '—'}\n\n${msg.message || ''}`;
    return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(msg.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const tabLabel: Record<MessageTab, string> = {
    unread: 'Unread',
    read: 'Read',
    all: 'All',
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Website Inquiries</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {(['unread', 'read', 'all'] as MessageTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setExpandedId(null);
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tabLabel[tab]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 divide-y divide-gray-800">
          {messages.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No {tabLabel[activeTab].toLowerCase()} inquiries
            </div>
          ) : (
            messages.map(msg => {
              const name = `${msg.firstName} ${msg.lastName}`.trim() || 'Unknown';
              const isExpanded = expandedId === msg.$id;

              return (
                <div key={msg.$id}>
                  <div
                    onClick={() => {
                      setExpandedId(isExpanded ? null : msg.$id);
                      if (!msg.read) markAsRead(msg.$id);
                    }}
                    className="px-4 py-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    {/* Top row: name, email, date */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-400 text-xs font-semibold">
                            {(msg.firstName[0] || '?').toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium truncate ${!msg.read ? 'text-white' : 'text-gray-400'}`}>
                              {name}
                            </span>
                            {!msg.read && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-gray-600 text-xs truncate">{msg.email}</p>
                        </div>
                      </div>
                      <div className="text-gray-600 text-xs flex-shrink-0">
                        {new Date(msg.$createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </div>
                    </div>

                    {/* Subject + preview */}
                    <div className="mt-2 pl-11">
                      <p className={`text-sm truncate ${!msg.read ? 'text-gray-300' : 'text-gray-500'}`}>
                        {msg.subject || '(No subject)'}
                      </p>
                      <p className="text-gray-600 text-xs mt-0.5 truncate">{msg.message || ''}</p>
                    </div>
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-800/20">
                      <div className="pt-3 pl-11 border-t border-gray-800">
                        {/* Detail fields */}
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
                          <div>
                            <span className="text-gray-600 text-xs">First Name</span>
                            <p className="text-gray-300 text-sm">{msg.firstName || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">Last Name</span>
                            <p className="text-gray-300 text-sm">{msg.lastName || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">Email</span>
                            <p className="text-blue-400 text-sm">{msg.email || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">Received</span>
                            <p className="text-gray-300 text-sm">
                              {new Date(msg.$createdAt).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: 'numeric', minute: '2-digit', hour12: true,
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Full message */}
                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-4">
                          {msg.message || '(No message body)'}
                        </p>

                        {/* Reply button */}
                        <a
                          href={buildGmailUrl(msg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10l9 6 9-6M21 10v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8" />
                          </svg>
                          Reply in Gmail
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MessagesSection;
