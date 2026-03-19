import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

interface Notification {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  channels: { inApp: { sent: boolean; readAt?: string } };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await api.get('/notifications?page=1');
      setNotifications(res.data.data || []);
      setUnread(res.data.unreadCount || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async (notifs: Notification[]) => {
    const unreadIds = notifs.filter(n => !n.channels?.inApp?.readAt).map(n => n._id);
    if (unreadIds.length === 0) return;
    try {
      await Promise.all(unreadIds.map(id => api.patch(`/notifications/${id}/read`)));
      setUnread(0);
      setNotifications(prev => prev.map(n => ({
        ...n,
        channels: { ...n.channels, inApp: { ...n.channels.inApp, readAt: new Date().toISOString() } },
      })));
    } catch { /* ignore */ }
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && unread > 0) markAllRead(notifications);
        }}
        className="relative p-1.5 rounded-full hover:bg-green-800 transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-700 text-sm">Notifications</span>
            <div className="flex items-center gap-3">
              {unread > 0 && <span className="text-xs text-gray-400">{unread} unread</span>}
              <a href="/notifications" className="text-xs text-green-600 hover:text-green-700 font-medium">See all</a>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No notifications</div>
            ) : (
              notifications.slice(0, 10).map(n => {
                const isRead = !!n.channels?.inApp?.readAt;
                return (
                  <div
                    key={n._id}
                    onClick={() => !isRead && markRead(n._id)}
                    className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!isRead ? 'bg-green-50' : ''}`}
                  >
                    <p className={`text-sm font-medium ${!isRead ? 'text-gray-800' : 'text-gray-500'}`}>{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-300 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
