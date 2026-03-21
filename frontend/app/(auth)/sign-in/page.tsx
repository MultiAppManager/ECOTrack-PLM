'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const SignIn = () => {
    const [error, setError] = useState<string | null>(null)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const router=useRouter();

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        
        // Client-side email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address')
            toast.error('Please enter a valid email address')
            setIsLoading(false)
            return
        }

        // Client-side password validation
        if (password.length < 6) {
            setError('Password must be at least 6 characters long')
            toast.error('Password must be at least 6 characters long')
            setIsLoading(false)
            return
        }

        const { error } = await authClient.signIn.email({
            email,
            password,
            rememberMe: true
        })
        
        if (error) {
            // Provide user-friendly error messages
            let errorMessage = 'Sign in failed. Please try again.'
            
            if (error.message?.toLowerCase().includes('invalid') || 
                error.message?.toLowerCase().includes('credentials') ||
                error.message?.toLowerCase().includes('email') ||
                error.message?.toLowerCase().includes('password')) {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.'
            } else if (error.message?.toLowerCase().includes('not found')) {
                errorMessage = 'No account found with this email. Please sign up first.'
            } else if (error.message?.toLowerCase().includes('network') || 
                       error.message?.toLowerCase().includes('connection')) {
                errorMessage = 'Network error. Please check your internet connection.'
            } else if (error.message) {
                errorMessage = error.message
            }
            
            setError(errorMessage)
            toast.error(errorMessage)
            setIsLoading(false)
        } else {
            toast.success('Welcome back! Sign in successful.')
            router.push('/dashboard')
        }
    }

    const handleSocialSignIn = async (provider: "google" | "github") => {
        setIsLoading(true)
        setError(null)
        const {error} = await authClient.signIn.social({
            provider,
            callbackURL: '/dashboard',
        })
        setIsLoading(false)
        if(error)
        {
            let errorMessage = `Failed to sign in with ${provider === 'google' ? 'Google' : 'GitHub'}. Please try again.`
            
            if (error.message?.toLowerCase().includes('popup') || 
                error.message?.toLowerCase().includes('window')) {
                errorMessage = 'Pop-up blocked. Please allow pop-ups and try again.'
            } else if (error.message?.toLowerCase().includes('cancelled') || 
                       error.message?.toLowerCase().includes('closed')) {
                errorMessage = 'Sign in cancelled. Please try again if you want to continue.'
            } else if (error.message) {
                errorMessage = error.message
            }
            
            setError(errorMessage)
            toast.error(errorMessage)
        }else{
            toast.success(`Successfully signed in with ${provider === 'google' ? 'Google' : 'GitHub'}!`)
            // router.push('/dashboard')
        }
    }


    return (
        <div className='flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 p-4' suppressHydrationWarning>
            <div className='w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-center'>
                <div className='hidden lg:flex flex-col justify-center items-center bg-white/10 border-2 border-purple-200/40 rounded-2xl p-8 text-white shadow-2xl'>
                    <div className='w-24 h-24 rounded-2xl bg-white/20 border-2 border-purple-200/50 flex items-center justify-center'>
                        <Image src='/plm-logo.svg' alt='PLM Logo' width={56} height={56} />
                    </div>
                    <h2 className='mt-6 text-2xl font-bold text-center'>PLM</h2>
                    <p className='mt-2 text-base font-medium text-center text-purple-50 max-w-sm leading-relaxed'>
                        Engineering Changes, Executed with Control
                    </p>
                </div>
                <div className='bg-white p-8 rounded-2xl shadow-2xl border-2 border-purple-200 w-full max-w-md lg:max-w-none lg:justify-self-end'>
                <div className='text-center mb-6'>
                    <div className='text-6xl mb-3'>🔐</div>
                    <h1 className='text-3xl font-bold text-purple-600 mb-2'>Sign In</h1>
                    <p className='text-gray-600 text-sm'>Welcome back! Please sign in to continue.</p>
                </div>
                <form onSubmit={handleSignIn} className='flex flex-col gap-4' suppressHydrationWarning>
                    <div suppressHydrationWarning>
                        <label className='block text-sm font-semibold mb-2 text-gray-700'>Email:</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder='Enter your email'
                            className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                            required
                            suppressHydrationWarning
                        />
                    </div>
                    <div suppressHydrationWarning>
                        <label className='block text-sm font-semibold mb-2 text-gray-700'>Password:</label>
                        <div className='relative'>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder='Enter your password'
                                className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12'
                                required
                                suppressHydrationWarning
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
                    <div className='flex justify-end'>
                        <Link href='/forgot-password' className='text-sm text-purple-600 hover:text-purple-800 font-medium'>
                            Forgot Password?
                        </Link>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className='bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 mt-2 flex items-center justify-center gap-2'
                        suppressHydrationWarning
                    >
                        {isLoading && (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>
                    {error && (
                        <div className='bg-red-50 border-2 border-red-300 rounded-lg p-3 mt-3'>
                            <div className='flex items-start gap-2'>
                                <svg className='w-5 h-5 text-red-600 flex-shrink-0 mt-0.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                                </svg>
                                <p className='text-red-700 text-sm font-medium'>{error}</p>
                            </div>
                        </div>
                    )}
                </form>

                {/* Divider */}
                <div className='flex items-center gap-4 my-6'>
                    <div className='flex-1 h-px bg-gray-300'></div>
                    <span className='text-gray-500 text-sm font-medium'>OR</span>
                    <div className='flex-1 h-px bg-gray-300'></div>
                </div>

                {/* OAuth Providers */}
                <div className='space-y-3'>
                    <button
                        onClick={() => handleSocialSignIn("google")}
                        disabled={isLoading}
                        className='w-full flex items-center justify-center gap-3 border-2 border-gray-300 hover:border-gray-400 disabled:border-gray-200 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-700 disabled:text-gray-400 font-semibold py-3 px-6 rounded-lg transition-colors duration-200'
                        suppressHydrationWarning
                    >
                        {isLoading ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg className='w-5 h-5' viewBox='0 0 24 24'>
                                <path fill='#4285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'/>
                                <path fill='#34A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'/>
                                <path fill='#FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'/>
                                <path fill='#EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'/>
                            </svg>
                        )}
                        {isLoading ? 'Signing in...' : 'Continue with Google'}
                    </button>
                </div>

                <div className='mt-6 text-center'>
                    <span className='text-gray-600 text-sm'>Don't have an account? </span>
                    <Link href='/sign-up' className='text-purple-600 hover:text-purple-800 text-sm font-bold'>
                        Sign Up
                    </Link>
                </div>
                </div>
            </div>
        </div>
    )
}

export default SignIn