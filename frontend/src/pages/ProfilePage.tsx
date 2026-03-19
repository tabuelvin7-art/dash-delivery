import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  businessName?: string;
  address?: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const inp = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all";
const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const roleLabel: Record<string, string> = {
  business_owner: 'Business Owner',
  customer: 'Customer',
  agent: 'Agent',
  admin: 'Administrator',
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    defaultValues: {
      firstName: user?.profile?.firstName || '',
      lastName: user?.profile?.lastName || '',
      phoneNumber: user?.phoneNumber || '',
      businessName: user?.profile?.businessName || '',
      address: user?.profile?.address || '',
    },
  });

  const { register: regPw, handleSubmit: handlePw, watch, reset: resetPw, formState: { errors: pwErrors, isSubmitting: pwSubmitting } } = useForm<PasswordForm>();
  const newPassword = watch('newPassword', '');

  const onSaveProfile = async (data: ProfileForm) => {
    setProfileMsg(''); setProfileErr('');
    try {
      await api.patch('/users/profile', {
        phoneNumber: data.phoneNumber,
        profile: {
          firstName: data.firstName,
          lastName: data.lastName,
          businessName: data.businessName,
          address: data.address,
        },
      });
      await refreshUser();
      setProfileMsg('Profile updated successfully.');
    } catch (e: any) {
      setProfileErr(e.response?.data?.error?.message || 'Failed to update profile');
    }
  };

  const onChangePassword = async (data: PasswordForm) => {
    setPwMsg(''); setPwErr('');
    try {
      await api.patch('/users/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setPwMsg('Password changed successfully.');
      resetPw();
    } catch (e: any) {
      setPwErr(e.response?.data?.error?.message || 'Failed to change password');
    }
  };

  if (!user) return null;

  const initials = `${user.profile?.firstName?.[0] || ''}${user.profile?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold">{user.profile?.firstName} {user.profile?.lastName}</h1>
            <p className="text-green-100 text-sm mt-0.5">{user.email}</p>
            <span className="inline-block mt-1.5 text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-medium">
              {roleLabel[user.role] || user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Profile info form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="font-semibold text-gray-800 mb-6">Personal Information</h2>

        {profileMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-xl mb-5 flex items-center gap-2">
            <span>✓</span> {profileMsg}
          </div>
        )}
        {profileErr && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-5 flex items-center gap-2">
            <span>⚠</span> {profileErr}
          </div>
        )}

        <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">First Name</label>
              <input {...register('firstName', { required: 'Required' })} className={inp} />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Name</label>
              <input {...register('lastName', { required: 'Required' })} className={inp} />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input value={user.email} disabled className={inp + ' bg-gray-50 text-gray-400 cursor-not-allowed'} />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
            <input
              {...register('phoneNumber', {
                required: 'Required',
                pattern: { value: /^\+254\d{9}$/, message: 'Format: +254XXXXXXXXX' },
              })}
              className={inp}
              placeholder="+254712345678"
            />
            {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber.message}</p>}
          </div>

          {user.role === 'business_owner' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business Name</label>
              <input {...register('businessName')} className={inp} placeholder="Your business name" />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
            <input {...register('address')} className={inp} placeholder="Your address (optional)" />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="font-semibold text-gray-800 mb-6">Change Password</h2>

        {pwMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-xl mb-5 flex items-center gap-2">
            <span>✓</span> {pwMsg}
          </div>
        )}
        {pwErr && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-5 flex items-center gap-2">
            <span>⚠</span> {pwErr}
          </div>
        )}

        <form onSubmit={handlePw(onChangePassword)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                {...regPw('currentPassword', { required: 'Required' })}
                type={showCurrent ? 'text' : 'password'}
                placeholder="••••••••"
                className={inp + ' pr-16'}
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium">
                {showCurrent ? 'Hide' : 'Show'}
              </button>
            </div>
            {pwErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.currentPassword.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                {...regPw('newPassword', {
                  required: 'Required',
                  pattern: { value: STRONG_PW, message: 'Must be 8+ chars with uppercase, lowercase, number & symbol' },
                })}
                type={showNew ? 'text' : 'password'}
                placeholder="••••••••"
                className={inp + ' pr-16'}
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium">
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            {pwErrors.newPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.newPassword.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
            <input
              {...regPw('confirmPassword', {
                required: 'Required',
                validate: v => v === newPassword || 'Passwords do not match',
              })}
              type="password"
              placeholder="••••••••"
              className={inp}
            />
            {pwErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.confirmPassword.message}</p>}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={pwSubmitting}
              className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-6 py-2.5 rounded-xl text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pwSubmitting ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
