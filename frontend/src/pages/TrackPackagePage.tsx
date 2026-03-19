import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import StatusBadge from '../components/StatusBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const allSteps = [
  { key: 'created', label: 'Package Created', icon: '📦' },
  { key: 'dropped_off_at_agent', label: 'Dropped Off at Agent', icon: '🏪' },
  { key: 'dispatched', label: 'Dispatched', icon: '🚚' },
  { key: 'arrived_at_destination_agent', label: 'Arrived at Destination', icon: '📍' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🛵' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
];

const shelfSteps = [
  { key: 'created', label: 'Package Created', icon: '📦' },
  { key: 'dropped_off_at_agent', label: 'Dropped Off at Agent', icon: '🏪' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
];

export default function TrackPackagePage() {
  const [query, setQuery] = useState('');
  const [pkg, setPkg] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const track = async () => {
    if (!query.trim()) return;
    setError(''); setPkg(null); setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/packages/track/${encodeURIComponent(query.trim())}`);
      setPkg(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Package not found');
    } finally { setLoading(false); }
  };

  const steps = pkg?.deliveryMethod === 'rent_a_shelf' ? shelfSteps : allSteps;
  const currentStep = pkg ? steps.findIndex((s: any) => s.key === pkg.status) : -1;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-800 to-green-700 text-white py-4 px-6 flex items-center justify-between shadow">
        <Link to="/" className="font-bold text-lg flex items-center gap-2">
          <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm font-black">DD</span>
          DashDelivery
        </Link>
        <Link to="/login" className="text-sm text-green-200 hover:text-white">Sign in →</Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start pt-16 px-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <p className="text-4xl mb-3">📦</p>
            <h1 className="text-2xl font-bold text-gray-900">Track Your Package</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your package ID to see its current status</p>
          </div>

          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && track()}
              placeholder="e.g. PKG-20260318-00001"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white shadow-sm"
            />
            <button
              onClick={track}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Track'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          {pkg && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Package ID</p>
                  <p className="font-mono font-bold text-gray-900 text-lg">{pkg.packageId}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">{pkg.deliveryMethod?.replace(/_/g, ' ')}</p>
                </div>
                <StatusBadge status={pkg.status} />
              </div>

              <div className="p-5">
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />
                  <div className="space-y-0">
                    {steps.map((step: any, i: number) => {
                      const done = i <= currentStep;
                      const current = i === currentStep;
                      const histEntry = pkg.trackingHistory?.find((t: any) => t.status === step.key);
                      return (
                        <div key={step.key} className="relative flex items-start gap-4 pb-5 last:pb-0">
                          <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                            done ? current ? 'bg-green-600 border-green-600 shadow-lg shadow-green-200' : 'bg-green-100 border-green-300' : 'bg-white border-gray-200'
                          }`}>
                            {done ? (current ? step.icon : '✓') : <span className="text-gray-300 text-sm">{i + 1}</span>}
                          </div>
                          <div className="pt-1.5">
                            <p className={`text-sm font-semibold ${done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                            {histEntry
                              ? <p className="text-xs text-gray-400 mt-0.5">{new Date(histEntry.timestamp).toLocaleString()}</p>
                              : <p className="text-xs text-gray-300 mt-0.5">Pending</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
