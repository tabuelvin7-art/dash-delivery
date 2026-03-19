import { useEffect, useState } from 'react';
import api from '../services/api';

const typeIcon: Record<string, string> = {
  package_status: '📦',
  payment_prompt: '💳',
  payment_received: '✅',
  release_code: '🔑',
  shelf_rental: '🗄️',
  system: '🔔',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?page=${p}`);
      setNotifications(res.data.data || []);
      setUnread(res.data.unreadCount || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(page); }, [page]);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, channels: { ...n.channels, inApp: { ...n.channels.inApp, readAt: new Date().toISOString() } } } : n));
      setUnread(u => Math.max(0, u - 1));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    const unreadItems = notifications.filter(n => !n.channels?.inApp?.readAt);
    await Promise.all(unreadItems.map(n => api.patch(`/notifications/${n._id}/read`).catch(() => {})));
    load(page);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unread > 0 && <p className="text-sm text-gray-500 mt-0.5">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-green-600 hover:text-green-700 font-medium">
            Mark all read
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-gray-400 text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map(n => {
              const isRead = !!n.channels?.inApp?.readAt;
              return (
                <div
                  key={n._id}
                  onClick={() => !isRead && markRead(n._id)}
                  className={`flex gap-4 px-6 py-4 transition-colors ${!isRead ? 'bg-green-50 cursor-pointer hover:bg-green-100/50' : 'hover:bg-gray-50/50'}`}
                >
                  <div className="text-2xl flex-shrink-0 mt-0.5">{typeIcon[n.type] || '🔔'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${!isRead ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                      {!isRead && <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-1.5" />}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-300 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-3.5 border-t border-gray-100 flex items-center justify-between text-sm">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              ← Prev
            </button>
            <span className="text-gray-400 text-xs">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
