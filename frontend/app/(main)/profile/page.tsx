'use client'
import React, { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const ProfilePage = () => {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview')
    const [isEditing, setIsEditing] = useState(false)
    const [editedName, setEditedName] = useState('')

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const session = await authClient.getSession()
                if (session.data?.user) {
                    setUser(session.data.user)
                    setEditedName(session.data.user.name || '')
                } else {
                    router.push('/sign-in')
                }
            } catch (error) {
                console.error('Error fetching user:', error)
                toast.error('Failed to load profile')
            } finally {
                setIsLoading(false)
            }
        }
        fetchUserData()
    }, [router])

    const handleSignOut = async () => {
        const { error } = await authClient.signOut()
        if (error) {
            toast.error(error.message || 'Something went wrong')
        } else {
            toast.success('Signed out successfully')
            router.push('/')
        }
    }

    if (isLoading) {
        return (
            <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
                <div className='text-center'>
                    <div className='animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#8b11dc] mx-auto mb-4'></div>
                    <p className='text-gray-600 font-semibold text-lg'>Loading profile...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    const isAdmin = user.role === 'Admin'
    const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'N/A'

    return (
        <div className='min-h-screen bg-transparent py-8 px-4'>
            <div className='max-w-7xl mx-auto'>
                {/* Header Card */}
                <div className='bg-white rounded-2xl shadow-sm overflow-hidden mb-6'>
                    {/* Gradient Banner */}
                    <div className='h-32 bg-gradient-to-r from-[#8b11dc] via-[#a915ff] to-[#7c3aed]'></div>
                    
                    {/* Profile Info */}
                    <div className='relative px-8 pb-6'>
                        {/* Avatar */}
                        <div className='absolute -top-16 left-8'>
                            <div className='w-32 h-32 rounded-full bg-gray-200 border-8 border-white shadow-xl flex items-center justify-center'>
                                <span className='text-5xl font-bold text-gray-400'>
                                    {user.name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            </div>
                            {/* Online Badge */}
                            <div className='absolute bottom-2 right-2 w-8 h-8 bg-[#8b11dc] rounded-full border-4 border-white flex items-center justify-center'>
                                <svg className='w-4 h-4 text-white' fill='currentColor' viewBox='0 0 20 20'>
                                    <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                                </svg>
                            </div>
                        </div>

                        {/* Header Actions */}
                        <div className='flex justify-end gap-3 pt-6'>
                            <button
                                onClick={handleSignOut}
                                className='px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2'
                            >
                                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
                                </svg>
                                Sign Out
                            </button>
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className='px-4 py-2 bg-[#8b11dc] hover:bg-[#7c3aed] text-white rounded-lg font-medium transition-colors duration-200'
                            >
                                Edit Profile
                            </button>
                        </div>

                        {/* User Info */}
                        <div className='mt-4'>
                            <h1 className='text-3xl font-bold text-gray-900 mb-2'>{user.name}</h1>
                            <div className='flex items-center gap-4 text-sm text-gray-600'>
                                <span className='flex items-center gap-1'>
                                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                                        <path fillRule='evenodd' d='M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z' clipRule='evenodd' />
                                    </svg>
                                    {user.role || 'Operations User'}
                                </span>
                                <span className='flex items-center gap-1'>
                                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                                        <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z' clipRule='evenodd' />
                                    </svg>
                                    Joined {createdDate}
                                </span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className='mt-6 border-b border-gray-200'>
                            <div className='flex gap-8'>
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`pb-3 px-1 font-medium transition-colors duration-200 border-b-2 ${
                                        activeTab === 'overview'
                                            ? 'text-[#8b11dc] border-[#8b11dc]'
                                            : 'text-gray-500 border-transparent hover:text-gray-700'
                                    }`}
                                >
                                    <span className='flex items-center gap-2'>
                                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
                                        </svg>
                                        Overview
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('security')}
                                    className={`pb-3 px-1 font-medium transition-colors duration-200 border-b-2 ${
                                        activeTab === 'security'
                                            ? 'text-[#8b11dc] border-[#8b11dc]'
                                            : 'text-gray-500 border-transparent hover:text-gray-700'
                                    }`}
                                >
                                    <span className='flex items-center gap-2'>
                                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
                                        </svg>
                                        Security
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`pb-3 px-1 font-medium transition-colors duration-200 border-b-2 ${
                                        activeTab === 'settings'
                                            ? 'text-[#8b11dc] border-[#8b11dc]'
                                            : 'text-gray-500 border-transparent hover:text-gray-700'
                                    }`}
                                >
                                    <span className='flex items-center gap-2'>
                                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                                        </svg>
                                        Settings
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                    {/* Left Sidebar - Contact Info */}
                    <div className='lg:col-span-1 space-y-6'>
                        {/* Contact Info Card */}
                        <div className='bg-white rounded-xl shadow-sm p-6'>
                            <h3 className='text-lg font-bold text-gray-900 mb-4'>Contact Info</h3>
                            <div className='space-y-4'>
                                {/* Email */}
                                <div className='flex items-start gap-3'>
                                    <div className='w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0'>
                                        <svg className='w-5 h-5 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
                                        </svg>
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-xs text-gray-500 uppercase font-medium mb-1'>Email</p>
                                        <p className='text-sm text-gray-900 font-medium break-all'>{user.email}</p>
                                        {user.emailVerified && (
                                            <span className='inline-flex items-center gap-1 mt-1 text-xs text-green-600 font-medium'>
                                                <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
                                                    <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
                                                </svg>
                                                Verified
                                            </span>
                                        )}
                                    </div>
                                </div>



                                {/* Account Role */}
                                <div className='flex items-start gap-3'>
                                    <div className='w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0'>
                                        <svg className='w-5 h-5 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' />
                                        </svg>
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-xs text-gray-500 uppercase font-medium mb-1'>Role</p>
                                        <p className='text-sm text-gray-900 font-semibold uppercase'>{user.role || 'Operations User'}</p>
                                    </div>
                                </div>

                                {/* Name */}
                                <div className='flex items-start gap-3'>
                                    <div className='w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0'>
                                        <svg className='w-5 h-5 text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
                                        </svg>
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-xs text-gray-500 uppercase font-medium mb-1'>Full Name</p>
                                        <p className='text-sm text-gray-900 font-medium'>{user.name}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Content - Account Overview */}
                    <div className='lg:col-span-2'>
                        {activeTab === 'overview' && (
                            <div className='bg-white rounded-xl shadow-sm p-6'>
                                <h3 className='text-lg font-bold text-gray-900 mb-6'>Account Overview</h3>
                                
                                {/* Stats Grid */}
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>


                                    {/* Account Role */}
                                    <div className='border border-gray-200 rounded-xl p-4'>
                                        <div className='flex items-center gap-2 mb-3'>
                                            <svg className='w-5 h-5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' />
                                            </svg>
                                            <span className='text-sm text-gray-600'>Account Role</span>
                                        </div>
                                        <p className='text-lg font-bold text-gray-900 uppercase'>{user.role || 'Operations User'}</p>
                                    </div>
                                </div>

                                {/* Recent Activity */}
                                <div>
                                    <h4 className='text-base font-bold text-gray-900 mb-4'>RECENT ACTIVITY</h4>
                                    <div className='space-y-3'>
                                        <div className='flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200'>
                                            <div className='flex items-center gap-3'>
                                                <div className='w-2 h-2 bg-[#8b11dc] rounded-full'></div>
                                                <div>
                                                    <p className='text-sm font-medium text-gray-900'>Account created</p>
                                                    <p className='text-xs text-gray-500'>{createdDate}</p>
                                                </div>
                                            </div>
                                            <svg className='w-5 h-5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                                            </svg>
                                        </div>
                                        <div className='flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200'>
                                            <div className='flex items-center gap-3'>
                                                <div className='w-2 h-2 bg-green-600 rounded-full'></div>
                                                <div>
                                                    <p className='text-sm font-medium text-gray-900'>Email {user.emailVerified ? 'verified' : 'not verified'}</p>
                                                    <p className='text-xs text-gray-500'>{user.email}</p>
                                                </div>
                                            </div>
                                            <svg className='w-5 h-5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                                            </svg>
                                        </div>
                                        <div className='flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200'>
                                            <div className='flex items-center gap-3'>
                                                <div className='w-2 h-2 bg-purple-600 rounded-full'></div>
                                                <div>
                                                    <p className='text-sm font-medium text-gray-900'>Role assigned: {user.role || 'Operations User'}</p>
                                                    <p className='text-xs text-gray-500'>Account type set</p>
                                                </div>
                                            </div>
                                            <svg className='w-5 h-5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className='bg-white rounded-xl shadow-sm p-6'>
                                <h3 className='text-lg font-bold text-gray-900 mb-4'>Security Settings</h3>
                                <p className='text-gray-600'>Manage your password and security preferences.</p>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className='bg-white rounded-xl shadow-sm p-6'>
                                <h3 className='text-lg font-bold text-gray-900 mb-4'>Account Settings</h3>
                                <p className='text-gray-600'>Configure your account preferences and notifications.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ProfilePage
