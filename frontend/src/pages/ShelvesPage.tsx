import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import type { ShelfRental } from '../types';
import Spinner from '../components/Spinner';
import { SuccessAlert, ErrorAlert } from '../components/Alert';

interface RentForm { agentId: string; shelfNumber: string; startDate: string; endDate: string; monthlyRate: number; }
interface EditForm { shelfNumber: string; endDate: string; monthlyRate: number; }
interface InventoryForm { itemName: string; quantity: number; }

const inp = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all";

const statusStyle: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function fmtDate(d?: string | Date) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString();
}

export default function ShelvesPage() {
  const [rentals, setRentals] = useState<ShelfRental[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRentForm, setShowRentForm] = useState(false);
  const [selectedRental, setSelectedRental] = useState<ShelfRental | null>(null);
  const [editingRental, setEditingRental] = useState<ShelfRental | null>(null);
  const [renewingRental, setRenewingRental] = useState<ShelfRental | null>(null);
  const [renewEndDate, setRenewEndDate] = useState('');
  const [shelfPackages, setShelfPackages] = useState<Record<string, any[]>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<RentForm>();
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { isSubmitting: editSubmitting } } = useForm<EditForm>();
  const { register: regInv, handleSubmit: handleInv, reset: resetInv, formState: { isSubmitting: invSubmitting } } = useForm<InventoryForm>();

  const load = () => {
    Promise.all([api.get('/shelves/my-rentals'), api.get('/agents')])
      .then(([r, a]) => {
        const rentalsData: ShelfRental[] = r.data.data || [];
        setRentals(rentalsData);
        setAgents(a.data.data || []);
        rentalsData.filter(r => r.status === 'active').forEach(rental => {
          api.get(`/packages?shelfRentalId=${rental._id}`)
            .then(res => setShelfPackages(prev => ({ ...prev, [rental._id]: res.data.data || [] })))
            .catch(() => {});
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onRent = async (data: RentForm) => {
    setError(''); setMessage('');
    try {
      await api.post('/shelves/rent', {
        agentId: data.agentId,
        shelfNumber: data.shelfNumber,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        monthlyRate: Number(data.monthlyRate),
      });
      setMessage('Shelf rented successfully!');
      setShowRentForm(false);
      reset();
      load();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to rent shelf');
    }
  };

  const startEdit = (rental: ShelfRental) => {
    setEditingRental(rental);
    const endDate = rental.rentalPeriod?.endDate
      ? new Date(rental.rentalPeriod.endDate).toISOString().split('T')[0]
      : '';
    resetEdit({ shelfNumber: rental.shelfNumber, endDate, monthlyRate: rental.pricing.monthlyRate });
  };

  const onEdit = async (data: EditForm) => {
    if (!editingRental) return;
    setError(''); setMessage('');
    try {
      await api.patch(`/shelves/${editingRental._id}`, {
        shelfNumber: data.shelfNumber,
        endDate: new Date(data.endDate).toISOString(),
        monthlyRate: Number(data.monthlyRate),
      });
      setMessage('Rental updated successfully!');
      setEditingRental(null);
      resetEdit();
      load();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to update rental');
    }
  };

  const onAddInventory = async (data: InventoryForm) => {
    if (!selectedRental) return;
    setError(''); setMessage('');
    try {
      await api.post(`/shelves/${selectedRental._id}/inventory`, { itemName: data.itemName, quantity: Number(data.quantity) });
      setMessage('Item added to inventory');
      resetInv();
      load();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to add item');
    }
  };

  const renewRental = async () => {
    if (!renewingRental || !renewEndDate) return;
    setError(''); setMessage('');
    try {
      await api.post(`/shelves/${renewingRental._id}/renew`, { endDate: new Date(renewEndDate).toISOString() });
      setMessage('Rental renewed successfully!');
      setRenewingRental(null); setRenewEndDate('');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to renew rental');
    }
  };

  const removeItem = async (rentalId: string, itemName: string) => {    try {
      await api.delete(`/shelves/${rentalId}/inventory/${encodeURIComponent(itemName)}`);
      setMessage('Item removed');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to remove item');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shelf Rentals</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your storage at agent locations</p>
        </div>
        <button
          onClick={() => { setShowRentForm(!showRentForm); setEditingRental(null); }}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${showRentForm ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'}`}
        >
          {showRentForm ? 'Cancel' : '+ Rent a Shelf'}
        </button>
      </div>

      {message && <SuccessAlert message={message} />}
      {error && <ErrorAlert message={error} />}

      {showRentForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="font-semibold text-gray-800 mb-6">Rent a Shelf</h2>
          <form onSubmit={handleSubmit(onRent)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Agent Location</label>
              <select {...register('agentId', { required: true })} className={inp}>
                <option value="">Select agent location...</option>
                {agents.map((a: any) => <option key={a._id} value={a._id}>{a.locationName} — {a.neighborhood}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shelf Number</label>
              <input {...register('shelfNumber', { required: true })} placeholder="e.g. A1" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monthly Rate (KES)</label>
              <input type="number" {...register('monthlyRate', { required: true, min: 1 })} placeholder="e.g. 2000" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Start Date</label>
              <input type="date" {...register('startDate', { required: true })} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">End Date</label>
              <input type="date" {...register('endDate', { required: true })} className={inp} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50">
                {isSubmitting ? 'Renting...' : 'Confirm Rental'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingRental && (
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-800">Edit Rental — Shelf {editingRental.shelfNumber}</h2>
            <button onClick={() => setEditingRental(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
          <form onSubmit={handleEdit(onEdit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shelf Number</label>
              <input {...regEdit('shelfNumber', { required: true })} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monthly Rate (KES)</label>
              <input type="number" {...regEdit('monthlyRate', { required: true, min: 1 })} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">End Date</label>
              <input type="date" {...regEdit('endDate', { required: true })} className={inp} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={editSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50">
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {rentals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-16 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-400 text-sm">No shelf rentals yet. Rent a shelf to store your products at agent locations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rentals.map(rental => {
            const pkgs: any[] = shelfPackages[rental._id] || [];
            const activePackages = pkgs.filter(p => p.status !== 'delivered' && p.status !== 'cancelled' && p.status !== 'returned');
            return (
              <div key={rental._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">Shelf {rental.shelfNumber}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle[rental.status] || 'bg-gray-100 text-gray-500'}`}>
                          {rental.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {fmtDate(rental.rentalPeriod?.startDate)} — {fmtDate(rental.rentalPeriod?.endDate)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        KES {rental.pricing.monthlyRate?.toLocaleString()}/mo · Total: KES {rental.pricing.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {rental.status === 'active' && (
                        <button
                          onClick={() => { setShowRentForm(false); startEdit(rental); }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          Edit
                        </button>
                      )}
                      {(rental.status === 'active' || rental.status === 'expired') && (
                        <button
                          onClick={() => { setRenewingRental(renewingRental?._id === rental._id ? null : rental); setRenewEndDate(''); }}
                          className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
                        >
                          Renew
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedRental(selectedRental?._id === rental._id ? null : rental)}
                        className="text-xs text-green-600 hover:text-green-700 font-semibold"
                      >
                        {selectedRental?._id === rental._id ? 'Close' : 'Manage'}
                      </button>
                    </div>
                  </div>
                </div>

                {renewingRental?._id === rental._id && (
                  <div className="border-t border-amber-100 bg-amber-50 px-5 py-4 flex flex-wrap items-center gap-3">
                    <p className="text-xs font-semibold text-amber-700">Renew until:</p>
                    <input type="date" value={renewEndDate} onChange={e => setRenewEndDate(e.target.value)}
                      className="border border-amber-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <button onClick={renewRental} disabled={!renewEndDate}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors">
                      Confirm Renewal
                    </button>
                    <button onClick={() => setRenewingRental(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                )}

                {rental.status === 'active' && (
                  <div className="border-t border-gray-100 px-5 py-4">                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Packages on Shelf · {activePackages.length} active
                    </p>
                    {activePackages.length === 0 ? (
                      <p className="text-xs text-gray-400">No packages currently on this shelf.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {activePackages.map((pkg: any) => (
                          <div key={pkg._id} className="flex items-center justify-between text-sm bg-blue-50 rounded-xl px-4 py-2">
                            <span className="text-gray-700 font-mono text-xs">{pkg.packageId}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              pkg.status === 'dropped_off_at_agent' ? 'bg-yellow-100 text-yellow-700' :
                              pkg.status === 'created' ? 'bg-gray-100 text-gray-600' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {pkg.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Inventory · {rental.inventory?.length || 0} items
                  </p>
                  {rental.inventory?.length > 0 ? (
                    <div className="space-y-1.5 mb-3">
                      {rental.inventory.map(item => (
                        <div key={item.itemName} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-2">
                          <span className="text-gray-700">{item.itemName}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-xs">×{item.quantity}</span>
                            {rental.status === 'active' && (
                              <button onClick={() => removeItem(rental._id, item.itemName)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-3">No items stored yet.</p>
                  )}
                  {selectedRental?._id === rental._id && rental.status === 'active' && (
                    <form onSubmit={handleInv(onAddInventory)} className="flex gap-2 mt-2">
                      <input {...regInv('itemName', { required: true })} placeholder="Item name" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <input type="number" {...regInv('quantity', { required: true, min: 1 })} placeholder="Qty" className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <button type="submit" disabled={invSubmitting} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">Add</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
