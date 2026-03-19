import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

interface FormData {
  email: string; phoneNumber: string; password: string; confirmPassword: string;
  role: string; firstName: string; lastName: string; businessName?: string;
}

const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

function getStrength(pw: string) {
  if (!pw) return { score: 0, label: '', color: '', text: '' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) s++;
  if (s <= 2) return { score: s, label: 'Weak', color: 'bg-red-500', text: 'text-red-500' };
  if (s === 3) return { score: s, label: 'Fair', color: 'bg-yellow-500', text: 'text-yellow-600' };
  if (s === 4) return { score: s, label: 'Good', color: 'bg-blue-500', text: 'text-blue-600' };
  return { score: s, label: 'Strong', color: 'bg-green-500', text: 'text-green-600' };
}

const inp = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ defaultValues: { role: 'customer' } });
  const role = watch('role');
  const password = watch('password', '');
  const strength = getStrength(password);

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const res = await api.post('/auth/register', {
        email: data.email, phoneNumber: data.phoneNumber, password: data.password,
        role: data.role, profile: { firstName: data.firstName, lastName: data.lastName, businessName: data.businessName },
      });
      navigate('/verify-phone', { state: { phoneNumber: data.phoneNumber, devOtp: res.data.devOtp } });
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-600 rounded-2xl shadow-lg mb-4">
            <span className="text-white font-black text-xl">DD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Join DashDelivery today</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-5 flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">First Name</label>
                <input {...register('firstName', { required: 'Required' })} className={inp} placeholder="John" />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Name</label>
                <input {...register('lastName', { required: 'Required' })} className={inp} placeholder="Doe" />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input {...register('email', { required: 'Required' })} type="email" placeholder="you@example.com" className={inp} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
              <input
                {...register('phoneNumber', { required: 'Required', pattern: { value: /^\+254\d{9}$/, message: 'Format: +254XXXXXXXXX' } })}
                className={inp} placeholder="+254712345678"
              />
              {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Required', pattern: { value: STRONG_PW, message: 'Must be 8+ chars with uppercase, lowercase, number & symbol' } })}
                  type={showPw ? 'text' : 'password'} placeholder="••••••••" className={inp + ' pr-16'}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className={`text-xs ${strength.text}`}>{strength.label} — 8+ chars, uppercase, lowercase, number &amp; symbol</p>
                </div>
              )}
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  {...register('confirmPassword', { required: 'Required', validate: v => v === password || 'Passwords do not match' })}
                  type={showConfirm ? 'text' : 'password'} placeholder="••••••••" className={inp + ' pr-16'}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium">
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Account Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ value: 'customer', label: 'Customer', icon: '🛍️' }, { value: 'business_owner', label: 'Business Owner', icon: '🏪' }].map(opt => (
                  <label key={opt.value} className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${role === opt.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" {...register('role')} value={opt.value} className="sr-only" />
                    <span>{opt.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {role === 'business_owner' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business Name</label>
                <input {...register('businessName')} className={inp} placeholder="Your business name" />
              </div>
            )}

            <button
              type="submit" disabled={isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-green-600 font-semibold hover:text-green-700">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
