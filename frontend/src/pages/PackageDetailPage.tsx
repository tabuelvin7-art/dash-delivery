import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';

const allSteps = [
  { key: 'created', label: 'Package Created', icon: '📦' },
  { key: 'dropped_off_at_agent', label: 'Dropped Off at Agent', icon: '🏪' },
  { key: 'dispatched', label: 'Dispatched', icon: '🚚' },
  { key: 'arrived_at_destination_agent', label: 'Arrived at Destination', icon: '📍' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🛵' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
];

const doorstepSteps = [
  { key: 'created', label: 'Package Created', icon: '📦' },
  { key: 'dropped_off_at_agent', label: 'Dropped Off at Agent', icon: '🏪' },
  { key: 'dispatched', label: 'Dispatched', icon: '🚚' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🛵' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
];

const shelfSteps = [
  { key: 'created', label: 'Package Created', icon: '📦' },
  { key: 'dropped_off_at_agent', label: 'Dropped Off at Agent', icon: '🏪' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
];

export default function PackageDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [pkg, setPkg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');

  useEffect(() => {
    api.get(`/packages/${id}`)
      .then(r => setPkg(r.data.data))
      .catch(() => setError('Package not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const cancelPackage = async () => {
    if (!confirm('Cancel this package?')) return;
    setCancelling(true);
    try {
      const res = await api.patch(`/packages/${pkg.packageId}/cancel`);
      setPkg(res.data.data);
      setCancelMsg('Package cancelled.');
    } catch (e: any) {
      setCancelMsg(e.response?.data?.error?.message || 'Failed to cancel');
    } finally { setCancelling(false); }
  };

  if (loading) return <Spinner />;
  if (error || !pkg) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-gray-500">{error || 'Package not found'}</p>
      <Link to="/packages" className="mt-4 inline-block text-sm text-green-600 hover:underline">← Back to packages</Link>
    </div>
  );

  const steps = pkg.deliveryMethod === 'rent_a_shelf'
    ? shelfSteps
    : pkg.deliveryMethod === 'doorstep_delivery'
    ? doorstepSteps
    : allSteps;
  const currentStep = steps.findIndex(s => s.key === pkg.status);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Package ID</p>
            <h1 className="text-2xl font-bold font-mono text-gray-900">{pkg.packageId}</h1>
            <p className="text-sm text-gray-500 mt-1 capitalize">{pkg.deliveryMethod?.replace(/_/g, ' ')}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={pkg.status} />
            {user?.role === 'business_owner' && pkg.status === 'created' && (
              <button onClick={cancelPackage} disabled={cancelling}
                className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Cancel Package'}
              </button>
            )}
          </div>
        </div>
        {cancelMsg && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{cancelMsg}</div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Item Price', value: `KES ${pkg.itemPrice?.toLocaleString()}` },
            { label: 'Delivery Fee', value: `KES ${pkg.deliveryFee?.toLocaleString()}` },
            { label: 'Delivery Payment', value: <StatusBadge status={pkg.deliveryFeePaymentStatus} /> },
            { label: 'Item Payment', value: <StatusBadge status={pkg.itemPricePaymentStatus} /> },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <div className="font-semibold text-gray-800 text-sm">{value}</div>
            </div>
          ))}
        </div>

        {pkg.deliveryAddress && (
          <div className="mt-4 bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Delivery Address</p>
            <p className="text-sm font-medium text-gray-800">{pkg.deliveryAddress}</p>
          </div>
        )}

        {pkg.releaseCode && (
          <div className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Release Code</p>
            <p className="text-4xl font-black tracking-[0.3em]">{pkg.releaseCode}</p>
            <p className="text-xs opacity-70 mt-1">Show this code to the agent to collect your package</p>
          </div>
        )}
      </div>

      {/* Tracking timeline */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-6">Tracking Timeline</h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />
          <div className="space-y-0">
            {steps.map((step, i) => {
              const done = i <= currentStep;
              const current = i === currentStep;
              const histEntry = pkg.trackingHistory?.find((t: any) => t.status === step.key);
              return (
                <div key={step.key} className="relative flex items-start gap-4 pb-6 last:pb-0">
                  {/* Circle */}
                  <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                    done
                      ? current
                        ? 'bg-green-600 border-green-600 shadow-lg shadow-green-200'
                        : 'bg-green-100 border-green-300'
                      : 'bg-white border-gray-200'
                  }`}>
                    {done ? (current ? step.icon : '✓') : <span className="text-gray-300 text-sm">{i + 1}</span>}
                  </div>
                  {/* Content */}
                  <div className="pt-1.5 flex-1">
                    <p className={`text-sm font-semibold ${done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                    {histEntry ? (
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(histEntry.timestamp).toLocaleString()}</p>
                    ) : (
                      <p className="text-xs text-gray-300 mt-0.5">Pending</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Link to="/packages" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← Back to packages
      </Link>
    </div>
  );
}
