import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';

const statuses = ['', 'created', 'dropped_off_at_agent', 'dispatched', 'arrived_at_destination_agent', 'out_for_delivery', 'delivered', 'cancelled'];

export default function PackagesPage() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/packages?${params}`);
      setPackages(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const handleSearch = async () => {
    if (!search.trim()) { load(); return; }
    try {
      const res = await api.get(`/packages/search?q=${encodeURIComponent(search)}`);
      setPackages(res.data.data || []);
      setTotalPages(1);
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          {total > 0 && <p className="text-sm text-gray-500 mt-0.5">{total} total</p>}
        </div>
        {user?.role === 'business_owner' && (
          <Link to="/packages/new" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors">
            + New Package
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by ID, name, phone..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Search
          </button>
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
        >
          {statuses.map(s => (
            <option key={s} value={s}>{s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All Statuses'}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : packages.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-400 text-sm">No packages found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                    {['Package ID', 'Delivery Method', 'Status', 'Item Price', 'Delivery Fee', 'Created'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg: any, i: number) => (
                    <tr key={pkg._id} className={`border-t border-gray-50 hover:bg-green-50/40 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-5 py-3.5">
                        <Link to={`/packages/${pkg.packageId}`} className="font-mono text-xs font-bold text-green-700 hover:text-green-800 hover:underline">
                          {pkg.packageId}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 capitalize">{pkg.deliveryMethod?.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={pkg.status} /></td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">KES {pkg.itemPrice?.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-gray-600">KES {pkg.deliveryFee?.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(pkg.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between text-sm">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-gray-500 text-xs">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
