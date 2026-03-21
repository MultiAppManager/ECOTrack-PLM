'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const SignUp = () => {
    const ROLE_OPTIONS = ['Engineering User', 'Approver', 'Operations User', 'Admin'] as const
    type RoleOption = typeof ROLE_OPTIONS[number]
    const router=useRouter();
    const [error, setError] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [role, setRole] = useState<RoleOption>('Engineering User')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        
        // Password validation
        if (password !== confirmPassword) {
            setError('Passwords do not match')
            toast.error('Passwords do not match')
            return
        }
        
        try {
            // Sign up with role as additional field
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/sign-up/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    email,
                    password,
                    name,
                    role
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Sign-up error response:', data);
                throw new Error(data.message || 'Sign up failed');
            }

            toast.success(`Sign up successful as ${role}!`);
            router.push('/dashboard');
        } catch (error: any) {
            toast.error(`Error signing up: ${error.message}`);
            setError(error.message || 'An unknown error occurred');
        }
    }

    return (
        <div className='flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600' suppressHydrationWarning>
            <div className='bg-white p-8 rounded-2xl shadow-2xl border-2 border-purple-200 w-full max-w-md'>
                <div className='text-center mb-6'>
                    <div className='text-6xl mb-3'>✨</div>
                    <h1 className='text-3xl font-bold text-purple-600 mb-2'>Create Account</h1>
                    <p className='text-gray-600 text-sm'>Join us today! Create your account to get started.</p>
                </div>
                <form onSubmit={handleSignUp} className='flex flex-col gap-4'>
                    <div>
                        <label className='block text-sm font-semibold mb-2 text-gray-700'>Name:</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='Enter your name'
                            className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                            required
                        />
                    </div>
                    <div>
                        <label className='block text-sm font-semibold mb-2 text-gray-700'>Role:</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as RoleOption)}
                            className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer'
                            required
                        >
                            <option value="Engineering User">Engineering User</option>
                            <option value="Approver">Approver</option>
                            <option value="Operations User">Operations User</option>
                            <option value="Admin">Admin</option>
                        </select>
                        <p className='text-xs text-gray-500 mt-1'>Select your account type</p>
                    </div>
                    <div>
                        <label className='block text-sm font-semibold mb-2 text-gray-700'>Email:</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder='Enter your email'
                            className='w-full border-2 border-purple-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                            required
                        />
                    </div>
                    <div>
                        <label className='block text-sm font-semibold mb-2 text-gray-700'>Password:</label>
                        <div className='relative'>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder='Min 8 chars: A-Z, a-z, 0-9, special char'
                                className='w-full border-2 border-purple-300 p-3 pr-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-purple-600 focus:outline-none'
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <div className='mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded'>
                            <p className='font-semibold mb-1'>Password requirements:</p>
                            <ul className='space-y-1'>
                                <li className={password.length >= 8 ? '✓ text-green-600' : '✗ text-gray-500'}>Min 8 characters</li>
                                <li className={/[A-Z]/.test(password) ? '✓ text-green-600' : '✗ text-gray-500'}>At least one uppercase letter</li>
                                <li className={/[a-z]/.test(password) ? '✓ text-green-600' : '✗ text-gray-500'}>At least one lowercase letter</li>
                                <li className={/[0-9]/.test(password) ? '✓ text-green-600' : '✗ text-gray-500'}>At least one number</li>
                                <li className={/[^A-Za-z0-9]/.test(password) ? '✓ text-green-600' : '✗ text-gray-500'}>At least one special character (@, #, $, etc)</li>
                            </ul>
                        </div>
                    </div>
                    <div>
                        <label className='block text-sm font-semibold mb-2 text-gray-700'>Confirm Password:</label>
                        <div className='relative'>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder='Confirm your password'
                                className='w-full border-2 border-purple-300 p-3 pr-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-purple-600 focus:outline-none'
                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                                {showConfirmPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className='bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 mt-2'
                    >
                        Sign Up
                    </button>
                    {error && <p className='text-red-600 text-sm mt-2'>{error}</p>}
                </form>
                <div className='mt-6 text-center'>
                    <span className='text-gray-600 text-sm'>Already have an account? </span>
                    <Link href='/sign-in' className='text-purple-600 hover:text-purple-800 text-sm font-bold'>
                        Sign In
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default SignUp
