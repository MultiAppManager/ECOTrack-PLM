'use client'
import React from 'react'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const Sidebar = () => {
    const router = useRouter()
    const pathname = usePathname()
    const [user, setUser] = useState({ id: '', name: '', email: '', role: '' })
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        const fetchSession = async () => {
            const session = await authClient.getSession()
            if (session.data?.user) {
                const userData = session.data.user
                setUser({
                    id: userData.id || '',
                    name: userData.name || '',
                    email: userData.email || '',
                    role: (userData as { role?: string }).role || 'Operations User'
                })
            }
            setIsLoaded(true)
        }
        fetchSession()
    }, [])

    const handleSignOut = async () => {
        const { error } = await authClient.signOut()
        if (error) {
            toast.error(error.message || 'Something went wrong')
        } else {
            toast.success('Signed out successfully')
            router.push('/')
        }
    }

    const isAdmin = user.role === 'Admin'
    const isEngineeringUser = user.role === 'Engineering User'
    const isApprover = user.role === 'Approver'
    const isOperationsUser = user.role === 'Operations User'

    const menuItems: Array<{ label: string; href: string; show: boolean; enabled?: boolean }> = [
        { label: 'Dashboard', href: '/dashboard', show: true, enabled: true },
        { label: 'Products', href: '/products', show: isEngineeringUser || isOperationsUser || isAdmin, enabled: true },
        { label: 'Bills of Materials', href: '/bom', show: isEngineeringUser || isOperationsUser || isAdmin, enabled: true },
        { label: 'Engineering Change Orders (ECO)', href: '/eco', show: true, enabled: true },
        { label: 'Reports', href: '/reports', show: true, enabled: true },
        { label: 'ECO Stages', href: '/eco-stages', show: isAdmin, enabled: true },
    ]
    return (
        <>
            {/* Left navigation panel */}
            <aside className='w-64 h-screen sticky top-0 bg-[#060d22] text-white border-r border-[#10274f] flex flex-col'>
                <div className='bg-gradient-to-b from-[#8b11dc] to-[#a915ff] px-3 py-3 border-b border-white/10'>
                    {/* User summary */}
                    <div className='bg-white/10 border border-white/20 rounded-2xl p-2.5 shadow-sm'>
                        <div className='flex items-center gap-2.5'>
                            <div className='w-10 h-10 rounded-full bg-white/15 border border-white/30 flex items-center justify-center overflow-hidden'>
                                <Image src='/plm-logo.svg' alt='PLM Logo' width={22} height={22} />
                            </div>
                            <div className='min-w-0'>
                                <p className='font-semibold text-sm leading-tight truncate text-white'>{user.name || 'User'}</p>
                                <p className='text-[11px] text-white/80 truncate'>
                                    {user.email ? user.email : 'Email: -'}
                                </p>
                            </div>
                        </div>

                        <div className='mt-2.5 flex items-center justify-between gap-2'>
                            <p className='text-[11px] text-white/80 truncate'>ID: {user.id || '-'}</p>
                            <div className='inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#b23de8] border border-[#d07aff]/40 text-[11px] font-semibold text-yellow-200'>
                                {user.role || 'Operations User'}
                            </div>
                        </div>
                    </div>
                </div>

                <nav className='flex-1 px-2 py-3'>
                    <div className='space-y-1.5'>
                        {menuItems
                            .filter((item) => item.show)
                            .map((item) =>
                                item.enabled ? (
                                    <button
                                        key={item.label}
                                        type='button'
                                        onClick={() => router.push(item.href)}
                                        className={[
                                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2d5fb4]',
                                            pathname === item.href || pathname.startsWith(item.href + '/')
                                                ? 'bg-[#131f3a] text-white border border-[#1f3c73]'
                                                : 'text-white/85 hover:bg-[#0f1a32]',
                                        ].join(' ')}
                                    >
                                        <span className='w-4 h-4 rounded-full border border-white/70' />
                                        <span className='font-medium text-sm'>{item.label}</span>
                                    </button>
                                ) : (
                                    <button
                                        key={item.label}
                                        type='button'
                                        onClick={() => toast.info(`${item.label} is coming soon`)}
                                        className='w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-white/75 hover:bg-[#0f1a32] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2d5fb4]'
                                    >
                                        <span className='w-4 h-4 rounded-full border border-white/70' />
                                        <span className='font-medium text-sm'>{item.label}</span>
                                    </button>
                                )
                            )}
                    </div>

                    <div className='mt-4 pt-3 border-t border-[#1b2d55] space-y-1.5'>
                        <Link
                            href='/profile'
                            className={[
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-white/85 hover:bg-[#0f1a32]',
                                pathname === '/profile' ? 'bg-[#131f3a] text-white border border-[#1f3c73]' : '',
                            ].join(' ')}
                        >
                            <span className='w-4 h-4 rounded-full border border-white/70' />
                            <span className='font-medium text-sm'>Profile</span>
                        </Link>

                        {isAdmin && (
                            <Link
                                href='/admin'
                                className={[
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-white/85 hover:bg-[#0f1a32]',
                                    pathname === '/admin' ? 'bg-[#131f3a] text-white border border-[#1f3c73]' : '',
                                ].join(' ')}
                            >
                                <span className='w-4 h-4 rounded-full border border-white/70' />
                                <span className='font-medium text-sm'>Manager Dashboard</span>
                            </Link>
                        )}
                    </div>
                </nav>

                <div className='px-2 pb-3'>
                    <button
                        onClick={handleSignOut}
                        className='w-full flex items-center gap-3 px-3 py-2.5 text-[#ff5a6e] hover:bg-[#0f1a32] transition-colors duration-200 text-left rounded-lg'
                    >
                        <span className='w-4 h-4 rounded-full border border-[#ff5a6e]' />
                        <span className='font-semibold text-sm'>Logout</span>
                    </button>
                </div>

                {/* Small note to help the user if the role isn't loaded yet */}
                {!isLoaded && (
                    <div className='px-4 pb-3 text-xs text-gray-400'>
                        Loading...
                    </div>
                )}
            </aside>
        </>
    )
}

export default Sidebar
