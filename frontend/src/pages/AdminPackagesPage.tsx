import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { SuccessAlert, ErrorAlert } from '../components/Alert';

const statuses = ['', 'created', 'dropped_off_at_agent', 'dispatched', 'arrived_at_destination_agent', 'out_for_delivery', 'delivered', 'returned', 'cancelled'];
const VALID_STATUSES = statuses.filter(Boolean);

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/packages?${params}`);
      setPackages(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/agents').then(r => setAgents(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(page); }, [page, statusFilter]);

  const handleSearch = async () => {
    if (!search.trim()) { load(); return; }
    try {
      const res = await api.get(`/packages/search?q=${encodeURIComponent(search)}`);
      setPackages(res.data.data || []);
      setTotalPages(1); setTotal(res.data.data?.length || 0);
    } catch { /* ignore */ }
  };

  const doOverride = async (packageId: string) => {
    if (!overrideStatus) return;
    setError(''); setMessage('');
    try {
      await api.patch(`/packages/${packageId}/admin-status`, { status: overrideStatus, note: overrideNote || undefined });
      setMessage(`Status updated to "${overrideStatus}"`);
      setOverriding(null); setOverrideStatus(''); setOverrideNote('');
      load(page);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Override failed');
    }
  };

  // Filter by agent client-side (destinationAgentId)
  const displayed = agentFilter
    ? packages.filter(p => String(p.destinationAgentId) === agentFilter || String(p.pickupAgentId) === agentFilter)
    : packages;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Packages</h1>
          {total > 0 && <p className="text-sm text-gray-500 mt-0.5">{total} total</p>}
        </div>
      </div>

      {message && <SuccessAlert message={message} />}
      {error && <ErrorAlert message={error} />}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex flex-1 gap-2 min-w-0">
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by ID, phone..." className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-0" />
          <button onClick={handleSearch} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">Search</button>
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
          {statuses.map(s => <option key={s} value={s}>{s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All Statuses'}</option>)}
        </select>
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
          <option value="">All Agents</option>
          {agents.map((a: any) => <option key={a._id} value={a._id}>{a.locationName}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
        ) : displayed.length === 0 ? (
          <div className="px-6 py-16 text-center"><p className="text-4xl mb-3">📭</p><p className="text-gray-400 text-sm">No packages found</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                    {['Package ID', 'Method', 'Status', 'Item Price', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((pkg: any, i: number) => (
                    <>
                      <tr key={pkg._id} className={`border-t border-gray-50 hover:bg-green-50/30 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-5 py-3.5">
                          <Link to={`/packages/${pkg.packageId}`} className="font-mono text-xs font-bold text-green-700 hover:underline">{pkg.packageId}</Link>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 capitalize text-xs">{pkg.deliveryMethod?.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={pkg.status} /></td>
                        <td className="px-5 py-3.5 font-medium text-gray-800">KES {pkg.itemPrice?.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(pkg.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">
                          <button onClick={() => { setOverriding(overriding === pkg.packageId ? null : pkg.packageId); setOverrideStatus(''); setOverrideNote(''); }}
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                            Override
                          </button>
                        </td>
                      </tr>
                      {overriding === pkg.packageId && (
                        <tr key={`${pkg._id}-override`} className="bg-purple-50 border-t border-purple-100">
                          <td colSpan={6} className="px-5 py-3">
                            <div className="flex flex-wrap gap-2 items-center">
                              <select value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)}
                                className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                                <option value="">Select new status...</option>
                                {VALID_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                              </select>
                              <input value={overrideNote} onChange={e => setOverrideNote(e.target.value)}
                                placeholder="Note (optional)" className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 w-48" />
                              <button onClick={() => doOverride(pkg.packageId)} disabled={!overrideStatus}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40">
                                Apply
                              </button>
                              <button onClick={() => setOverriding(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between text-sm">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">← Prev</button>
                <span className="text-gray-400 text-xs">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
