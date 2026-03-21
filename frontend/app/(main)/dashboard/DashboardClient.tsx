'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────
type DashboardClientProps = { userName: string; userRole: string; canCreateEco: boolean }
type EcoStatus = 'Draft' | 'Reviewed' | 'Rejected' | 'Approved'

type EcoRecord = {
    id: string; ecoCode: string; title: string; ecoType: string
    product: string; bom: string; productId?: string; bomId?: string
    user: string; effectiveDate: string; versionUpdate: boolean
    status: EcoStatus; changes: any
}

type ProductOption = { id: string; productCode: string; name: string; version: number; salePrice: number; costPrice: number }
type BomOption    = { id: string; bomCode: string; name: string; version: number; productCode: string; components: any[] }
type VersionRow   = { id: string; version: number; status: string; isLatest: boolean; createdAt: string; name?: string; salePrice?: number; costPrice?: number; components?: any[]; versionDiff?: any; priceDifference?: number | null; itemDifference?: number | null }

type Component = { name: string; qty: number; unit: string; notes?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge: Record<string, string> = {
    Draft:    'bg-white border border-gray-300 text-gray-700',
    Reviewed: 'bg-blue-50 border border-blue-300 text-blue-700',
    Approved: 'bg-green-50 border border-green-300 text-green-700',
    Rejected: 'bg-red-50 border border-red-300 text-red-700',
}
const fmtINR = (v: number | string) =>
    '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })

// ─── Main ──────────────────────────────────────────────────────────────────────
const DashboardClient = ({ userName, userRole, canCreateEco }: DashboardClientProps) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

    const [showNewForm, setShowNewForm]     = useState(false)
    const [ecoRecords, setEcoRecords]       = useState<EcoRecord[]>([])
    const [isLoading, setIsLoading]         = useState(true)
    const [searchTerm, setSearchTerm]       = useState('')
    const [selectedEcoId, setSelectedEcoId] = useState<string | null>(null)

    // Form state
    const [title, setTitle]         = useState('')
    const [ecoType, setEcoType]     = useState<'Products' | 'Bills of Materials'>('Products')
    const [selectedProductId, setSelectedProductId] = useState('')
    const [selectedBomId, setSelectedBomId]         = useState('')
    const [effectiveDate, setEffectiveDate] = useState('')
    const [versionUpdate, setVersionUpdate] = useState(true)
    const [isSaving, setIsSaving]           = useState(false)

    // Proposed changes — Product
    const [pNewName, setPNewName]           = useState('')
    const [pNewSalePrice, setPNewSalePrice] = useState('')
    const [pNewCostPrice, setPNewCostPrice] = useState('')
    const [pNotes, setPNotes]               = useState('')

    // Proposed changes — BOM
    const [bomComponents, setBomComponents] = useState<Component[]>([])
    const [bomNotes, setBomNotes]           = useState('')

    // Dropdown options
    const [productOptions, setProductOptions] = useState<ProductOption[]>([])
    const [bomOptions, setBomOptions]         = useState<BomOption[]>([])
    const [loadingOptions, setLoadingOptions] = useState(false)

    // Detail panel
    const [productVersions, setProductVersions] = useState<VersionRow[]>([])
    const [bomVersions, setBomVersions]         = useState<VersionRow[]>([])
    const [loadingVersions, setLoadingVersions] = useState(false)

    // Current product/BOM data for diff preview
    const [currentProduct, setCurrentProduct] = useState<ProductOption | null>(null)
    const [currentBom, setCurrentBom]         = useState<BomOption | null>(null)

    const canReviewEco = userRole === 'Approver' || userRole === 'Admin'

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
            })))
        } catch (e: any) {
            toast.error(e.message || 'Failed to load ECO requests')
        } finally {
            setIsLoading(false)
        }
    }, [API_BASE])

    useEffect(() => { loadEcoRequests() }, [loadEcoRequests])

    // ─── Load dropdown options when form opens ──────────────────────────────────
    const loadOptions = useCallback(async () => {
        setLoadingOptions(true)
        try {
            const [pRes, bRes] = await Promise.all([
                fetch(`${API_BASE}/api/products/active-latest`, { credentials: 'include' }),
                fetch(`${API_BASE}/api/boms/active-latest`, { credentials: 'include' }),
            ])
            if (pRes.ok) setProductOptions(await pRes.json())
            if (bRes.ok) setBomOptions(await bRes.json())
        } catch { /* silent */ } finally {
            setLoadingOptions(false)
        }
    }, [API_BASE])

    useEffect(() => { if (showNewForm) loadOptions() }, [showNewForm, loadOptions])

    // When product changes, pre-fill proposed changes with current values
    useEffect(() => {
        const p = productOptions.find(x => x.id === selectedProductId)
        setCurrentProduct(p || null)
        if (p) { setPNewName(p.name); setPNewSalePrice(String(p.salePrice)); setPNewCostPrice(String(p.costPrice)) }
    }, [selectedProductId, productOptions])

    // When BOM changes, pre-fill BOM components
    useEffect(() => {
        const b = bomOptions.find(x => x.id === selectedBomId)
        setCurrentBom(b || null)
        if (b) { setBomComponents(Array.isArray(b.components) ? b.components.map(c => ({...c})) : []) }
    }, [selectedBomId, bomOptions])

    // ─── Version history for selected ECO ──────────────────────────────────────
    const loadVersionHistory = useCallback(async (eco: EcoRecord) => {
        setProductVersions([]); setBomVersions([])
        if (!eco.productId && !eco.bomId) return
        setLoadingVersions(true)
        try {
            const fetches: Promise<void>[] = []

            if (eco.productId) {
                fetches.push(
                    // Single-hop: resolve productCode + fetch all versions in one call
                    fetch(`${API_BASE}/api/products/versions-by-id/${eco.productId}`, { credentials: 'include' })
                        .then(async r => {
                            if (!r.ok) {
                                const err = await r.json().catch(() => ({}))
                                toast.error(`Product versions: ${err?.error || r.statusText}`)
                                return
                            }
                            const data = await r.json()
                            setProductVersions(Array.isArray(data) ? data : [])
                        })
                        .catch(e => { toast.error(`Product versions fetch failed: ${e.message}`) })
                )
            }

            if (eco.bomId) {
                fetches.push(
                    fetch(`${API_BASE}/api/boms/versions-by-id/${eco.bomId}`, { credentials: 'include' })
                        .then(async r => {
                            if (!r.ok) {
                                const err = await r.json().catch(() => ({}))
                                toast.error(`BOM versions: ${err?.error || r.statusText}`)
                                return
                            }
                            const data = await r.json()
                            setBomVersions(Array.isArray(data) ? data : [])
                        })
                        .catch(e => { toast.error(`BOM versions fetch failed: ${e.message}`) })
                )
            }

            await Promise.all(fetches)
        } finally { setLoadingVersions(false) }
    }, [API_BASE])

    const selectedEco = ecoRecords.find(r => r.id === selectedEcoId) || null
    useEffect(() => {
        if (selectedEco) loadVersionHistory(selectedEco)
        else { setProductVersions([]); setBomVersions([]) }
    }, [selectedEco, loadVersionHistory])

    // ─── Form helpers ───────────────────────────────────────────────────────────
    const resetForm = () => {
        setTitle(''); setSelectedProductId(''); setSelectedBomId('')
        setEffectiveDate(''); setVersionUpdate(true)
        setPNewName(''); setPNewSalePrice(''); setPNewCostPrice(''); setPNotes('')
        setBomComponents([]); setBomNotes('')
        setCurrentProduct(null); setCurrentBom(null)
    }

    const addBomComponent = () =>
        setBomComponents(prev => [...prev, { name: '', qty: 1, unit: 'pcs', notes: '' }])
    const updateBomComponent = (i: number, k: keyof Component, v: any) =>
        setBomComponents(prev => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c))
    const removeBomComponent = (i: number) =>
        setBomComponents(prev => prev.filter((_, idx) => idx !== i))

    // Build proposedChanges object from form state
    const buildProposedChanges = () => {
        if (ecoType === 'Products') {
            const ch: any = {}
            if (pNewName.trim() && pNewName !== currentProduct?.name)       ch.name      = pNewName.trim()
            if (pNewSalePrice !== '' && Number(pNewSalePrice) !== Number(currentProduct?.salePrice)) ch.salePrice = parseFloat(pNewSalePrice)
            if (pNewCostPrice !== '' && Number(pNewCostPrice) !== Number(currentProduct?.costPrice)) ch.costPrice = parseFloat(pNewCostPrice)
            if (pNotes.trim()) ch.notes = pNotes.trim()
            return ch
        } else {
            const ch: any = { components: bomComponents }
            if (bomNotes.trim()) ch.notes = bomNotes.trim()
            return ch
        }
    }

    // Build human-readable diff preview for form
    const getDiffPreview = () => {
        if (!currentProduct && !currentBom) return []
        if (ecoType === 'Products' && currentProduct) {
            const items: { field: string; from: string; to: string; changed: boolean }[] = []
            items.push({ field: 'Product Name', from: currentProduct.name, to: pNewName || currentProduct.name, changed: pNewName.trim() !== '' && pNewName !== currentProduct.name })
            items.push({ field: 'Sale Price', from: fmtINR(currentProduct.salePrice), to: pNewSalePrice ? fmtINR(pNewSalePrice) : fmtINR(currentProduct.salePrice), changed: pNewSalePrice !== '' && Number(pNewSalePrice) !== Number(currentProduct.salePrice) })
            items.push({ field: 'Cost Price', from: fmtINR(currentProduct.costPrice), to: pNewCostPrice ? fmtINR(pNewCostPrice) : fmtINR(currentProduct.costPrice), changed: pNewCostPrice !== '' && Number(pNewCostPrice) !== Number(currentProduct.costPrice) })
            return items
        }
        return []
    }

    // ─── Save ECO ───────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!canCreateEco) { toast.error('Insufficient permissions'); return }
        if (!title.trim()) { toast.error('Title is required'); return }
        if (!selectedProductId) { toast.error('Please select a Product'); return }
        if (!selectedBomId) { toast.error('Please select a Bill of Materials'); return }

        const proposedChanges = buildProposedChanges()
        if (ecoType === 'Products' && Object.keys(proposedChanges).length === 0) {
            toast.error('Please enter at least one proposed change for the product')
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(`${API_BASE}/api/eco-requests`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(), ecoType,
                    productId: selectedProductId, bomId: selectedBomId,
                    product: '', bom: '',
                    effectiveDate: effectiveDate || null,
                    versionUpdate, status: 'Draft',
                    changes: proposedChanges,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Failed to save ECO request')
            toast.success('ECO request created')
            setShowNewForm(false); resetForm(); loadEcoRequests()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setIsSaving(false)
        }
    }

    // ─── Status update ──────────────────────────────────────────────────────────
    const updateEcoStatus = async (id: string, nextStatus: EcoStatus) => {
        if (!canReviewEco) { toast.error('Only Approver or Admin can update ECO status'); return }
        try {
            const res = await fetch(`${API_BASE}/api/eco-requests/${id}/status`, {
                method: 'PATCH', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Update failed')
            setEcoRecords(prev => prev.map(r => r.id === id ? { ...r, status: nextStatus } : r))
            toast.success(`ECO marked as ${nextStatus}`)
            if (nextStatus === 'Approved') {
                toast.info('Product/BOM updated — new version created & old archived')
                if (selectedEco) setTimeout(() => loadVersionHistory(selectedEco), 800)
            }
        } catch (e: any) { toast.error(e.message) }
    }

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
                        <button onClick={() => { setShowNewForm(!showNewForm); setSelectedEcoId(null) }}
                            className='px-5 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm transition-colors shadow-sm'>
                            {showNewForm ? 'Cancel' : 'New'}
                        </button>
                    )}
                    <input type='text' placeholder='Search Bar' value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className='flex-1 border-2 border-purple-300 px-4 py-2 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 transition' />
                    <button className='px-4 py-2 rounded-lg border-2 border-purple-300 text-purple-700 text-sm font-semibold bg-white hover:bg-purple-50'>Filters</button>
                </div>

                {/* ── New ECO Form ───────────────────────────────────────────────── */}
                {showNewForm && canCreateEco && (
                    <div className='rounded-2xl border-2 border-purple-200 shadow-sm p-6 bg-white space-y-5'>
                        <div className='flex items-center justify-between'>
                            <h2 className='font-bold text-[#7c3aed] text-base'>Create New ECO Request</h2>
                            <div className='flex gap-2'>
                                <button onClick={handleSave} disabled={isSaving}
                                    className='px-4 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold disabled:opacity-50'>
                                    {isSaving ? 'Saving…' : 'Save'}
                                </button>
                                <button onClick={() => { setShowNewForm(false); resetForm() }}
                                    className='px-4 py-1.5 rounded-lg border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50'>
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* Row 1: Title */}
                        <div>
                            <label className='block text-sm font-semibold text-gray-700 mb-1'>Title *</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} placeholder='e.g. Update hydraulic pump pricing'
                                className='w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500' />
                        </div>

                        {/* Row 2: ECO Type + Effective Date */}
                        <div className='grid grid-cols-2 gap-4'>
                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>ECO Type *</label>
                                <select value={ecoType} onChange={e => { setEcoType(e.target.value as any); resetForm(); setTitle(title) }}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500'>
                                    <option value='Products'>Products</option>
                                    <option value='Bills of Materials'>Bills of Materials</option>
                                </select>
                            </div>
                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>Effective Date</label>
                                <input type='date' value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500' />
                            </div>
                        </div>

                        {/* Row 3: Product + BOM dropdowns */}
                        <div className='grid grid-cols-2 gap-4'>
                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>
                                    Product * <span className='text-[10px] text-gray-400 font-normal'>active versions only</span>
                                </label>
                                <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500'>
                                    <option value=''>— Select Product —</option>
                                    {loadingOptions && <option disabled>Loading…</option>}
                                    {productOptions.map(p => (
                                        <option key={p.id} value={p.id}>{p.productCode} · {p.name} (v{p.version})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>
                                    Bill of Materials * <span className='text-[10px] text-gray-400 font-normal'>active versions only</span>
                                </label>
                                <select value={selectedBomId} onChange={e => setSelectedBomId(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500'>
                                    <option value=''>— Select BOM —</option>
                                    {loadingOptions && <option disabled>Loading…</option>}
                                    {bomOptions.map(b => (
                                        <option key={b.id} value={b.id}>{b.bomCode} · {b.name} (v{b.version})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* ── Proposed Changes Section ── */}
                        {(selectedProductId || selectedBomId) && (
                            <div className='rounded-xl border-2 border-dashed border-purple-200 p-5 space-y-4'>
                                <div className='flex items-center gap-2'>
                                    <span className='w-2 h-2 rounded-full bg-[#7c3aed]' />
                                    <p className='font-bold text-sm text-[#7c3aed]'>
                                        {ecoType === 'Products' ? 'Proposed Product Changes' : 'Proposed BOM Changes'}
                                    </p>
                                    <span className='text-[10px] text-gray-400 ml-1'>Leave blank to keep current values</span>
                                </div>

                                {/* PRODUCT proposed changes */}
                                {ecoType === 'Products' && currentProduct && (
                                    <div className='space-y-3'>
                                        <div>
                                            <label className='block text-xs font-semibold text-gray-600 mb-1'>Product Name</label>
                                            <div className='flex items-center gap-2'>
                                                <span className='text-xs text-gray-400 w-40 truncate'>Current: {currentProduct.name}</span>
                                                <input value={pNewName} onChange={e => setPNewName(e.target.value)}
                                                    placeholder='New name (or leave to keep)'
                                                    className='flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400' />
                                            </div>
                                        </div>
                                        <div className='grid grid-cols-2 gap-3'>
                                            <div>
                                                <label className='block text-xs font-semibold text-gray-600 mb-1'>Sale Price (₹)</label>
                                                <div className='space-y-1'>
                                                    <p className='text-xs text-gray-400'>Current: {fmtINR(currentProduct.salePrice)}</p>
                                                    <input type='number' value={pNewSalePrice} onChange={e => setPNewSalePrice(e.target.value)}
                                                        placeholder={String(currentProduct.salePrice)}
                                                        className='w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400' />
                                                </div>
                                            </div>
                                            <div>
                                                <label className='block text-xs font-semibold text-gray-600 mb-1'>Cost Price (₹)</label>
                                                <div className='space-y-1'>
                                                    <p className='text-xs text-gray-400'>Current: {fmtINR(currentProduct.costPrice)}</p>
                                                    <input type='number' value={pNewCostPrice} onChange={e => setPNewCostPrice(e.target.value)}
                                                        placeholder={String(currentProduct.costPrice)}
                                                        className='w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400' />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className='block text-xs font-semibold text-gray-600 mb-1'>Reason / Specification Notes</label>
                                            <input value={pNotes} onChange={e => setPNotes(e.target.value)}
                                                placeholder='e.g. Price updated due to raw material cost increase'
                                                className='w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400' />
                                        </div>

                                        {/* Live diff preview */}
                                        {getDiffPreview().some(d => d.changed) && (
                                            <div className='rounded-lg border border-amber-200 bg-amber-50 p-3'>
                                                <p className='text-xs font-semibold text-amber-700 mb-2'>📋 Proposed Changes Preview</p>
                                                <div className='space-y-1'>
                                                    {getDiffPreview().filter(d => d.changed).map(d => (
                                                        <div key={d.field} className='flex items-center gap-2 text-xs'>
                                                            <span className='font-semibold text-gray-700 w-24'>{d.field}:</span>
                                                            <span className='text-red-500 line-through'>{d.from}</span>
                                                            <span className='text-gray-400'>→</span>
                                                            <span className='text-green-600 font-semibold'>{d.to}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* BOM proposed changes */}
                                {ecoType === 'Bills of Materials' && currentBom && (
                                    <div className='space-y-3'>
                                        <div className='flex items-center justify-between'>
                                            <p className='text-xs font-semibold text-gray-600'>Edit Components ({bomComponents.length} items)</p>
                                            <button type='button' onClick={addBomComponent}
                                                className='text-xs text-[#7c3aed] font-semibold hover:underline'>
                                                + Add Component
                                            </button>
                                        </div>

                                        {bomComponents.length === 0 ? (
                                            <button type='button' onClick={addBomComponent}
                                                className='w-full py-3 border-2 border-dashed border-purple-200 rounded-xl text-xs text-gray-400 hover:border-purple-400 hover:text-[#7c3aed] transition-all'>
                                                + Add components
                                            </button>
                                        ) : (
                                            <div className='rounded-xl border border-purple-200 overflow-hidden'>
                                                <table className='w-full text-xs'>
                                                    <thead className='bg-purple-50 border-b border-purple-100'>
                                                        <tr>
                                                            <th className='text-left px-3 py-2 font-semibold text-purple-800'>Component</th>
                                                            <th className='text-center px-2 py-2 font-semibold text-purple-800 w-20'>Qty</th>
                                                            <th className='text-center px-2 py-2 font-semibold text-purple-800 w-24'>Unit</th>
                                                            <th className='text-left px-2 py-2 font-semibold text-purple-800'>Notes</th>
                                                            <th className='w-6' />
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {bomComponents.map((c, i) => (
                                                            <tr key={i} className='border-t border-purple-50'>
                                                                <td className='px-2 py-1.5'>
                                                                    <input type='text' value={c.name} onChange={e => updateBomComponent(i, 'name', e.target.value)}
                                                                        placeholder='Component name'
                                                                        className='w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300' />
                                                                </td>
                                                                <td className='px-1 py-1.5'>
                                                                    <input type='number' value={c.qty} onChange={e => updateBomComponent(i, 'qty', parseFloat(e.target.value)||0)}
                                                                        className='w-full border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-300' />
                                                                </td>
                                                                <td className='px-1 py-1.5'>
                                                                    <select value={c.unit} onChange={e => updateBomComponent(i, 'unit', e.target.value)}
                                                                        className='w-full border border-gray-200 rounded px-1 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-300'>
                                                                        {['pcs','m','m²','m³','kg','g','L','ml','set','lot'].map(u => <option key={u}>{u}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className='px-1 py-1.5'>
                                                                    <input type='text' value={c.notes||''} onChange={e => updateBomComponent(i, 'notes', e.target.value)}
                                                                        placeholder='optional'
                                                                        className='w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300' />
                                                                </td>
                                                                <td className='px-1 text-center'>
                                                                    <button type='button' onClick={() => removeBomComponent(i)} className='text-red-400 hover:text-red-600 text-base'>×</button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <div>
                                            <label className='block text-xs font-semibold text-gray-600 mb-1'>Notes</label>
                                            <input value={bomNotes} onChange={e => setBomNotes(e.target.value)}
                                                placeholder='Reason for BOM change…'
                                                className='w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400' />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <label className='inline-flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer'>
                            <input type='checkbox' checked={versionUpdate} onChange={e => setVersionUpdate(e.target.checked)} className='accent-purple-600 w-4 h-4' />
                            Version Update (creates new version on approval)
                        </label>
                    </div>
                )}

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
                                        onClick={() => setSelectedEcoId(selectedEcoId === record.id ? null : record.id)}
                                        className={`border-b border-gray-100 cursor-pointer transition-colors ${selectedEcoId === record.id ? 'bg-purple-50' : 'hover:bg-purple-50/40'}`}>
                                        <td className='px-5 py-3 text-sm text-gray-800 font-medium'>{record.title}</td>
                                        <td className='px-4 py-3 text-sm text-gray-600'>{record.ecoType}</td>
                                        <td className='px-4 py-3 text-sm text-gray-600'>{record.product}</td>
                                        <td className='px-4 py-3 text-sm'>
                                            <div className='flex items-center gap-2 flex-wrap'>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge[record.status]||''}`}>
                                                    {record.status}
                                                </span>
                                                {canReviewEco && record.status === 'Draft' && (
                                                    <button onClick={e => { e.stopPropagation(); updateEcoStatus(record.id, 'Reviewed') }}
                                                        className='px-2 py-0.5 rounded text-[11px] font-semibold border border-purple-300 text-purple-700 hover:bg-purple-50'>
                                                        Review
                                                    </button>
                                                )}
                                                {canReviewEco && record.status === 'Reviewed' && (<>
                                                    <button onClick={e => { e.stopPropagation(); updateEcoStatus(record.id, 'Approved') }}
                                                        className='px-2 py-0.5 rounded text-[11px] font-semibold border border-green-300 text-green-700 hover:bg-green-50'>
                                                        Approve
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); updateEcoStatus(record.id, 'Rejected') }}
                                                        className='px-2 py-0.5 rounded text-[11px] font-semibold border border-red-300 text-red-700 hover:bg-red-50'>
                                                        Reject
                                                    </button>
                                                </>)}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── ECO Detail Panel ── */}
                {selectedEco && (
                    <div className='rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden bg-white'>
                        {/* Header */}
                        <div className='px-6 py-4 border-b border-purple-100 flex items-center justify-between'>
                            <div>
                                <h2 className='font-bold text-[#7c3aed]'>{selectedEco.ecoCode} — {selectedEco.title}</h2>
                                <p className='text-xs text-gray-400 mt-0.5'>{selectedEco.ecoType} · {selectedEco.user} · {selectedEco.effectiveDate || 'No effective date'}</p>
                            </div>
                            <div className='flex items-center gap-2'>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge[selectedEco.status]||''}`}>
                                    {selectedEco.status === 'Approved' ? 'Applied' : selectedEco.status}
                                </span>
                                {canReviewEco && selectedEco.status === 'Draft' && (
                                    <button onClick={() => updateEcoStatus(selectedEco.id, 'Reviewed')}
                                        className='px-3 py-1 rounded border border-purple-300 text-purple-700 text-xs font-semibold hover:bg-purple-50'>Review</button>
                                )}
                                {canReviewEco && selectedEco.status === 'Reviewed' && (<>
                                    <button onClick={() => updateEcoStatus(selectedEco.id, 'Approved')}
                                        className='px-3 py-1 rounded border border-green-300 text-green-700 text-xs font-semibold hover:bg-green-50'>Approve</button>
                                    <button onClick={() => updateEcoStatus(selectedEco.id, 'Rejected')}
                                        className='px-3 py-1 rounded border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50'>Reject</button>
                                </>)}
                            </div>
                        </div>

                        {/* Detail fields */}
                        <div className='px-6 py-4 grid grid-cols-2 gap-3 border-b border-purple-50'>
                            {[
                                { label: 'Title', value: selectedEco.title, span: 2 },
                                { label: 'ECO Type', value: selectedEco.ecoType },
                                { label: 'Product', value: selectedEco.product },
                                { label: 'Bill of Materials', value: selectedEco.bom, span: 2 },
                                { label: 'Requested By', value: selectedEco.user },
                                { label: 'Effective Date', value: selectedEco.effectiveDate || '—' },
                            ].map(f => (
                                <div key={f.label} className={f.span === 2 ? 'col-span-2' : ''}>
                                    <label className='block text-xs font-semibold text-gray-500 mb-1'>{f.label}</label>
                                    <div className='border-2 border-purple-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700'>{f.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* ── Proposed Changes + Approver Diff ── */}
                        {selectedEco.changes && Object.keys(selectedEco.changes).length > 0 && (
                            <div className='px-6 py-5 border-b border-purple-50'>
                                <h3 className='font-bold text-sm text-[#7c3aed] mb-4 flex items-center gap-2'>
                                    <span className='w-2 h-2 rounded-full bg-amber-400 inline-block' />
                                    {selectedEco.status === 'Approved' ? 'Applied Changes' : 'Proposed Changes — Approver Review'}
                                </h3>

                                {/* ── PRODUCT DIFF ── */}
                                {selectedEco.ecoType === 'Products' && (() => {
                                    const ch = selectedEco.changes as Record<string, any>

                                    // After approval: use versionDiff from the latest version row (has exact from/to)
                                    const latestVer = productVersions.find(v => v.isLatest)
                                    const vdiff = latestVer?.versionDiff as Record<string, { from: any; to: any }> | undefined

                                    // Before approval: get values from the archived (original) version row
                                    const archVer = productVersions.find(v => !v.isLatest) ?? productVersions[productVersions.length - 1]

                                    const fieldMeta: Record<string, { label: string; fmt: (v: any) => string }> = {
                                        name:      { label: 'Product Name', fmt: v => String(v) },
                                        salePrice: { label: 'Sale Price',   fmt: v => fmtINR(v) },
                                        costPrice: { label: 'Cost Price',   fmt: v => fmtINR(v) },
                                        notes:     { label: 'Notes',        fmt: v => String(v) },
                                    }

                                    // Build rows from versionDiff (post-approval) or from proposed ch + archVer (pre-approval)
                                    type DiffRow = { field: string; label: string; from: string; to: string; isNote?: boolean }
                                    let rows: DiffRow[] = []

                                    if (vdiff && Object.keys(vdiff).length > 0) {
                                        // Post-approval: exact from/to stored by backend
                                        rows = Object.entries(vdiff).map(([field, val]) => ({
                                            field,
                                            label: fieldMeta[field]?.label || field,
                                            from: fieldMeta[field]?.fmt(val.from) ?? String(val.from),
                                            to:   fieldMeta[field]?.fmt(val.to)   ?? String(val.to),
                                        }))
                                    } else {
                                        // Pre-approval: compare proposed values against current archived version
                                        const getArchVal = (f: string): any => {
                                            if (f === 'salePrice') return archVer?.salePrice
                                            if (f === 'costPrice') return archVer?.costPrice
                                            if (f === 'name')      return archVer?.name
                                            return undefined
                                        }
                                        rows = Object.entries(ch)
                                            .filter(([k]) => k !== 'notes' && fieldMeta[k])
                                            .map(([field, proposed]) => ({
                                                field,
                                                label: fieldMeta[field]?.label || field,
                                                from: fieldMeta[field]?.fmt(getArchVal(field)) ?? String(getArchVal(field) ?? '—'),
                                                to:   fieldMeta[field]?.fmt(proposed) ?? String(proposed),
                                            }))
                                    }

                                    return (
                                        <div className='rounded-xl border-2 border-amber-200 overflow-hidden'>
                                            <div className='bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between'>
                                                <p className='text-xs font-bold text-amber-800'>📦 Product Changes</p>
                                                <span className='text-[10px] text-amber-600 font-semibold'>{rows.length} field{rows.length !== 1 ? 's' : ''} changed</span>
                                            </div>
                                            <table className='w-full text-sm'>
                                                <thead className='border-b border-amber-100 bg-amber-50/30'>
                                                    <tr>
                                                        <th className='text-left px-4 py-2.5 text-xs font-bold text-gray-600 w-32'>Field</th>
                                                        <th className='text-left px-4 py-2.5 text-xs font-bold text-red-600'>Before</th>
                                                        <th className='text-center px-3 py-2.5 text-xs text-gray-400 w-8'>→</th>
                                                        <th className='text-left px-4 py-2.5 text-xs font-bold text-green-700'>After</th>
                                                        <th className='text-right px-4 py-2.5 text-xs font-bold text-gray-400 w-28'>Δ Change</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.length === 0 ? (
                                                        <tr><td colSpan={5} className='px-4 py-4 text-xs text-gray-400 italic text-center'>No changes recorded yet — data will appear after approval.</td></tr>
                                                    ) : rows.map(row => {
                                                        const isPrice = row.field === 'salePrice' || row.field === 'costPrice'
                                                        const delta = isPrice
                                                            ? Number(String(row.to).replace(/[^0-9.-]/g, '')) - Number(String(row.from).replace(/[^0-9.-]/g, ''))
                                                            : null
                                                        return (
                                                            <tr key={row.field} className='border-t border-amber-50 hover:bg-amber-50/20'>
                                                                <td className='px-4 py-3 font-semibold text-gray-700 text-xs'>{row.label}</td>
                                                                <td className='px-4 py-3 text-xs'>
                                                                    <span className='inline-flex items-center px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-600 font-mono'>
                                                                        {row.from}
                                                                    </span>
                                                                </td>
                                                                <td className='px-3 py-3 text-center text-gray-400 text-xs font-bold'>→</td>
                                                                <td className='px-4 py-3 text-xs'>
                                                                    <span className='inline-flex items-center px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 font-mono font-semibold'>
                                                                        {row.to}
                                                                    </span>
                                                                </td>
                                                                <td className='px-4 py-3 text-xs text-right'>
                                                                    {delta !== null ? (
                                                                        <span className={`font-semibold ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                                            {delta > 0 ? '+' : ''}{fmtINR(delta)}
                                                                        </span>
                                                                    ) : '—'}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                    {ch.notes && (
                                                        <tr className='border-t border-amber-100 bg-amber-50/30'>
                                                            <td className='px-4 py-2.5 text-xs font-bold text-gray-600'>Reason</td>
                                                            <td colSpan={4} className='px-4 py-2.5 text-xs text-gray-600 italic'>{ch.notes}</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                })()}

                                {/* ── BOM DIFF ── */}
                                {selectedEco.ecoType === 'Bills of Materials' && (() => {
                                    const ch = selectedEco.changes as Record<string, any>

                                    // Post-approval: use versionDiff.components.from + .to
                                    const latestBom = bomVersions.find(v => v.isLatest)
                                    const vdiff = latestBom?.versionDiff as Record<string, { from: any; to: any }> | undefined

                                    const oldComps: Component[] = (vdiff?.components?.from ?? bomVersions.find(v => !v.isLatest)?.components ?? []) as Component[]
                                    const newComps: Component[] = (vdiff?.components?.to   ?? ch.components ?? []) as Component[]

                                    // Per-component diff: match by name
                                    type CompRow = { name: string; oldQty?: number; newQty?: number; oldUnit?: string; newUnit?: string; state: 'added'|'removed'|'changed'|'unchanged' }
                                    const compRows: CompRow[] = []

                                    const oldMap = new Map<string, Component>(oldComps.map(c => [c.name.toLowerCase(), c]))
                                    const newMap = new Map<string, Component>(newComps.map(c => [c.name.toLowerCase(), c]))
                                    const allKeys = new Set([...oldMap.keys(), ...newMap.keys()])

                                    allKeys.forEach(key => {
                                        const o = oldMap.get(key)
                                        const n = newMap.get(key)
                                        if (!o && n)      compRows.push({ name: n.name, newQty: n.qty, newUnit: n.unit, state: 'added' })
                                        else if (o && !n) compRows.push({ name: o.name, oldQty: o.qty, oldUnit: o.unit, state: 'removed' })
                                        else if (o && n)  compRows.push({ name: o.name, oldQty: o.qty, newQty: n.qty, oldUnit: o.unit, newUnit: n.unit, state: (o.qty !== n.qty || o.unit !== n.unit) ? 'changed' : 'unchanged' })
                                    })

                                    const stateMeta: Record<CompRow['state'], { label: string; bg: string; text: string; dot: string }> = {
                                        added:     { label: 'Added',     bg: 'bg-green-50  border-green-200',  text: 'text-green-700',  dot: 'bg-green-400' },
                                        removed:   { label: 'Removed',   bg: 'bg-red-50    border-red-200',    text: 'text-red-600',    dot: 'bg-red-400' },
                                        changed:   { label: 'Changed',   bg: 'bg-amber-50  border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-400' },
                                        unchanged: { label: 'Unchanged', bg: 'bg-gray-50   border-gray-200',   text: 'text-gray-500',   dot: 'bg-gray-300' },
                                    }

                                    const changed   = compRows.filter(r => r.state !== 'unchanged')
                                    const unchanged = compRows.filter(r => r.state === 'unchanged')

                                    return (
                                        <div className='rounded-xl border-2 border-indigo-200 overflow-hidden'>
                                            <div className='bg-indigo-50 px-4 py-2.5 border-b border-indigo-200 flex items-center justify-between'>
                                                <p className='text-xs font-bold text-indigo-800'>🔧 BOM Component Changes</p>
                                                <div className='flex items-center gap-3 text-[10px]'>
                                                    <span className='text-green-600 font-semibold'>+{compRows.filter(r=>r.state==='added').length} added</span>
                                                    <span className='text-red-500 font-semibold'>−{compRows.filter(r=>r.state==='removed').length} removed</span>
                                                    <span className='text-amber-600 font-semibold'>~{compRows.filter(r=>r.state==='changed').length} changed</span>
                                                    <span className='text-gray-400'>{compRows.filter(r=>r.state==='unchanged').length} unchanged</span>
                                                </div>
                                            </div>
                                            <table className='w-full text-xs'>
                                                <thead className='bg-indigo-50/50 border-b border-indigo-100'>
                                                    <tr>
                                                        <th className='text-left px-4 py-2.5 font-bold text-indigo-800'>Component</th>
                                                        <th className='text-center px-4 py-2.5 font-bold text-red-600'>Before (Qty · Unit)</th>
                                                        <th className='text-center px-2 py-2.5 font-bold text-gray-400 w-8'>→</th>
                                                        <th className='text-center px-4 py-2.5 font-bold text-green-700'>After (Qty · Unit)</th>
                                                        <th className='text-center px-4 py-2.5 font-bold text-indigo-700 w-24'>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[...changed, ...unchanged].map((r, i) => {
                                                        const m = stateMeta[r.state]
                                                        return (
                                                            <tr key={i} className={`border-t border-indigo-50 ${r.state === 'unchanged' ? 'opacity-50' : ''}`}>
                                                                <td className='px-4 py-2.5'>
                                                                    <div className='flex items-center gap-1.5'>
                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
                                                                        <span className='font-medium text-gray-800'>{r.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className='px-4 py-2.5 text-center'>
                                                                    {r.oldQty != null ? (
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded border font-mono ${r.state === 'removed' ? 'bg-red-50 border-red-200 text-red-600 line-through' : r.state === 'changed' ? 'bg-red-50 border-red-200 text-red-500' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                                                            {r.oldQty} {r.oldUnit}
                                                                        </span>
                                                                    ) : <span className='text-gray-300'>—</span>}
                                                                </td>
                                                                <td className='px-2 py-2.5 text-center text-gray-400 font-bold'>→</td>
                                                                <td className='px-4 py-2.5 text-center'>
                                                                    {r.newQty != null ? (
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded border font-mono font-semibold ${r.state === 'added' ? 'bg-green-50 border-green-200 text-green-700' : r.state === 'changed' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                                                            {r.newQty} {r.newUnit}
                                                                        </span>
                                                                    ) : <span className='text-gray-300'>—</span>}
                                                                </td>
                                                                <td className='px-4 py-2.5 text-center'>
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${m.bg} ${m.text}`}>
                                                                        {m.label}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                    {compRows.length === 0 && (
                                                        <tr><td colSpan={5} className='px-4 py-4 text-gray-400 italic text-center'>No component data available.</td></tr>
                                                    )}
                                                    {(ch.notes || vdiff?.notes) && (
                                                        <tr className='border-t border-indigo-100 bg-indigo-50/20'>
                                                            <td className='px-4 py-2.5 font-bold text-gray-600'>Reason</td>
                                                            <td colSpan={4} className='px-4 py-2.5 text-gray-600 italic'>{ch.notes || (vdiff?.notes?.to)}</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {/* ── Version History ── */}
                        <div className='px-6 py-5'>
                            <h3 className='font-bold text-sm text-[#7c3aed] mb-4 flex items-center gap-2'>
                                <span className='w-2 h-2 rounded-full bg-purple-500 inline-block' />
                                Version History
                            </h3>
                            {loadingVersions && <p className='text-sm text-gray-400 animate-pulse'>Loading…</p>}
                            {!loadingVersions && productVersions.length === 0 && bomVersions.length === 0 && (
                                <p className='text-sm text-gray-400 italic'>
                                    {selectedEco.productId || selectedEco.bomId ? 'No version history yet.' : 'Version history not available for legacy ECOs.'}
                                </p>
                            )}
                            <div className='space-y-6'>

                                {/* ── PRODUCT VERSIONS ── */}
                                {productVersions.length > 0 && (
                                    <div>
                                        <p className='text-xs font-bold text-purple-700 uppercase tracking-wider mb-2 flex items-center gap-1.5'>
                                            <span className='w-1.5 h-1.5 rounded-full bg-purple-500 inline-block' /> Product Versions
                                        </p>
                                        <div className='rounded-xl border border-purple-200 overflow-hidden'>
                                            <table className='w-full text-xs'>
                                                <thead className='bg-purple-50 border-b border-purple-100'>
                                                    <tr>
                                                        <th className='text-left   px-3 py-2.5 font-bold text-purple-800'>Version</th>
                                                        <th className='text-right  px-3 py-2.5 font-bold text-purple-800'>Sale Price</th>
                                                        <th className='text-right  px-3 py-2.5 font-bold text-purple-800'>Cost Price</th>
                                                        <th className='text-right  px-3 py-2.5 font-bold text-red-500'>Δ Sale Price</th>
                                                        <th className='text-right  px-3 py-2.5 font-bold text-orange-500'>Δ Cost Price</th>
                                                        <th className='text-center px-3 py-2.5 font-bold text-amber-600'>Δ Fields</th>
                                                        <th className='text-left   px-3 py-2.5 font-bold text-purple-800'>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {productVersions.map((v, i) => {
                                                        // versions are sorted DESC (latest first),
                                                        // so productVersions[i+1] is the PREVIOUS (older) version
                                                        const prev = productVersions[i + 1]

                                                        // Compute deltas directly from the two rows — works for all data
                                                        const saleDiff  = prev != null ? Number(v.salePrice  || 0) - Number(prev.salePrice  || 0) : null
                                                        const costDiff  = prev != null ? Number(v.costPrice  || 0) - Number(prev.costPrice  || 0) : null

                                                        const isFirst = !prev  // no previous version = initial

                                                        const fmtDelta = (val: number | null, label: string) => {
                                                            if (val === null) return <span className='text-gray-300 text-[10px]'>—</span>
                                                            if (val === 0)    return <span className='text-gray-400 text-[10px]'>No change</span>
                                                            return (
                                                                <div className='flex flex-col'>
                                                                    <span className={`font-mono font-bold ${val > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                                        {val > 0 ? '+' : ''}{fmtINR(val)}
                                                                    </span>
                                                                    <span className='text-[9px] text-gray-400'>{val > 0 ? '▲ increased' : '▼ decreased'}</span>
                                                                </div>
                                                            )
                                                        }

                                                        return (
                                                            <tr key={v.id} className={`border-t border-purple-50 hover:bg-purple-50/20 ${i === 0 ? 'bg-emerald-50/30' : ''}`}>
                                                                <td className='px-3 py-2.5 font-bold text-purple-700'>
                                                                    <span>v{v.version}</span>
                                                                    {v.isLatest && <span className='ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold'>LATEST</span>}
                                                                    {isFirst && <span className='ml-1.5 text-gray-400 font-normal text-[9px]'>(initial)</span>}
                                                                </td>
                                                                <td className='px-3 py-2.5 text-right text-gray-700 font-mono'>{fmtINR(Number(v.salePrice) || 0)}</td>
                                                                <td className='px-3 py-2.5 text-right text-gray-700 font-mono'>{fmtINR(Number(v.costPrice) || 0)}</td>
                                                                <td className='px-3 py-3'>{fmtDelta(saleDiff, 'Sale')}</td>
                                                                <td className='px-3 py-3'>{fmtDelta(costDiff, 'Cost')}</td>
                                                                <td className='px-3 py-2.5 text-center'>
                                                                    {prev != null ? (() => {
                                                                        // Count how many fields actually changed between the two rows
                                                                        let count = 0
                                                                        if (Number(v.salePrice || 0) !== Number(prev.salePrice || 0)) count++
                                                                        if (Number(v.costPrice || 0) !== Number(prev.costPrice || 0)) count++
                                                                        if (v.name !== prev.name) count++
                                                                        return count > 0
                                                                            ? <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]'>{count}</span>
                                                                            : <span className='text-gray-400 text-[10px]'>0</span>
                                                                    })() : <span className='text-gray-300'>—</span>}
                                                                </td>
                                                                <td className='px-3 py-2.5'>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${v.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                                        {v.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ── BOM VERSIONS ── */}
                                {bomVersions.length > 0 && (
                                    <div>
                                        <p className='text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1.5'>
                                            <span className='w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block' /> BOM Versions
                                        </p>
                                        <div className='rounded-xl border border-indigo-200 overflow-hidden'>
                                            <table className='w-full text-xs'>
                                                <thead className='bg-indigo-50 border-b border-indigo-100'>
                                                    <tr>
                                                        <th className='text-left   px-3 py-2.5 font-bold text-indigo-800'>Version</th>
                                                        <th className='text-center px-3 py-2.5 font-bold text-indigo-800'>Items</th>
                                                        <th className='text-center px-3 py-2.5 font-bold text-red-500'>Δ Items</th>
                                                        <th className='text-left   px-3 py-2.5 font-bold text-amber-600'>Qty Changes (component: before → after)</th>
                                                        <th className='text-left   px-3 py-2.5 font-bold text-indigo-800'>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bomVersions.map((v, i) => {
                                                        // bomVersions sorted DESC: bomVersions[i+1] = the PREVIOUS (older) version
                                                        const prev = bomVersions[i + 1]
                                                        const isFirst = !prev

                                                        const currComps: Component[] = Array.isArray(v.components) ? v.components as Component[] : []
                                                        const prevComps: Component[] = prev && Array.isArray(prev.components) ? prev.components as Component[] : []

                                                        // Net item-count delta (null for v1 — no prev to compare against)
                                                        const deltaItems = prev != null ? currComps.length - prevComps.length : null

                                                        // Per-component qty change (matched by name, case-insensitive)
                                                        type QtyRow = { name: string; oldQty: number; newQty: number; delta: number }
                                                        const qtyRows: QtyRow[] = []
                                                        if (prev != null) {
                                                            const prevMap = new Map<string, Component>(prevComps.map(c => [c.name.toLowerCase(), c]))
                                                            const currMap = new Map<string, Component>(currComps.map(c => [c.name.toLowerCase(), c]))
                                                            currMap.forEach((nc, key) => {
                                                                const oc = prevMap.get(key)
                                                                if (oc && Number(oc.qty) !== Number(nc.qty))
                                                                    qtyRows.push({ name: nc.name, oldQty: Number(oc.qty), newQty: Number(nc.qty), delta: Number(nc.qty) - Number(oc.qty) })
                                                            })
                                                        }

                                                        return (
                                                            <tr key={v.id} className={`border-t border-indigo-50 hover:bg-indigo-50/20 ${i === 0 ? 'bg-emerald-50/30' : ''} align-top`}>
                                                                <td className='px-3 py-2.5 font-bold text-indigo-700'>
                                                                    <span>v{v.version}</span>
                                                                    {v.isLatest && <span className='ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold'>LATEST</span>}
                                                                    {isFirst && <span className='ml-1.5 text-gray-400 font-normal text-[9px]'>(initial)</span>}
                                                                </td>
                                                                <td className='px-3 py-2.5 text-center text-gray-700 font-semibold'>
                                                                    {currComps.length}
                                                                </td>
                                                                {/* Δ items — net count change vs prev  */}
                                                                <td className='px-3 py-2.5 text-center font-mono font-bold'>
                                                                    {deltaItems !== null ? (
                                                                        <div className='flex flex-col items-center'>
                                                                            <span className={deltaItems > 0 ? 'text-green-600' : deltaItems < 0 ? 'text-red-500' : 'text-gray-400'}>
                                                                                {deltaItems > 0 ? '+' : ''}{deltaItems}
                                                                            </span>
                                                                            {deltaItems !== 0 && (
                                                                                <span className='text-[9px] text-gray-400'>{deltaItems > 0 ? '▲ added' : '▼ removed'}</span>
                                                                            )}
                                                                        </div>
                                                                    ) : <span className='text-gray-300 font-normal'>—</span>}
                                                                </td>
                                                                {/* Qty changes per component */}
                                                                <td className='px-3 py-2.5'>
                                                                    {isFirst ? (
                                                                        <span className='text-gray-300 text-[10px]'>—</span>
                                                                    ) : qtyRows.length === 0 ? (
                                                                        <span className='text-gray-400 italic text-[10px]'>
                                                                            {deltaItems === 0 ? 'No quantity changes' : 'Components added/removed only'}
                                                                        </span>
                                                                    ) : (
                                                                        <div className='flex flex-col gap-1'>
                                                                            {qtyRows.map(r => (
                                                                                <div key={r.name} className='flex items-center gap-1 flex-wrap'>
                                                                                    <span className='font-medium text-gray-700 truncate max-w-[110px]' title={r.name}>{r.name}:</span>
                                                                                    <span className='font-mono text-red-400 bg-red-50 px-1 rounded'>{r.oldQty}</span>
                                                                                    <span className='text-gray-400'>→</span>
                                                                                    <span className='font-mono text-green-600 font-semibold bg-green-50 px-1 rounded'>{r.newQty}</span>
                                                                                    <span className={`font-bold text-[10px] px-1 rounded ${r.delta > 0 ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                                                                                        ({r.delta > 0 ? '+' : ''}{r.delta})
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className='px-3 py-2.5'>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${v.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                                        {v.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

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
