'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────
type DashboardClientProps = { userName: string; userRole: string; canCreateEco: boolean }
type EcoStatus = 'Draft' | 'Reviewed' | 'Rejected' | 'Approved'

type EcoRecord = {
    id: string; ecoCode: string; title: string; ecoType: string
    product: string; bom: string; productId?: string; bomId?: string
    user: string; effectiveDate: string; versionUpdate: boolean
    status: EcoStatus; changes: any
    stageId?: string; stageStatus?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge: Record<string, string> = {
    Draft:    'bg-white border border-gray-300 text-gray-700',
    Reviewed: 'bg-blue-50 border border-blue-300 text-blue-700',
    Approved: 'bg-green-50 border border-green-300 text-green-700 font-bold',
    Rejected: 'bg-red-50 border border-red-300 text-red-700',
}
// ─── Main ──────────────────────────────────────────────────────────────────────
const DashboardClient = ({ userName, userRole, canCreateEco }: DashboardClientProps) => {
    const router = useRouter()
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

    const [ecoRecords, setEcoRecords]       = useState<EcoRecord[]>([])
    const [isLoading, setIsLoading]         = useState(true)
    const [searchTerm, setSearchTerm]       = useState('')

    // ─── Fetch ECO records ──────────────────────────────────────────────────────
    const loadEcoRequests = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/eco-requests`, { credentials: 'include' })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Failed to fetch')
            setEcoRecords((data as any[]).map(item => ({
                id: item.id, ecoCode: item.ecoCode, title: item.title,
                ecoType: item.ecoType, product: item.product, bom: item.bom,
                productId: item.productId, bomId: item.bomId,
                user: item.requestedBy, effectiveDate: item.effectiveDate || '',
                versionUpdate: Boolean(item.versionUpdate),
                status: (item.status || 'Draft') as EcoStatus,
                changes: item.changes,
                stageId: item.stageId,
                stageStatus: item.stageStatus,
            })))
        } catch (e: any) {
            toast.error(e.message || 'Failed to load ECO requests')
        } finally {
            setIsLoading(false)
        }
    }, [API_BASE])

    useEffect(() => { loadEcoRequests() }, [loadEcoRequests])

    const filtered = ecoRecords.filter(r =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.product.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // ─── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className='flex-1 bg-white min-h-screen'>
            {/* Top bar */}
            <div className='px-8 pt-7 pb-4 flex items-center justify-between border-b border-gray-100'>
                <h1 className='text-2xl font-bold text-[#7c3aed]'>Engineering Change Orders (ECO&apos;s)</h1>
                <div className='w-8 h-8 rounded-full border border-purple-300 flex items-center justify-center text-purple-600 text-sm font-bold'>
                    {userName?.charAt(0).toUpperCase() || 'U'}
                </div>
            </div>

            <div className='px-8 py-5 space-y-5'>
                {/* Toolbar */}
                <div className='flex items-center gap-3'>
                    {canCreateEco && (
                        <button onClick={() => router.push('/eco/new')}
                            className='px-5 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm transition-colors shadow-sm'>
                            New
                        </button>
                    )}
                    <input type='text' placeholder='Search Bar' value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className='flex-1 border-2 border-purple-300 px-4 py-2 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 transition' />
                    <button className='px-4 py-2 rounded-lg border-2 border-purple-300 text-purple-700 text-sm font-semibold bg-white hover:bg-purple-50'>Filters</button>
                </div>

                {/* ── ECO Table ── */}
                <div className='rounded-2xl border-2 border-purple-100 overflow-hidden'>
                    <table className='w-full'>
                        <thead>
                            <tr className='border-b-2 border-purple-100'>
                                <th className='text-left px-5 py-3.5 text-sm font-bold text-[#7c3aed]'>Name</th>
                                <th className='text-left px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>ECO Type</th>
                                <th className='text-left px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Product</th>
                                <th className='text-left px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={4} className='py-12 text-center text-sm text-gray-400'>Loading ECO records…</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={4} className='py-12 text-center text-sm text-gray-400'>No ECO records yet.</td></tr>
                            ) : (
                                filtered.map(record => (
                                    <tr key={record.id}
                                        onClick={() => router.push(`/eco/${record.id}`)}
                                        className='border-b border-gray-100 cursor-pointer transition-colors hover:bg-purple-50/40'>
                                        <td className='px-5 py-3 text-sm text-gray-800 font-medium'>{record.title}</td>
                                        <td className='px-4 py-3 text-sm text-gray-600'>{record.ecoType}</td>
                                        <td className='px-4 py-3 text-sm text-gray-600'>{record.product}</td>
                                        <td className='px-4 py-3 text-sm'>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge[record.status]||''}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!canCreateEco && (
                    <div className='rounded-xl border border-purple-200 p-4 text-sm text-gray-600 bg-purple-50/30'>
                        Your role (<span className='font-semibold'>{userRole}</span>) has view-only access.
                    </div>
                )}
            </div>
        </div>
    )
}

export default DashboardClient
