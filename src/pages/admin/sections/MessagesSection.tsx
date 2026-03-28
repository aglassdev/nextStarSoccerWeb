import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';
import { useAuth } from '../../../contexts/AuthContext';

type MessageTab = 'unread' | 'read' | 'sent';

interface MessageRecord {
  $id: string;
  senderId?: string;
  senderName?: string;
  recipientId?: string;
  subject?: string;
  content?: string;
  body?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt?: string;
  [key: string]: any;
}

const MessagesSection = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<MessageTab>('unread');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, [activeTab, user]);

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      let queries: string[] = [Query.limit(5000)];

      if (activeTab === 'unread') {
        queries = [Query.equal('isRead', false), Query.equal('recipientId', user.$id), Query.limit(5000)];
      } else if (activeTab === 'read') {
        queries = [Query.equal('isRead', true), Query.equal('recipientId', user.$id), Query.limit(5000)];
      } else if (activeTab === 'sent') {
        queries = [Query.equal('senderId', user.$id), Query.limit(5000)];
      }

      const res = await databases.listDocuments(databaseId, collections.messages, queries);
      setMessages(res.documents as unknown as MessageRecord[]);
    } catch (err: any) {
      // If query fails (e.g. missing index), fall back to fetching all and filtering client-side
      try {
        const res = await databases.listDocuments(databaseId, collections.messages, [Query.limit(5000)]);
        const all = res.documents as unknown as MessageRecord[];
        if (activeTab === 'unread') {
          setMessages(all.filter(m => !m.isRead && !m.read && m.recipientId === user.$id));
        } else if (activeTab === 'read') {
          setMessages(all.filter(m => (m.isRead || m.read) && m.recipientId === user.$id));
        } else {
          setMessages(all.filter(m => m.senderId === user.$id));
        }
      } catch (fallbackErr: any) {
        setError('Failed to load messages: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const tabLabel: Record<MessageTab, string> = {
    unread: 'Unread',
    read: 'Read',
    sent: 'Sent',
  };

  const getBody = (m: MessageRecord) => m.content || m.body || '';

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Messages</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {(['unread', 'read', 'sent'] as MessageTab[]).map(tab => (
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
              No {tabLabel[activeTab].toLowerCase()} messages
            </div>
          ) : (
            messages.map(message => (
              <div key={message.$id}>
                <div
                  onClick={() => setExpandedId(expandedId === message.$id ? null : message.$id)}
                  className="px-4 py-4 hover:bg-gray-800/50 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-white font-medium truncate">
                        {message.senderName || message.senderId || 'Unknown'}
                      </p>
                      {!(message.isRead || message.read) && activeTab !== 'sent' && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-gray-400 text-sm truncate mt-0.5">
                      {message.subject || '(No subject)'}
                    </p>
                  </div>
                  <div className="ml-4 text-gray-500 text-xs flex-shrink-0">
                    {message.createdAt ? new Date(message.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>

                {expandedId === message.$id && (
                  <div className="px-4 pb-4 bg-gray-800/30">
                    <div className="pt-3 border-t border-gray-700">
                      <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                        {getBody(message) || '(No message body)'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MessagesSection;
