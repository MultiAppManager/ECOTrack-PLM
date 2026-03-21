'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────
type Component = { name: string; qty: number; unit: string; notes?: string }

type Bom = {
    id: string; bomCode: string; name: string; productCode: string
    version: number; components: Component[]; notes: string | null
    status: 'Active' | 'Archived'; isLatest: boolean
    createdAt: string; updatedAt: string
}

type ProductOption = { id: string; productCode: string; name: string; version: number }

type FormState = {
    name: string; productCode: string; notes: string
    components: Component[]
}

const EMPTY_FORM: FormState = { name: '', productCode: '', notes: '', components: [] }

// ─── Main ──────────────────────────────────────────────────────────────────────
type Props = { userRole: string; canWrite: boolean }

const BomClient = ({ canWrite, userRole }: Props) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

    const [boms, setBoms]               = useState<Bom[]>([])
    const [isLoading, setIsLoading]     = useState(true)
    const [searchTerm, setSearchTerm]   = useState('')
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Archived'>('All')
    /** When true (default), API returns only the current Active + Latest row per BOM — always in sync with DB. */
    const [showLatestOnly, setShowLatestOnly] = useState(true)

    // Modals
    const [showCreate, setShowCreate]   = useState(false)
    const [editBom, setEditBom]         = useState<Bom | null>(null)
    const [detailBom, setDetailBom]     = useState<Bom | null>(null)
    const [archiveTarget, setArchiveTarget] = useState<Bom | null>(null)

    // Version history panel
    const [versionHistory, setVersionHistory] = useState<Bom[]>([])
    const [loadingVersions, setLoadingVersions] = useState(false)

    // Form
    const [form, setForm]               = useState<FormState>(EMPTY_FORM)
    const [isSaving, setIsSaving]       = useState(false)

    // Product dropdown for BOM form
    const [productOptions, setProductOptions] = useState<ProductOption[]>([])

    const [bomStats, setBomStats] = useState<{ latestActive: number; archivedRows: number }>({
        latestActive: 0,
        archivedRows: 0,
    })

    // ─── Fetch BOMs (live from DB; default = latest active revision only) ────────
    const fetchBoms = useCallback(async () => {
        setIsLoading(true)
        try {
            const scope = canWrite && !showLatestOnly ? 'all' : 'latest'
            const url =
                scope === 'all'
                    ? `${API_BASE}/api/boms?scope=all`
                    : `${API_BASE}/api/boms`
            const res = await fetch(url, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch BOMs')
            const data: any[] = await res.json()
            setBoms(
                data.map((b) => ({
                    ...b,
                    components: Array.isArray(b.components) ? b.components : [],
                }))
            )
        } catch {
            toast.error('Failed to load BOMs')
        } finally {
            setIsLoading(false)
        }
    }, [API_BASE, canWrite, showLatestOnly])

    const fetchBomStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/boms/stats`, {
                credentials: 'include',
            })
            if (!res.ok) return
            const data = await res.json()
            setBomStats({
                latestActive: Number(data.latestActive) || 0,
                archivedRows: Number(data.archivedRows) || 0,
            })
        } catch {
            /* silent */
        }
    }, [API_BASE])

    const fetchProductOptions = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/products/active-latest`, { credentials: 'include' })
            if (res.ok) setProductOptions(await res.json())
        } catch { /* silent */ }
    }, [API_BASE])

    useEffect(() => {
        fetchBoms()
        fetchProductOptions()
        fetchBomStats()
    }, [fetchBoms, fetchProductOptions, fetchBomStats])

    // Refresh when tab becomes visible + periodic refresh (live data)
    useEffect(() => {
        const onVis = () => {
            if (document.visibilityState === 'visible') {
                fetchBoms()
                fetchBomStats()
            }
        }
        document.addEventListener('visibilitychange', onVis)
        const t = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchBoms()
                fetchBomStats()
            }
        }, 45_000)
        return () => {
            document.removeEventListener('visibilitychange', onVis)
            window.clearInterval(t)
        }
    }, [fetchBoms, fetchBomStats])

    // ─── Version history ────────────────────────────────────────────────────────
    const loadVersionHistory = async (bomCode: string) => {
        setLoadingVersions(true)
        try {
            const res = await fetch(`${API_BASE}/api/boms/${bomCode}/versions`, { credentials: 'include' })
            if (res.ok) setVersionHistory(await res.json())
        } catch { /* silent */ } finally {
            setLoadingVersions(false)
        }
    }

    useEffect(() => {
        if (detailBom) loadVersionHistory(detailBom.bomCode)
        else setVersionHistory([])
    }, [detailBom?.bomCode])

    // ─── Filtered ───────────────────────────────────────────────────────────────
    const filtered = boms.filter(b => {
        const matchSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            b.bomCode.toLowerCase().includes(searchTerm.toLowerCase())
        const matchStatus = statusFilter === 'All' || b.status === statusFilter
        const matchLatest = !showLatestOnly || b.isLatest
        return matchSearch && matchStatus && matchLatest
    })

    // ─── Component helpers ──────────────────────────────────────────────────────
    const addComponent = () =>
        setForm(f => ({ ...f, components: [...f.components, { name: '', qty: 1, unit: 'pcs', notes: '' }] }))

    const updateComponent = (i: number, key: keyof Component, val: string | number) =>
        setForm(f => ({ ...f, components: f.components.map((c, idx) => idx === i ? { ...c, [key]: val } : c) }))

    const removeComponent = (i: number) =>
        setForm(f => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }))

    // ─── Create ──────────────────────────────────────────────────────────────────
    const openCreate = () => { setForm(EMPTY_FORM); setShowCreate(true) }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) { toast.error('BOM name is required'); return }
        setIsSaving(true)
        try {
            const res = await fetch(`${API_BASE}/api/boms`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name.trim(), productCode: form.productCode, notes: form.notes || null, components: form.components }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Create failed')
            toast.success('BOM created successfully')
            setShowCreate(false)
            fetchBoms()
            fetchBomStats()
        } catch (e: any) { toast.error(e.message) } finally { setIsSaving(false) }
    }

    // ─── Edit ────────────────────────────────────────────────────────────────────
    const openEdit = (b: Bom) => {
        setForm({ name: b.name, productCode: b.productCode, notes: b.notes || '', components: b.components })
        setEditBom(b); setDetailBom(null)
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editBom || !form.name.trim()) { toast.error('BOM name required'); return }
        setIsSaving(true)
        try {
            const res = await fetch(`${API_BASE}/api/boms/${editBom.id}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name.trim(), productCode: form.productCode, notes: form.notes || null, components: form.components }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Update failed')
            toast.success('BOM updated')
            setEditBom(null)
            fetchBoms()
            fetchBomStats()
        } catch (e: any) { toast.error(e.message) } finally { setIsSaving(false) }
    }

    // ─── Archive ─────────────────────────────────────────────────────────────────
    const handleStatusToggle = async (b: Bom) => {
        const newStatus = b.status === 'Active' ? 'Archived' : 'Active'
        try {
            const res = await fetch(`${API_BASE}/api/boms/${b.id}/status`, {
                method: 'PATCH', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')
            toast.success(`BOM ${newStatus === 'Archived' ? 'archived' : 'restored'}`)
            setArchiveTarget(null)
            setDetailBom(null)
            fetchBoms()
            fetchBomStats()
        } catch (e: any) { toast.error(e.message) }
    }

    const archivedCount = bomStats.archivedRows
    const totalLatestCount = bomStats.latestActive

    return (
        <div className='flex-1 bg-white min-h-screen'>
            {/* Top bar */}
            <div className='px-8 pt-7 pb-4 flex items-center justify-between border-b border-gray-100'>
                <div>
                    <h1 className='text-2xl font-bold text-[#7c3aed]'>Bills of Materials</h1>
                    <p className='text-xs text-gray-500 mt-1'>
                        Live data from the database — shows the current Active revision for each BOM (auto-refreshes).
                    </p>
                </div>
                {canWrite && (
                    <button onClick={openCreate}
                        className='flex items-center gap-2 px-5 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm transition-colors shadow-sm'>
                        <span className='text-base font-bold'>+</span> New
                    </button>
                )}
            </div>

            <div className='px-8 py-6 space-y-5'>
                {/* Stats */}
                <div className='flex items-center gap-4'>
                    {[
                        {
                            label: 'Total BOMs',
                            value: totalLatestCount,
                            color: 'text-[#7c3aed]',
                            f: 'All' as const,
                        },
                        {
                            label: 'Active (latest)',
                            value: totalLatestCount,
                            color: 'text-emerald-600',
                            f: 'Active' as const,
                        },
                        {
                            label: 'Archived versions',
                            value: archivedCount,
                            color: 'text-gray-500',
                            f: 'Archived' as const,
                        },
                    ].map((s) => (
                        <button key={s.label} onClick={() => setStatusFilter(s.f)}
                            className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 transition-all duration-150 cursor-pointer text-left ${statusFilter === s.f ? 'border-[#7c3aed] bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50/40'}`}>
                            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                            <span className='text-xs text-gray-500 font-medium'>{s.label}</span>
                        </button>
                    ))}
                    {canWrite && (
                        <label className='flex items-center gap-2 ml-auto text-sm text-gray-600 cursor-pointer select-none'>
                            <input
                                type='checkbox'
                                checked={showLatestOnly}
                                onChange={(e) => setShowLatestOnly(e.target.checked)}
                                className='accent-purple-600 w-4 h-4'
                            />
                            <span title='Uncheck to load all stored revisions (incl. archived) for audit'>
                                Latest active only
                            </span>
                        </label>
                    )}
                </div>

                {/* Search + filter */}
                <div className='flex items-center gap-3'>
                    <input type='text' placeholder='Search by name or BOM code…' value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className='flex-1 border-2 border-purple-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition' />
                    <div className='flex gap-2'>
                        {(['All', 'Active', 'Archived'] as const).map(f => (
                            <button key={f} onClick={() => setStatusFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${statusFilter === f ? 'bg-[#7c3aed] text-white border-[#7c3aed]' : 'bg-white text-gray-600 border-gray-300 hover:border-purple-300 hover:text-purple-700'}`}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className='rounded-2xl border-2 border-purple-100 overflow-hidden'>
                    <table className='w-full'>
                        <thead>
                            <tr className='border-b-2 border-purple-100'>
                                <th className='text-left px-5 py-3.5 text-sm font-bold text-[#7c3aed]'>BOM Code</th>
                                <th className='text-left px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>BOM Name</th>
                                <th className='text-left px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Linked Product</th>
                                <th className='text-center px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Version</th>
                                <th className='text-center px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Components</th>
                                <th className='text-center px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Status</th>
                                <th className='text-center px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} className='py-14 text-center'>
                                    <div className='flex flex-col items-center gap-3'>
                                        <div className='w-7 h-7 border-2 border-purple-200 border-t-[#7c3aed] rounded-full animate-spin' />
                                        <p className='text-gray-400 text-sm'>Loading BOMs…</p>
                                    </div>
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className='py-14 text-center'>
                                    <p className='text-gray-400 text-sm'>No BOMs found.</p>
                                    {canWrite && searchTerm === '' && statusFilter === 'All' && (
                                        <button onClick={openCreate} className='mt-3 text-[#7c3aed] text-sm font-semibold hover:underline'>
                                            + Create your first BOM
                                        </button>
                                    )}
                                </td></tr>
                            ) : (
                                filtered.map(b => (
                                    <tr key={b.id} className={`border-b border-gray-100 transition-colors group ${b.status === 'Archived' ? 'bg-gray-50' : 'hover:bg-purple-50/30'}`}>
                                        <td className='px-5 py-3'>
                                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200'>
                                                {b.bomCode}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3'>
                                            <button onClick={() => setDetailBom(b)}
                                                className={`text-sm font-medium text-left hover:underline ${b.status === 'Archived' ? 'text-gray-400 line-through' : 'text-gray-800 hover:text-[#7c3aed]'}`}>
                                                {b.name}
                                            </button>
                                            {!b.isLatest && (
                                                <span className='ml-2 text-[9px] text-gray-400 border border-gray-200 rounded px-1'>older</span>
                                            )}
                                        </td>
                                        <td className='px-4 py-3 text-sm text-gray-500'>
                                            {b.productCode || <span className='text-gray-300'>—</span>}
                                        </td>
                                        <td className='px-4 py-3 text-center'>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${b.isLatest ? 'bg-purple-100 text-[#7c3aed] border-purple-200' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                                                v{b.version}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 text-center'>
                                            <span className='text-sm font-semibold text-gray-600'>{b.components.length}</span>
                                            <span className='text-xs text-gray-400 ml-1'>items</span>
                                        </td>
                                        <td className='px-4 py-3 text-center'>
                                            <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold border ${b.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                                                {b.status}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3'>
                                            <div className='flex items-center justify-center gap-1.5'>
                                                <button onClick={() => setDetailBom(b)}
                                                    className='px-3 py-1 rounded-lg text-xs font-semibold border border-purple-300 text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white transition-all'>
                                                    View
                                                </button>
                                                {canWrite && b.status === 'Active' && b.isLatest && (
                                                    <button onClick={() => openEdit(b)}
                                                        className='px-3 py-1 rounded-lg text-xs font-semibold border border-indigo-300 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all'>
                                                        Edit
                                                    </button>
                                                )}
                                                {canWrite && b.isLatest && (
                                                    <button onClick={() => setArchiveTarget(b)}
                                                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${b.status === 'Active' ? 'border-orange-300 text-orange-600 hover:bg-orange-500 hover:text-white' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-500 hover:text-white'}`}>
                                                        {b.status === 'Active' ? 'Archive' : 'Restore'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!isLoading && filtered.length > 0 && (
                    <p className='text-xs text-gray-400 text-right'>{filtered.length} record{filtered.length !== 1 ? 's' : ''} shown</p>
                )}
            </div>

            {/* ══ DETAIL MODAL ══ */}
            {detailBom && (
                <div className='fixed inset-0 z-50 flex items-start justify-center p-4 pt-12' style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setDetailBom(null)}>
                    <div className='bg-white rounded-2xl shadow-2xl border-2 border-purple-100 w-full max-w-2xl max-h-[85vh] overflow-y-auto' onClick={e => e.stopPropagation()}>
                        <div className='sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-purple-100 flex items-center justify-between z-10 rounded-t-2xl'>
                            <div>
                                <div className='flex items-center gap-2'>
                                    <span className='text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5'>{detailBom.bomCode}</span>
                                    <h3 className={`text-lg font-bold ${detailBom.status === 'Archived' ? 'text-gray-400 line-through' : 'text-[#7c3aed]'}`}>{detailBom.name}</h3>
                                    <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${detailBom.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>{detailBom.status}</span>
                                </div>
                                <p className='text-xs text-gray-400 mt-0.5'>Version v{detailBom.version} · {detailBom.isLatest ? 'Latest' : 'Older version'} · Created {new Date(detailBom.createdAt).toLocaleDateString('en-IN')}</p>
                            </div>
                            <button onClick={() => setDetailBom(null)} className='w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-400 hover:bg-gray-100 text-xl'>×</button>
                        </div>
                        <div className='px-6 py-5 space-y-5'>
                            {detailBom.status === 'Archived' && (
                                <div className='flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700'>
                                    ⚠️ <span>This BOM is <strong>archived</strong> — read-only, not selectable in new ECOs.</span>
                                </div>
                            )}
                            {detailBom.productCode && (
                                <div className='p-3 bg-purple-50 border border-purple-200 rounded-xl'>
                                    <p className='text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5'>Linked Product</p>
                                    <p className='text-sm font-bold text-[#7c3aed]'>{detailBom.productCode}</p>
                                </div>
                            )}
                            {detailBom.notes && (
                                <div>
                                    <p className='text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1'>Notes</p>
                                    <p className='text-sm text-gray-600'>{detailBom.notes}</p>
                                </div>
                            )}

                            {/* Components */}
                            <div>
                                <p className='text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2'>Components ({detailBom.components.length})</p>
                                {detailBom.components.length === 0 ? (
                                    <p className='text-sm text-gray-400 italic'>No components defined</p>
                                ) : (
                                    <div className='rounded-xl border border-purple-200 overflow-hidden'>
                                        <table className='w-full text-sm'>
                                            <thead className='bg-purple-50 border-b border-purple-100'>
                                                <tr>
                                                    <th className='text-left px-4 py-2 text-xs font-semibold text-purple-800'>#</th>
                                                    <th className='text-left px-4 py-2 text-xs font-semibold text-purple-800'>Component</th>
                                                    <th className='text-center px-4 py-2 text-xs font-semibold text-purple-800'>Qty</th>
                                                    <th className='text-center px-4 py-2 text-xs font-semibold text-purple-800'>Unit</th>
                                                    <th className='text-left px-4 py-2 text-xs font-semibold text-purple-800'>Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detailBom.components.map((c, i) => (
                                                    <tr key={i} className='border-t border-purple-50 hover:bg-purple-50/30'>
                                                        <td className='px-4 py-2 text-xs text-gray-400'>{i+1}</td>
                                                        <td className='px-4 py-2 font-medium text-gray-800'>{c.name}</td>
                                                        <td className='px-4 py-2 text-center text-gray-700'>{c.qty}</td>
                                                        <td className='px-4 py-2 text-center text-gray-500'>{c.unit}</td>
                                                        <td className='px-4 py-2 text-gray-400 text-xs'>{c.notes || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Version history */}
                            {(versionHistory.length > 1 || loadingVersions) && (
                                <div>
                                    <p className='text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2'>
                                        <span className='w-2 h-2 rounded-full bg-indigo-400 inline-block' />
                                        Version History ({versionHistory.length} versions)
                                    </p>
                                    {loadingVersions ? (
                                        <p className='text-xs text-gray-400 animate-pulse'>Loading…</p>
                                    ) : (
                                        <div className='rounded-xl border border-indigo-200 overflow-hidden'>
                                            <table className='w-full text-xs'>
                                                <thead className='bg-indigo-50 border-b border-indigo-100'>
                                                    <tr>
                                                        <th className='text-left px-3 py-2 font-semibold text-indigo-800'>Version</th>
                                                        <th className='text-center px-3 py-2 font-semibold text-indigo-800'>Components</th>
                                                        <th className='text-center px-3 py-2 font-semibold text-indigo-800'>Status</th>
                                                        <th className='text-left px-3 py-2 font-semibold text-indigo-800'>Created</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {versionHistory.map((v, i) => (
                                                        <tr key={v.id} className={`border-t border-indigo-50 ${i === 0 ? 'bg-indigo-50/40' : ''}`}>
                                                            <td className='px-3 py-2 font-bold text-indigo-700'>
                                                                v{v.version}
                                                                {v.isLatest && <span className='ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-semibold'>LATEST</span>}
                                                            </td>
                                                            <td className='px-3 py-2 text-center text-gray-700'>{Array.isArray(v.components) ? v.components.length : 0}</td>
                                                            <td className='px-3 py-2 text-center'>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${v.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{v.status}</span>
                                                            </td>
                                                            <td className='px-3 py-2 text-gray-500'>{new Date(v.createdAt).toLocaleDateString('en-IN')}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className='px-6 pb-5 flex gap-2'>
                            {canWrite && detailBom.status === 'Active' && detailBom.isLatest && (
                                <button onClick={() => openEdit(detailBom)} className='flex-1 py-2.5 rounded-xl border-2 border-[#7c3aed] text-[#7c3aed] font-semibold text-sm hover:bg-purple-50 transition-colors'>Edit</button>
                            )}
                            {canWrite && detailBom.isLatest && (
                                <button onClick={() => { setArchiveTarget(detailBom); setDetailBom(null) }}
                                    className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm transition-colors ${detailBom.status === 'Active' ? 'border-orange-300 text-orange-600 hover:bg-orange-50' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>
                                    {detailBom.status === 'Active' ? 'Archive' : 'Restore'}
                                </button>
                            )}
                            <button onClick={() => setDetailBom(null)} className='flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50'>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ CREATE / EDIT MODAL ══ */}
            {(showCreate || editBom) && (
                <div className='fixed inset-0 z-50 flex items-start justify-center p-4 pt-8' style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowCreate(false); setEditBom(null) }}>
                    <div className='bg-white rounded-2xl shadow-2xl border-2 border-purple-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto' onClick={e => e.stopPropagation()}>
                        <div className='sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-purple-100 flex items-center justify-between z-10 rounded-t-2xl'>
                            <div>
                                <h3 className='text-lg font-bold text-[#7c3aed]'>{editBom ? 'Edit BOM' : 'New Bill of Materials'}</h3>
                                <p className='text-xs text-gray-400 mt-0.5'>Version is managed automatically via ECO approvals.</p>
                            </div>
                            <button onClick={() => { setShowCreate(false); setEditBom(null) }} className='w-8 h-8 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-400 hover:bg-gray-100 text-xl'>×</button>
                        </div>
                        <form onSubmit={editBom ? handleUpdate : handleCreate} className='px-6 py-5 space-y-5'>
                            <div className='grid grid-cols-2 gap-4'>
                                <div className='col-span-2'>
                                    <label className='block text-sm font-semibold text-gray-700 mb-1.5'>BOM Name <span className='text-red-500'>*</span></label>
                                    <input type='text' maxLength={255} required placeholder='e.g. Pump Housing Kit'
                                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        className='w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400' />
                                </div>
                                <div className='col-span-2'>
                                    <label className='block text-sm font-semibold text-gray-700 mb-1.5'>Linked Product <span className='text-gray-400 font-normal text-xs ml-1'>(optional)</span></label>
                                    <select value={form.productCode} onChange={e => setForm(f => ({ ...f, productCode: e.target.value }))}
                                        className='w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400'>
                                        <option value=''>— Not linked to a product —</option>
                                        {productOptions.map(p => (
                                            <option key={p.id} value={p.productCode}>{p.productCode} · {p.name} (v{p.version})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className='col-span-2'>
                                    <label className='block text-sm font-semibold text-gray-700 mb-1.5'>Notes</label>
                                    <input type='text' placeholder='Optional notes about this BOM…'
                                        value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        className='w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400' />
                                </div>
                            </div>

                            {/* Components */}
                            <div>
                                <div className='flex items-center justify-between mb-2'>
                                    <label className='block text-sm font-semibold text-gray-700'>Components</label>
                                    <button type='button' onClick={addComponent}
                                        className='text-sm text-[#7c3aed] font-semibold hover:underline flex items-center gap-1'>
                                        + Add Component
                                    </button>
                                </div>
                                {form.components.length === 0 ? (
                                    <button type='button' onClick={addComponent}
                                        className='w-full py-4 border-2 border-dashed border-purple-200 rounded-xl text-sm text-gray-400 hover:border-purple-400 hover:text-[#7c3aed] transition-all'>
                                        + Click to add components
                                    </button>
                                ) : (
                                    <div className='rounded-xl border border-purple-200 overflow-hidden'>
                                        <table className='w-full text-sm'>
                                            <thead className='bg-purple-50 border-b border-purple-100'>
                                                <tr>
                                                    <th className='text-left px-3 py-2 text-xs font-semibold text-purple-800'>Component Name</th>
                                                    <th className='text-center px-2 py-2 text-xs font-semibold text-purple-800 w-20'>Qty</th>
                                                    <th className='text-center px-2 py-2 text-xs font-semibold text-purple-800 w-24'>Unit</th>
                                                    <th className='text-left px-3 py-2 text-xs font-semibold text-purple-800'>Notes</th>
                                                    <th className='w-8' />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {form.components.map((c, i) => (
                                                    <tr key={i} className='border-t border-purple-50'>
                                                        <td className='px-2 py-1.5'>
                                                            <input type='text' placeholder='Component name' required value={c.name} onChange={e => updateComponent(i, 'name', e.target.value)}
                                                                className='w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300' />
                                                        </td>
                                                        <td className='px-1 py-1.5'>
                                                            <input type='number' min='0' step='0.01' value={c.qty} onChange={e => updateComponent(i, 'qty', parseFloat(e.target.value)||0)}
                                                                className='w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-300' />
                                                        </td>
                                                        <td className='px-1 py-1.5'>
                                                            <select value={c.unit} onChange={e => updateComponent(i, 'unit', e.target.value)}
                                                                className='w-full border border-gray-200 rounded-lg px-1 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-300'>
                                                                {['pcs','m','m²','m³','kg','g','L','ml','set','lot'].map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className='px-1 py-1.5'>
                                                            <input type='text' placeholder='Optional' value={c.notes||''} onChange={e => updateComponent(i, 'notes', e.target.value)}
                                                                className='w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300' />
                                                        </td>
                                                        <td className='px-1 py-1.5 text-center'>
                                                            <button type='button' onClick={() => removeComponent(i)} className='text-red-400 hover:text-red-600 text-lg leading-none'>×</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className='flex gap-3 pt-2 border-t border-gray-100'>
                                <button type='button' onClick={() => { setShowCreate(false); setEditBom(null) }}
                                    className='flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50'>Cancel</button>
                                <button type='submit' disabled={isSaving}
                                    className='flex-1 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm shadow-md disabled:opacity-50'>
                                    {isSaving ? 'Saving…' : editBom ? 'Save Changes' : 'Create BOM'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══ ARCHIVE CONFIRM ══ */}
            {archiveTarget && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4' style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setArchiveTarget(null)}>
                    <div className='bg-white rounded-2xl shadow-2xl border-2 border-orange-200 w-full max-w-sm p-6' onClick={e => e.stopPropagation()}>
                        <div className='text-center space-y-3'>
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl ${archiveTarget.status === 'Active' ? 'bg-orange-100' : 'bg-emerald-100'}`}>
                                {archiveTarget.status === 'Active' ? '📦' : '♻️'}
                            </div>
                            <h3 className='text-lg font-bold text-gray-800'>{archiveTarget.status === 'Active' ? 'Archive BOM?' : 'Restore BOM?'}</h3>
                            <p className='text-sm text-gray-500'>
                                {archiveTarget.status === 'Active'
                                    ? <><strong>{archiveTarget.name}</strong> will become read-only and hidden from new ECOs.</>
                                    : <><strong>{archiveTarget.name}</strong> will be restored to Active status.</>}
                            </p>
                        </div>
                        <div className='flex gap-2 mt-5'>
                            <button onClick={() => setArchiveTarget(null)} className='flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50'>Cancel</button>
                            <button onClick={() => handleStatusToggle(archiveTarget)}
                                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm text-white shadow-sm ${archiveTarget.status === 'Active' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                {archiveTarget.status === 'Active' ? 'Archive' : 'Restore'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default BomClient
