'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { passwordSchema } from '@/lib/validation'
import { authClient } from '@/lib/auth-client'

const ResetPassword = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email')

  const [email, setEmail] = useState(emailParam || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (!emailParam) {
      toast.error('Email is required. Please start from forgot password.')
      router.push('/forgot-password')
    }
  }, [emailParam, router])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      toast.error('Passwords do not match')
      return
    }

    // Validate password with passwordSchema
    const validation = passwordSchema.safeParse(newPassword)
    if (!validation.success) {
      const errorMessage = validation.error.issues[0].message
      setError(errorMessage)
      toast.error(errorMessage)
      return
    }

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP')
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: resetError } = await authClient.emailOtp.resetPassword({
        email,
        otp,
        password: newPassword,
      })

      if (resetError) {
        throw new Error(resetError.message || 'Failed to reset password')
      }

      toast.success('Password reset successfully!')
      setTimeout(() => {
        router.push('/sign-in')
      }, 1000)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to reset password'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (!emailParam) {
    return null
  }

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600' suppressHydrationWarning>
      <div className='bg-white p-8 rounded-2xl shadow-2xl border-2 border-purple-200 w-full max-w-md'>
        <div className='text-center mb-6'>
          <div className='text-5xl mb-3'>🔐</div>
          <h1 className='text-3xl font-bold text-purple-600 mb-2'>Reset Password</h1>
          <p className='text-gray-600 text-sm'>Enter the OTP sent to {email}</p>
        </div>

        <form onSubmit={handleResetPassword} className='flex flex-col gap-4'>
          <div>
            <label className='block text-sm font-semibold mb-2 text-gray-700'>OTP Code:</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder='Enter 6-digit OTP'
              className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center text-2xl tracking-widest'
              maxLength={6}
              required
            />
          </div>

          <div>
            <label className='block text-sm font-semibold mb-2 text-gray-700'>New Password:</label>
            <div className='relative'>
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder='Enter new password'
                className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12'
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none'
              >
                {showPassword ? (
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' />
                  </svg>
                ) : (
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className='block text-sm font-semibold mb-2 text-gray-700'>Confirm Password:</label>
            <div className='relative'>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder='Confirm new password'
                className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12'
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none'
              >
                {showConfirmPassword ? (
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' />
                  </svg>
                ) : (
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className='bg-red-50 border-2 border-red-200 rounded-lg p-3'>
              <p className='text-red-600 text-sm'>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className='bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 mt-2 flex items-center justify-center gap-2'
          >
            {isLoading && (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isLoading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <div className='mt-6 text-center'>
          <Link href='/forgot-password' className='text-purple-600 hover:text-purple-800 text-sm font-medium mr-4'>
            ← Resend OTP
          </Link>
          <Link href='/sign-in' className='text-purple-600 hover:text-purple-800 text-sm font-medium'>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword