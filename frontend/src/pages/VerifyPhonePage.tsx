import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

export default function VerifyPhonePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const phoneNumber = (location.state as any)?.phoneNumber || '';
  const devOtp = (location.state as any)?.devOtp || '';
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ otp: string }>({
    defaultValues: { otp: devOtp },
  });

  const onSubmit = async ({ otp }: { otp: string }) => {
    setError('');
    try {
      await api.post('/auth/verify-phone', { phoneNumber, otp });
      setSuccess('Phone verified! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Verification failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-green-700 mb-2">Verify Phone</h1>
        {!phoneNumber ? (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm mb-4">Session expired. Please register again to get a new OTP.</p>
            <button onClick={() => navigate('/register')} className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg text-sm">
              Back to Register
            </button>
          </div>
        ) : (
          <>
            <p className="text-gray-500 mb-6 text-sm">Enter the 6-digit code sent to <strong>{phoneNumber}</strong></p>
            {devOtp && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded mb-4">
                <span className="font-medium">Dev mode — your OTP is: </span>
                <span className="font-mono font-bold tracking-widest text-base">{devOtp}</span>
              </div>
            )}
            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 text-sm p-3 rounded mb-4">{success}</div>}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input {...register('otp', { required: true, minLength: 6, maxLength: 6 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="000000" maxLength={6} />
              <button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                {isSubmitting ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
