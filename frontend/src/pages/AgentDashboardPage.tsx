import { useEffect, useState } from 'react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import { SuccessAlert, ErrorAlert } from '../components/Alert';

const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string }> = {
  created:                      { label: 'Confirm Drop-off',    next: 'dropped_off_at_agent',         color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  dropped_off_at_agent:         { label: 'Dispatch',            next: 'dispatched',                   color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  dispatched:                   { label: 'Mark Arrived',        next: 'arrived_at_destination_agent', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
  arrived_at_destination_agent: { label: 'Out for Delivery',    next: 'out_for_delivery',             color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  out_for_delivery:             { label: 'Mark Delivered',      next: 'delivered',                    color: 'bg-green-100 text-green-700 hover:bg-green-200' },
};

// doorstep skips arrived_at_destination_agent — dispatched goes straight to out_for_delivery
const DOORSTEP_ACTIONS: Record<string, { label: string; next: string; color: string }> = {
  created:             { label: 'Confirm Drop-off', next: 'dropped_off_at_agent', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  dropped_off_at_agent:{ label: 'Dispatch',         next: 'dispatched',           color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  dispatched:          { label: 'Out for Delivery', next: 'out_for_delivery',     color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  out_for_delivery:    { label: 'Mark Delivered',   next: 'delivered',            color: 'bg-green-100 text-green-700 hover:bg-green-200' },
};

// Statuses that can be returned to sender (not applicable to rent_a_shelf)
const RETURNABLE = ['dispatched', 'arrived_at_destination_agent', 'out_for_delivery'];export default function AgentDashboardPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [agentInfo, setAgentInfo] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState<string | null>(null);
  const [releaseCodeInput, setReleaseCodeInput] = useState('');

  const loadPackages = () =>
    api.get('/packages').then(r => setPackages(r.data.data || [])).catch(() => {});

  useEffect(() => {
    Promise.all([
      api.get('/agents/my-profile').catch(() => null),
      api.get('/packages').catch(() => null),
      api.get('/shelves/my-earnings').catch(() => null),
    ]).then(([agentRes, pkgRes, earningsRes]) => {
      if (agentRes) setAgentInfo(agentRes.data.data);
      else setProfileError('Agent profile not linked to this account. Contact admin.');
      if (pkgRes) setPackages(pkgRes.data.data || []);
      if (earningsRes) setEarnings(earningsRes.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const updateStatus = async (packageId: string, status: string) => {
    if (!agentInfo?.agentId) { setError('Agent profile not found'); return; }
    setError(''); setMessage('');
    try {
      await api.patch(`/packages/${packageId}/status`, { status, agentId: agentInfo.agentId });
      setMessage(`Status updated to: ${status.replace(/_/g, ' ')}`);
      loadPackages();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Update failed');
    }
  };

  const validateCode = async (packageId: string) => {
    if (!releaseCodeInput.trim()) { setError('Enter the release code'); return; }
    setError(''); setMessage('');
    try {
      await api.post('/agents/validate-code', { packageId, releaseCode: releaseCodeInput.trim(), agentId: agentInfo.agentId });
      setMessage('Package released successfully!');
      setValidating(null);
      setReleaseCodeInput('');
      loadPackages();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Invalid release code');
    }
  };

  if (loading) return <Spinner />;

  const active = packages.filter(p => p.status !== 'delivered' && p.status !== 'returned' && p.status !== 'cancelled');
  const delivered = packages.filter(p => p.status === 'delivered');
  const returned = packages.filter(p => p.status === 'returned');

  // Daily summary — packages updated today
  const today = new Date().toDateString();
  const todayIn = packages.filter(p => p.trackingHistory?.some((t: any) => t.status === 'dropped_off_at_agent' && new Date(t.timestamp).toDateString() === today)).length;
  const todayOut = packages.filter(p => p.trackingHistory?.some((t: any) => t.status === 'delivered' && new Date(t.timestamp).toDateString() === today)).length;

  const returnToSender = async (packageId: string) => {
    if (!agentInfo?.agentId) { setError('Agent profile not found'); return; }
    if (!confirm('Mark this package as returned to sender?')) return;
    setError(''); setMessage('');
    try {
      await api.patch(`/packages/${packageId}/status`, { status: 'returned', agentId: agentInfo.agentId });
      setMessage('Package marked as returned to sender');
      loadPackages();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to update');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {agentInfo && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-100 text-xs font-medium uppercase tracking-wide mb-1">Agent Location</p>
              <h1 className="text-xl font-bold">{agentInfo.locationName}</h1>
              <p className="text-green-100 text-sm mt-1">{agentInfo.neighborhood} · {agentInfo.address}</p>
              <p className="font-mono text-green-200 text-xs mt-2 bg-green-700/40 inline-block px-2 py-1 rounded">{agentInfo.agentId}</p>
            </div>
            <div className="text-right">
              <div className="bg-white/10 rounded-xl p-3 space-y-1">
                <p className="text-green-100 text-xs">Shelves Available</p>
                <p className="text-2xl font-bold">{agentInfo.capacity?.availableShelves}<span className="text-sm text-green-200">/{agentInfo.capacity?.totalShelves}</span></p>
                <p className="text-green-200 text-xs">{agentInfo.operatingHours?.open} – {agentInfo.operatingHours?.close}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {profileError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm p-4 rounded-xl">{profileError}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{active.length}</p>
          <p className="text-xs text-gray-400 mt-1">packages in progress</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Delivered</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{delivered.length}</p>
          <p className="text-xs text-gray-400 mt-1">completed deliveries</p>
        </div>
      </div>

      {/* Daily summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Today's Summary</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">{todayIn}</p>
            <p className="text-xs text-gray-500 mt-0.5">Received today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{todayOut}</p>
            <p className="text-xs text-gray-500 mt-0.5">Delivered today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500">{returned.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Returned</p>
          </div>
        </div>
      </div>

      {/* Shelf Rental Earnings */}
      {earnings && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Shelf Rental Earnings</h2>
            <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2.5 py-1 rounded-full">{earnings.activeRentals} active</span>
          </div>
          <div className="p-5">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Billed</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">KES {earnings.totalEarned?.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">from all rentals</p>
          </div>
          {earnings.rentals?.length > 0 && (
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    {['Rental ID', 'Shelf', 'Period', 'Amount', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {earnings.rentals.map((r: any) => (
                    <tr key={r._id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-mono text-xs text-gray-600">{r.rentalId}</td>
                      <td className="px-5 py-3 text-gray-700">{r.shelfNumber}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {new Date(r.rentalPeriod?.startDate).toLocaleDateString()} – {new Date(r.rentalPeriod?.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-800">KES {r.pricing?.totalAmount?.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          r.status === 'active' ? 'bg-green-100 text-green-700' :
                          r.status === 'expired' ? 'bg-gray-100 text-gray-500' :
                          'bg-red-100 text-red-600'
                        }`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {earnings.rentals?.length === 0 && (
            <div className="px-6 py-10 text-center text-gray-400 text-sm">No shelf rentals yet</div>
          )}
        </div>
      )}

      {message && <SuccessAlert message={message} />}
      {error && <ErrorAlert message={error} />}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Active Packages</h2>
          <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-400 text-sm">No active packages at your location</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                  {['Package ID', 'Method', 'Status', 'Release Code', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map((pkg: any, i: number) => {
                  const isShelf = pkg.deliveryMethod === 'rent_a_shelf';
                  const isValidating = validating === pkg.packageId;

                  // Determine the next-step button
                  let action: { label: string; next: string; color: string } | null = null;
                  if (isShelf) {
                    if (pkg.status === 'created') action = { label: 'Confirm Arrival', next: 'dropped_off_at_agent', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' };
                  } else if (pkg.deliveryMethod === 'doorstep_delivery') {
                    action = DOORSTEP_ACTIONS[pkg.status] || null;
                  } else {
                    action = STATUS_ACTIONS[pkg.status] || null;
                  }

                  // Show validate-code input when package is ready for customer collection:
                  // - rent_a_shelf: at dropped_off_at_agent (customer collects from shelf)
                  // - agent_delivery: at arrived_at_destination_agent (customer collects from agent)
                  // - doorstep_delivery: never (agent delivers to address, no code needed)
                  const showValidate = isShelf
                    ? pkg.status === 'dropped_off_at_agent'
                    : pkg.deliveryMethod === 'agent_delivery' && pkg.status === 'arrived_at_destination_agent';

                  // For agent_delivery at arrived_at_destination_agent, hide the action button —
                  // the release code validation is the only way to proceed to delivered
                  if (showValidate && !isShelf) action = null;

                  return (
                    <tr key={pkg._id} className={`border-t border-gray-50 hover:bg-green-50/30 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-gray-700">{pkg.packageId}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pkg.deliveryMethod === 'rent_a_shelf' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {pkg.deliveryMethod === 'rent_a_shelf' ? '🗄 Shelf' : pkg.deliveryMethod === 'doorstep_delivery' ? '🚚 Doorstep' : '🏪 Agent'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={pkg.status} /></td>
                      <td className="px-5 py-3.5">
                        {pkg.releaseCode
                          ? <span className="font-mono font-bold text-green-700 tracking-widest bg-green-50 px-2 py-1 rounded">{pkg.releaseCode}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-2">
                          {action && (
                            <button
                              onClick={() => updateStatus(pkg.packageId, action!.next)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${action.color}`}
                            >
                              {action.label}
                            </button>
                          )}
                          {RETURNABLE.includes(pkg.status) && !isShelf && (
                            <button
                              onClick={() => returnToSender(pkg.packageId)}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                              Return
                            </button>
                          )}
                          {showValidate && (
                            isValidating ? (
                              <div className="flex gap-1.5 items-center">
                                <input
                                  value={releaseCodeInput}
                                  onChange={e => setReleaseCodeInput(e.target.value)}
                                  placeholder="Enter code"
                                  className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-green-500"
                                  autoFocus
                                  onKeyDown={e => e.key === 'Enter' && validateCode(pkg.packageId)}
                                />
                                <button onClick={() => validateCode(pkg.packageId)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg transition-colors">OK</button>
                                <button onClick={() => { setValidating(null); setReleaseCodeInput(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setValidating(pkg.packageId); setReleaseCodeInput(''); }}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                              >
                                Validate Code
                              </button>
                            )
                          )}
                          {!action && !showValidate && (
                            <span className="text-xs text-gray-300 italic">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {delivered.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Delivered</h2>
            <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full">{delivered.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                  {['Package ID', 'Status', 'Delivered At'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {delivered.map((pkg: any, i: number) => (
                  <tr key={pkg._id} className={`border-t border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-gray-700">{pkg.packageId}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={pkg.status} /></td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {pkg.deliveredAt ? new Date(pkg.deliveredAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {returned.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Returned to Sender</h2>
            <span className="text-xs bg-red-100 text-red-600 font-medium px-2.5 py-1 rounded-full">{returned.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50 text-gray-500 text-xs uppercase tracking-wide border-b border-red-100">
                  {['Package ID', 'Status', 'Returned At'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returned.map((pkg: any, i: number) => {
                  const returnEntry = pkg.trackingHistory?.findLast((t: any) => t.status === 'returned');
                  return (
                    <tr key={pkg._id} className={`border-t border-red-50 hover:bg-red-50/50 transition-colors ${i % 2 !== 0 ? 'bg-red-50/20' : ''}`}>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-gray-700">{pkg.packageId}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={pkg.status} /></td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">
                        {returnEntry ? new Date(returnEntry.timestamp).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
