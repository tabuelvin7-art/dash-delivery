import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import type { Agent } from '../types';
import Spinner from '../components/Spinner';
import { SuccessAlert, ErrorAlert } from '../components/Alert';

interface AgentForm {
  locationName: string; address: string; neighborhood: string; city: string;
  contactPhone: string; latitude: number; longitude: number; totalShelves: number;
  openTime: string; closeTime: string;
  agentFirstName: string; agentLastName: string; agentEmail: string; agentPassword: string; agentPhone: string;
}

const inp = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all";

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<AgentForm>({
    defaultValues: { city: 'Nairobi', totalShelves: 10, openTime: '08:00', closeTime: '20:00' },
  });

  const load = () => {
    api.get('/agents').then(r => setAgents(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (data: AgentForm) => {
    setError(''); setMessage('');
    try {
      await api.post('/agents', {
        locationName: data.locationName, address: data.address, neighborhood: data.neighborhood, city: data.city,
        contactPhone: data.contactPhone,
        coordinates: { latitude: Number(data.latitude), longitude: Number(data.longitude) },
        capacity: { totalShelves: Number(data.totalShelves), availableShelves: Number(data.totalShelves) },
        operatingHours: { open: data.openTime, close: data.closeTime, daysOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
        agentEmail: data.agentEmail, agentPassword: data.agentPassword,
        agentFirstName: data.agentFirstName, agentLastName: data.agentLastName,
        agentPhone: data.agentPhone || data.contactPhone,
      });
      setMessage(`Agent created. Login: ${data.agentEmail} / ${data.agentPassword}`);
      setShowForm(false);
      reset();
      load();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to create agent');
    }
  };

  const deactivate = async (agentId: string) => {
    if (!confirm('Deactivate this agent?')) return;
    try {
      await api.patch(`/agents/${agentId}/deactivate`);
      setMessage('Agent deactivated');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to deactivate');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Agents</h1>
          <p className="text-sm text-gray-500 mt-0.5">{agents.length} agent location{agents.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${showForm ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'}`}
        >
          {showForm ? 'Cancel' : '+ New Agent'}
        </button>
      </div>

      {message && <SuccessAlert message={message} />}
      {error && <ErrorAlert message={error} />}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="font-semibold text-gray-800 mb-6">Create Agent Location</h2>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-6">
            {/* Account section */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Agent Login Account</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First Name" error={errors.agentFirstName?.message}>
                  <input {...register('agentFirstName', { required: 'Required' })} placeholder="John" className={inp} />
                </Field>
                <Field label="Last Name" error={errors.agentLastName?.message}>
                  <input {...register('agentLastName', { required: 'Required' })} placeholder="Doe" className={inp} />
                </Field>
                <Field label="Agent Email" error={errors.agentEmail?.message}>
                  <input type="email" {...register('agentEmail', { required: 'Required' })} placeholder="agent@example.com" className={inp} />
                </Field>
                <Field label="Temporary Password" error={errors.agentPassword?.message}>
                  <input type="text" {...register('agentPassword', { required: 'Required', minLength: { value: 6, message: 'Min 6 chars' } })} placeholder="Temp password" className={inp} />
                </Field>
              </div>
            </div>

            {/* Location section */}
            <div className="border-t border-gray-100 pt-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Location Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Location Name" error={errors.locationName?.message}>
                  <input {...register('locationName', { required: 'Required' })} placeholder="e.g. Westlands Hub" className={inp} />
                </Field>
                <Field label="Address" error={errors.address?.message}>
                  <input {...register('address', { required: 'Required' })} placeholder="Street address" className={inp} />
                </Field>
                <Field label="Neighborhood" error={errors.neighborhood?.message}>
                  <input {...register('neighborhood', { required: 'Required' })} placeholder="e.g. Westlands" className={inp} />
                </Field>
                <Field label="City">
                  <input {...register('city')} className={inp} />
                </Field>
                <Field label="Contact Phone" error={errors.contactPhone?.message}>
                  <input {...register('contactPhone', { required: 'Required' })} placeholder="0712345678" className={inp} />
                </Field>
                <Field label="Total Shelves">
                  <input type="number" {...register('totalShelves', { min: 1 })} className={inp} />
                </Field>
                <Field label="Latitude" error={errors.latitude?.message}>
                  <input type="number" step="any" {...register('latitude', { required: 'Required' })} placeholder="-1.2921" className={inp} />
                </Field>
                <Field label="Longitude" error={errors.longitude?.message}>
                  <input type="number" step="any" {...register('longitude', { required: 'Required' })} placeholder="36.8219" className={inp} />
                </Field>
                <Field label="Opening Time">
                  <input type="time" {...register('openTime')} className={inp} />
                </Field>
                <Field label="Closing Time">
                  <input type="time" {...register('closeTime')} className={inp} />
                </Field>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50">
                {isSubmitting ? 'Creating...' : 'Create Agent'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {agents.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-4xl mb-3">🏪</p>
            <p className="text-gray-400 text-sm">No agents yet. Create your first agent location.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                  {['Location', 'Neighborhood', 'Phone', 'Shelves', 'Hours', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr key={agent._id} className={`border-t border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{agent.locationName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{agent.address}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{agent.neighborhood}</td>
                    <td className="px-5 py-3.5 text-gray-600">{agent.contactPhone}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-gray-800">{agent.capacity?.availableShelves}</span>
                      <span className="text-gray-400">/{agent.capacity?.totalShelves}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{agent.operatingHours?.open} – {agent.operatingHours?.close}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${agent.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {agent.isActive && (
                        <button onClick={() => deactivate(agent._id)} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                          Deactivate
                        </button>
                      )}
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
