import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';

const StatCard = ({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) => (
  <div className={`rounded-2xl p-5 ${accent} flex flex-col gap-1`}>
    <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{label}</p>
    <p className="text-3xl font-bold">{value}</p>
    {sub && <p className="text-xs opacity-60">{sub}</p>}
  </div>
);

function CustomerDashboard({ packages }: { packages: any[] }) {
  const active = packages.filter(p => p.status !== 'delivered' && p.status !== 'returned' && p.status !== 'cancelled');
  const delivered = packages.filter(p => p.status === 'delivered');

  const statusColor: Record<string, string> = {
    created: 'bg-gray-100 text-gray-600',
    dropped_off_at_agent: 'bg-yellow-100 text-yellow-700',
    dispatched: 'bg-blue-100 text-blue-700',
    arrived_at_destination_agent: 'bg-purple-100 text-purple-700',
    out_for_delivery: 'bg-orange-100 text-orange-700',
    delivered: 'bg-green-100 text-green-700',
    returned: 'bg-red-100 text-red-600',
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{packages.length}</p>
          <p className="text-xs text-gray-400 mt-1">packages</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">In Transit</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{active.length}</p>
          <p className="text-xs text-gray-400 mt-1">awaiting delivery</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Delivered</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{delivered.length}</p>
          <p className="text-xs text-gray-400 mt-1">completed</p>
        </div>
      </div>

      {/* Active packages */}
      {active.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Active Deliveries</h2>
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2.5 py-1 rounded-full">{active.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {active.map(pkg => (
              <Link key={pkg._id} to={`/packages/${pkg.packageId}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-green-50/40 transition-colors">
                <div>
                  <p className="font-mono text-xs font-bold text-gray-800">{pkg.packageId}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{pkg.deliveryMethod?.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[pkg.status] || 'bg-gray-100 text-gray-500'}`}>
                    {pkg.status.replace(/_/g, ' ')}
                  </span>
                  {pkg.releaseCode && (
                    <span className="font-mono font-bold text-green-700 text-sm tracking-widest bg-green-50 px-2 py-0.5 rounded">
                      {pkg.releaseCode}
                    </span>
                  )}
                  <span className="text-gray-300 text-xs">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty active state */}
      {active.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-12 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-gray-500 text-sm">No active deliveries right now.</p>
          <Link to="/track" className="mt-3 inline-block text-sm text-green-600 hover:underline font-medium">Track a package →</Link>
        </div>
      )}

      {/* Recent delivered */}
      {delivered.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Delivered</h2>
            <Link to="/packages" className="text-sm text-green-600 hover:text-green-700 font-medium">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  {['Package ID', 'Method', 'Delivered'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {delivered.slice(0, 5).map((pkg, i) => (
                  <tr key={pkg._id} className={`border-t border-gray-50 hover:bg-green-50/30 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-5 py-3.5">
                      <Link to={`/packages/${pkg.packageId}`} className="font-mono text-xs font-bold text-green-700 hover:underline">{pkg.packageId}</Link>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 capitalize text-xs">{pkg.deliveryMethod?.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{pkg.deliveredAt ? new Date(pkg.deliveredAt).toLocaleDateString() : new Date(pkg.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const pkgRes = await api.get('/packages?page=1');
        setPackages(pkgRes.data.data || []);
        if (user?.role === 'business_owner') {
          const statsRes = await api.get('/users/dashboard-stats');
          setStats(statsRes.data.data);
        }
      } catch { /* handled gracefully */ }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.profile?.firstName ?? user?.email} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.role === 'customer' ? 'Track and manage your deliveries.' : "Here's what's happening with your deliveries."}
          </p>
        </div>
        {user?.role === 'business_owner' && (
          <Link to="/packages/new" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors">
            + New Package
          </Link>
        )}
      </div>

      {/* Customer view */}
      {user?.role === 'customer' && <CustomerDashboard packages={packages} />}

      {/* Business owner / admin view */}
      {user?.role !== 'customer' && (
        <>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Packages" value={stats.totalPackages} accent="bg-blue-50 text-blue-800" />
              <StatCard label="Pending" value={stats.pendingDeliveries} accent="bg-amber-50 text-amber-800" />
              <StatCard label="Delivered" value={stats.completedDeliveries} accent="bg-emerald-50 text-emerald-800" />
              <StatCard label="Revenue" value={`KES ${stats.revenueThisMonth?.toLocaleString()}`} sub="this month" accent="bg-violet-50 text-violet-800" />
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Recent Packages</h2>
              <Link to="/packages" className="text-sm text-green-600 hover:text-green-700 font-medium">View all →</Link>
            </div>
            {packages.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-4xl mb-3">📦</p>
                <p className="text-gray-500 text-sm">No packages yet.</p>
                {user?.role === 'business_owner' && (
                  <Link to="/packages/new" className="mt-4 inline-block text-sm text-green-600 font-medium hover:underline">Create your first package</Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      {['Package ID', 'Method', 'Status', 'Item Price', 'Created'].map(h => (
                        <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {packages.slice(0, 10).map((pkg: any, i: number) => (
                      <tr key={pkg._id} className={`border-t border-gray-50 hover:bg-green-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-5 py-3.5">
                          <Link to={`/packages/${pkg.packageId}`} className="font-mono text-xs font-semibold text-green-700 hover:text-green-800 hover:underline">
                            {pkg.packageId}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 capitalize">{pkg.deliveryMethod?.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={pkg.status} /></td>
                        <td className="px-5 py-3.5 font-medium text-gray-800">KES {pkg.itemPrice?.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(pkg.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
