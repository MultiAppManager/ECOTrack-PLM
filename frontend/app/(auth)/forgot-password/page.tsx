'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

const ForgotPassword = () => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Use Better Auth's emailOTP plugin to send forget-password OTP
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'forget-password',
      })

      toast.success('OTP sent to your email!')
      setEmailSent(true)
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600' suppressHydrationWarning>
      <div className='bg-white p-8 rounded-2xl shadow-2xl border-2 border-purple-200 w-full max-w-md'>
        {!emailSent ? 
          <>
            <div className='text-center mb-6'>
              <div className='text-6xl mb-3'>🔑</div>
              <h1 className='text-3xl font-bold text-purple-600 mb-2'>Forgot Password?</h1>
              <p className='text-gray-600 text-sm'>
                Enter your email address and we'll send you an OTP to reset your password.
              </p>
            </div>
            <form onSubmit={handleSendResetLink} className='flex flex-col gap-4'>
              <div>
                <label className='block text-sm font-semibold mb-2 text-gray-700'>Email:</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='Enter your email' 
                  className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                  required
                  disabled={isLoading}
                />
              </div>
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
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          </>
         : (
          <div className='text-center'>
            <div className='text-6xl mb-4'>📧</div>
            <h2 className='text-2xl font-bold text-purple-600 mb-3'>Check Your Email</h2>
            <p className='text-gray-600 mb-6'>
              We've sent an OTP to <strong>{email}</strong>
            </p>
            <p className='text-sm text-gray-500 mb-6'>
              Didn't receive the email? Check your spam folder.
            </p>
            <button
              onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
              className='w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg transition-colors duration-200 text-lg'
            >
              Enter OTP
            </button>
          </div>
        )}
        <div className='mt-6 text-center'>
          <Link href='/sign-in' className='text-purple-600 hover:text-purple-800 text-sm font-medium'>
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword