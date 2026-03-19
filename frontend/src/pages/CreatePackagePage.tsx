import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface FormData {
  customerPhone: string;
  deliveryMethod: string; destinationAgentId: string; deliveryAddress: string;
  shelfRentalId: string;
  itemPrice: number; deliveryFee: number;
}

const STEPS = ['Customer', 'Delivery', 'Pricing'];

const inp = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all";

export default function CreatePackagePage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [myRentals, setMyRentals] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ defaultValues: { deliveryMethod: 'agent_delivery' } });
  const deliveryMethod = watch('deliveryMethod');

  useEffect(() => {
    api.get('/agents').then(r => setAgents(r.data.data || [])).catch(() => {});
    api.get('/shelves/my-rentals').then(r => setMyRentals((r.data.data || []).filter((r: any) => r.status === 'active'))).catch(() => {});
  }, []);

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      let customerId: string;
      try {
        const lookupRes = await api.get(`/users/by-phone/${encodeURIComponent(data.customerPhone)}`);
        customerId = lookupRes.data.data._id;
      } catch {
        setError('Customer not found. They must register first before you can create a package for them.');
        return;
      }
      const payload: any = { customerId, deliveryMethod: data.deliveryMethod, itemPrice: Number(data.itemPrice), deliveryFee: Number(data.deliveryFee) };
      if (data.deliveryMethod === 'agent_delivery') payload.destinationAgentId = data.destinationAgentId;
      if (data.deliveryMethod === 'doorstep_delivery') payload.deliveryAddress = data.deliveryAddress;
      if (data.deliveryMethod === 'rent_a_shelf') payload.shelfRentalId = data.shelfRentalId;
      const res = await api.post('/packages', payload);
      navigate(`/packages/${res.data.data.packageId}`);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to create package');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Package</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the details to create a delivery</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => {
          const s = i + 1;
          const active = step === s;
          const done = step > s;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${s < STEPS.length ? 'flex-1' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${done ? 'bg-green-600 text-white' : active ? 'bg-green-600 text-white ring-4 ring-green-100' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? '✓' : s}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? 'text-green-700' : done ? 'text-gray-600' : 'text-gray-400'}`}>{label}</span>
              </div>
              {s < STEPS.length && <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-5 flex items-center gap-2">
          <span>⚠</span> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Step 1: Customer */}
          {step === 1 && (
            <>
              <div>
                <h2 className="font-semibold text-gray-800 mb-4">Customer Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                    <input {...register('customerPhone', { required: true })} className={inp} placeholder="+254712345678" />
                    <p className="text-xs text-gray-400 mt-1">The customer must already have an account registered with this number.</p>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setStep(2)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                Continue →
              </button>
            </>
          )}

          {/* Step 2: Delivery */}
          {step === 2 && (
            <>
              <div>
                <h2 className="font-semibold text-gray-800 mb-4">Delivery Method</h2>
                <div className="space-y-2">
                  {[
                    { value: 'agent_delivery', label: 'Agent Delivery', desc: 'Customer picks up from agent location', icon: '🏪' },
                    { value: 'doorstep_delivery', label: 'Doorstep Delivery', desc: 'Delivered directly to customer address', icon: '🚚' },
                    { value: 'rent_a_shelf', label: 'Rent-a-Shelf', desc: 'Store at agent location for pickup', icon: '📦' },
                  ].map(m => (
                    <label key={m.value} className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${deliveryMethod === m.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" {...register('deliveryMethod')} value={m.value} className="sr-only" />
                      <span className="text-xl mr-3 mt-0.5">{m.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{m.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                      </div>
                      {deliveryMethod === m.value && <span className="ml-auto text-green-600 text-sm">✓</span>}
                    </label>
                  ))}
                </div>

                {deliveryMethod === 'agent_delivery' && (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Agent Location</label>
                    <select {...register('destinationAgentId', { required: deliveryMethod === 'agent_delivery' })} className={inp}>
                      <option value="">Choose agent location...</option>
                      {agents.map((a: any) => <option key={a.agentId} value={a._id}>{a.locationName} — {a.neighborhood}</option>)}
                    </select>
                  </div>
                )}
                {deliveryMethod === 'doorstep_delivery' && (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Delivery Address</label>
                    <input {...register('deliveryAddress', { required: deliveryMethod === 'doorstep_delivery' })} className={inp} placeholder="Street, Estate, Nairobi" />
                  </div>
                )}
                {deliveryMethod === 'rent_a_shelf' && (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Your Active Shelf Rental</label>
                    {myRentals.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-xl">
                        You have no active shelf rentals. Go to <strong>Shelves</strong> to rent one first, then come back here.
                      </div>
                    ) : (
                      <select {...register('shelfRentalId', { required: deliveryMethod === 'rent_a_shelf' })} className={inp}>
                        <option value="">Choose a shelf rental...</option>
                        {myRentals.map((r: any) => (
                          <option key={r._id} value={r._id}>
                            Shelf {r.shelfNumber} · expires {new Date(r.rentalPeriod?.endDate).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-gray-400">The package will be stored on your rented shelf. The customer collects it directly from the agent location.</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  ← Back
                </button>
                <button type="button" onClick={() => {
                  if (deliveryMethod === 'agent_delivery' && !watch('destinationAgentId')) { setError('Please select an agent location.'); return; }
                  if (deliveryMethod === 'doorstep_delivery' && !watch('deliveryAddress')?.trim()) { setError('Please enter a delivery address.'); return; }
                  if (deliveryMethod === 'rent_a_shelf' && !watch('shelfRentalId')) { setError('Please select a shelf rental.'); return; }
                  setError(''); setStep(3);
                }} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* Step 3: Pricing */}
          {step === 3 && (
            <>
              <div>
                <h2 className="font-semibold text-gray-800 mb-4">Pricing</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Item Price (KES)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">KES</span>
                      <input {...register('itemPrice', { required: true, min: 0 })} type="number" className={inp + ' pl-12'} placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Delivery Fee (KES)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">KES</span>
                      <input {...register('deliveryFee', { required: true, min: 0 })} type="number" className={inp + ' pl-12'} placeholder="0" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  ← Back
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Creating...' : 'Create Package'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
