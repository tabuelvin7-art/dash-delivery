import { useEffect, useState } from 'react';
import api from '../services/api';
import Spinner from '../components/Spinner';

export default function AgentShelvesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/shelves/my-earnings')
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shelf Rentals</h1>
        <p className="text-sm text-gray-500 mt-0.5">Business owners renting shelf space at your location</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active Rentals</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{data?.activeRentals ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Billed</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">KES {data?.totalEarned?.toLocaleString() ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Confirmed Paid</p>
          <p className="text-3xl font-bold text-green-600 mt-1">KES {data?.totalPaid?.toLocaleString() ?? 0}</p>
        </div>
      </div>

      {/* Rentals table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">All Rentals</h2>
          <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">{data?.rentals?.length ?? 0} total</span>
        </div>

        {!data?.rentals?.length ? (
          <div className="px-6 py-16 text-center">
            <p className="text-4xl mb-3">🗄️</p>
            <p className="text-gray-400 text-sm">No shelf rentals yet. Business owners can rent shelves from your location.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                  {['Rental ID', 'Shelf', 'Start', 'End', 'Monthly Rate', 'Total', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rentals.map((r: any, i: number) => (
                  <tr key={r._id} className={`border-t border-gray-50 hover:bg-gray-50/50 ${i % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{r.rentalId}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{r.shelfNumber}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(r.rentalPeriod?.startDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(r.rentalPeriod?.endDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-gray-700">KES {r.pricing?.monthlyRate?.toLocaleString()}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">KES {r.pricing?.totalAmount?.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
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
      </div>
    </div>
  );
}
