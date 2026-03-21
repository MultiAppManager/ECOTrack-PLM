'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────
type AttachmentMeta = {
    name: string
    type: string
    size: number
    dataUrl?: string
}

type Product = {
    id: string
    name: string
    salePrice: number | string
    costPrice: number | string
    attachments: AttachmentMeta[]
    currentVersion: number
    status: 'Active' | 'Archived'
    createdAt: string
    updatedAt: string
}

type FormState = {
    name: string
    salePrice: string
    costPrice: string
    attachments: AttachmentMeta[]
}

const EMPTY_FORM: FormState = { name: '', salePrice: '', costPrice: '', attachments: [] }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtCurrency = (v: number | string) =>
    '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fileSizeLabel = (bytes: number) => {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${bytes} B`
}

const ALLOWED_TYPES = [
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

function fileIcon(type: string) {
    if (type.includes('pdf')) return '📄'
    if (type.includes('image')) return '🖼️'
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊'
    if (type.includes('word') || type.includes('document')) return '📝'
    return '📎'
}

// ─── Main Component ───────────────────────────────────────────────────────────
type Props = { userRole: string; canWrite: boolean }

const ProductsClient = ({ canWrite }: Props) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Archived'>('All')

    // Modals
    const [showCreate, setShowCreate] = useState(false)
    const [editProduct, setEditProduct] = useState<Product | null>(null)
    const [detailProduct, setDetailProduct] = useState<Product | null>(null)
    const [archiveTarget, setArchiveTarget] = useState<Product | null>(null)

    // Form
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [isSaving, setIsSaving] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // ─── Fetch ────────────────────────────────────────────────────────────────
    const fetchProducts = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`${API_BASE}/api/products`, { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch')
            const data: any[] = await res.json()
            setProducts(data.map(p => ({
                ...p,
                attachments: Array.isArray(p.attachments) ? p.attachments : [],
            })))
        } catch {
            toast.error('Failed to load products')
        } finally {
            setIsLoading(false)
        }
    }, [API_BASE])

    useEffect(() => { fetchProducts() }, [fetchProducts])

    // ─── Filtered list ────────────────────────────────────────────────────────
    const filtered = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchStatus = statusFilter === 'All' || p.status === statusFilter
        return matchSearch && matchStatus
    })

    // ─── File upload handler ──────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        files.forEach(file => {
            if (!ALLOWED_TYPES.includes(file.type)) {
                toast.error(`${file.name}: unsupported file type`)
                return
            }
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`${file.name}: max size is 10 MB`)
                return
            }
            const reader = new FileReader()
            reader.onload = ev => {
                setForm(prev => ({
                    ...prev,
                    attachments: [
                        ...prev.attachments,
                        { name: file.name, type: file.type, size: file.size, dataUrl: ev.target?.result as string }
                    ]
                }))
            }
            reader.readAsDataURL(file)
        })
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removeAttachment = (idx: number) =>
        setForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))

    // ─── Create ───────────────────────────────────────────────────────────────
    const openCreate = () => { setForm(EMPTY_FORM); setShowCreate(true) }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) { toast.error('Product name is required'); return }
        setIsSaving(true)
        try {
            const res = await fetch(`${API_BASE}/api/products`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    salePrice: parseFloat(form.salePrice) || 0,
                    costPrice: parseFloat(form.costPrice) || 0,
                    attachments: form.attachments.map(({ name, type, size }) => ({ name, type, size })),
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Create failed')
            toast.success('Product created successfully')
            setShowCreate(false)
            fetchProducts()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    // ─── Edit / Update ────────────────────────────────────────────────────────
    const openEdit = (p: Product) => {
        setForm({ name: p.name, salePrice: String(p.salePrice), costPrice: String(p.costPrice), attachments: p.attachments })
        setEditProduct(p)
        setDetailProduct(null)
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editProduct || !form.name.trim()) { toast.error('Product name is required'); return }
        setIsSaving(true)
        try {
            const res = await fetch(`${API_BASE}/api/products/${editProduct.id}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    salePrice: parseFloat(form.salePrice) || 0,
                    costPrice: parseFloat(form.costPrice) || 0,
                    attachments: form.attachments.map(({ name, type, size }) => ({ name, type, size })),
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Update failed')
            toast.success('Product updated')
            setEditProduct(null)
            fetchProducts()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    // ─── Archive / Restore ────────────────────────────────────────────────────
    const handleStatusToggle = async (p: Product) => {
        const newStatus = p.status === 'Active' ? 'Archived' : 'Active'
        try {
            const res = await fetch(`${API_BASE}/api/products/${p.id}/status`, {
                method: 'PATCH', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')
            toast.success(`Product ${newStatus === 'Archived' ? 'archived' : 'restored'}`)
            setArchiveTarget(null)
            setDetailProduct(null)
            fetchProducts()
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    const activeCount = products.filter(p => p.status === 'Active').length
    const archivedCount = products.filter(p => p.status === 'Archived').length

    return (
        <div className='flex-1 bg-white min-h-screen'>
            {/* ── Top Bar ── */}
            <div className='px-8 pt-7 pb-4 flex items-center justify-between gap-4 border-b border-gray-100'>
                <h1 className='text-2xl font-bold text-[#7c3aed]'>Product Master</h1>
                {canWrite && (
                    <button
                        id='btn-new-product'
                        onClick={openCreate}
                        className='flex items-center gap-2 px-5 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm transition-colors shadow-sm'
                    >
                        <span className='text-base leading-none font-bold'>+</span> New
                    </button>
                )}
            </div>

            <div className='px-8 py-6 space-y-5'>

                {/* ── Stats Row ── */}
                <div className='flex items-center gap-4'>
                    {[
                        { label: 'Total Products', value: products.length, onClick: () => setStatusFilter('All'), active: statusFilter === 'All', color: 'text-[#7c3aed]' },
                        { label: 'Active', value: activeCount, onClick: () => setStatusFilter('Active'), active: statusFilter === 'Active', color: 'text-emerald-600' },
                        { label: 'Archived', value: archivedCount, onClick: () => setStatusFilter('Archived'), active: statusFilter === 'Archived', color: 'text-gray-500' },
                    ].map(s => (
                        <button
                            key={s.label}
                            onClick={s.onClick}
                            className={[
                                'flex items-center gap-3 px-5 py-3 rounded-xl border-2 transition-all duration-150 cursor-pointer text-left',
                                s.active
                                    ? 'border-[#7c3aed] bg-purple-50'
                                    : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50/40'
                            ].join(' ')}
                        >
                            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                            <span className='text-xs text-gray-500 font-medium leading-tight'>{s.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Search + Filter ── */}
                <div className='flex items-center gap-3'>
                    <input
                        id='product-search'
                        type='text'
                        placeholder='Search Bar'
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className='flex-1 border-2 border-purple-300 rounded-lg px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition'
                    />
                    <div className='flex items-center gap-2'>
                        {(['All', 'Active', 'Archived'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                className={[
                                    'px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all duration-150',
                                    statusFilter === f
                                        ? 'bg-[#7c3aed] text-white border-[#7c3aed]'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-purple-300 hover:text-purple-700'
                                ].join(' ')}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Table ── */}
                <div className='rounded-2xl border-2 border-purple-100 overflow-hidden'>
                    <table className='w-full'>
                        <thead>
                            <tr className='border-b-2 border-purple-100'>
                                <th className='text-left px-6 py-3.5 text-sm font-bold text-[#7c3aed]'>Product Name</th>
                                <th className='text-left px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Sale Price</th>
                                <th className='text-left px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Cost Price</th>
                                <th className='text-center px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Version</th>
                                <th className='text-center px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Attachments</th>
                                <th className='text-center px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Status</th>
                                <th className='text-center px-4 py-3.5 text-sm font-bold text-[#7c3aed]'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className='py-16 text-center'>
                                        <div className='flex flex-col items-center gap-3'>
                                            <div className='w-7 h-7 border-2 border-purple-200 border-t-[#7c3aed] rounded-full animate-spin' />
                                            <p className='text-gray-400 text-sm'>Loading products…</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className='py-16 text-center'>
                                        <p className='text-gray-400 text-sm'>No products found.</p>
                                        {canWrite && searchTerm === '' && statusFilter === 'All' && (
                                            <button onClick={openCreate} className='mt-3 text-[#7c3aed] text-sm font-semibold hover:underline'>
                                                + Create your first product
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((p) => (
                                    <tr
                                        key={p.id}
                                        className={[
                                            'border-b border-gray-100 transition-colors group',
                                            p.status === 'Archived' ? 'bg-gray-50' : 'hover:bg-purple-50/30'
                                        ].join(' ')}
                                    >
                                        {/* Name */}
                                        <td className='px-6 py-3.5'>
                                            <button
                                                onClick={() => setDetailProduct(p)}
                                                className={[
                                                    'text-sm font-medium text-left hover:underline transition-colors',
                                                    p.status === 'Archived'
                                                        ? 'text-gray-400 line-through decoration-gray-300'
                                                        : 'text-gray-800 hover:text-[#7c3aed]'
                                                ].join(' ')}
                                            >
                                                {p.name}
                                            </button>
                                        </td>
                                        {/* Sale Price */}
                                        <td className='px-4 py-3.5 text-sm text-gray-700'>{fmtCurrency(p.salePrice)}</td>
                                        {/* Cost Price */}
                                        <td className='px-4 py-3.5 text-sm text-gray-700'>{fmtCurrency(p.costPrice)}</td>
                                        {/* Version */}
                                        <td className='px-4 py-3.5 text-center'>
                                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-[#7c3aed] border border-purple-200'>
                                                v{p.currentVersion}
                                            </span>
                                        </td>
                                        {/* Attachments */}
                                        <td className='px-4 py-3.5 text-center'>
                                            {p.attachments.length > 0 ? (
                                                <span className='inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold'>
                                                    📎 {p.attachments.length}
                                                </span>
                                            ) : (
                                                <span className='text-gray-300 text-xs'>—</span>
                                            )}
                                        </td>
                                        {/* Status */}
                                        <td className='px-4 py-3.5 text-center'>
                                            <span className={[
                                                'inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold border',
                                                p.status === 'Active'
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : 'bg-gray-100 text-gray-500 border-gray-300'
                                            ].join(' ')}>
                                                {p.status}
                                            </span>
                                        </td>
                                        {/* Actions */}
                                        <td className='px-4 py-3.5'>
                                            <div className='flex items-center justify-center gap-1.5'>
                                                <button
                                                    onClick={() => setDetailProduct(p)}
                                                    className='px-3 py-1 rounded-lg text-xs font-semibold border border-purple-300 text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white hover:border-[#7c3aed] transition-all duration-150'
                                                >
                                                    View
                                                </button>
                                                {canWrite && p.status === 'Active' && (
                                                    <button
                                                        onClick={() => openEdit(p)}
                                                        className='px-3 py-1 rounded-lg text-xs font-semibold border border-indigo-300 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all duration-150'
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                {canWrite && (
                                                    <button
                                                        onClick={() => setArchiveTarget(p)}
                                                        className={[
                                                            'px-3 py-1 rounded-lg text-xs font-semibold border transition-all duration-150',
                                                            p.status === 'Active'
                                                                ? 'border-orange-300 text-orange-600 hover:bg-orange-500 hover:text-white hover:border-orange-500'
                                                                : 'border-emerald-300 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
                                                        ].join(' ')}
                                                    >
                                                        {p.status === 'Active' ? 'Archive' : 'Restore'}
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

                {/* Row count */}
                {!isLoading && filtered.length > 0 && (
                    <p className='text-xs text-gray-400 text-right'>
                        {filtered.length} record{filtered.length !== 1 ? 's' : ''} shown
                    </p>
                )}
            </div>

            {/* ══════════════ DETAIL MODAL ══════════════ */}
            {detailProduct && (
                <div
                    className='fixed inset-0 z-50 flex items-center justify-center p-4'
                    style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setDetailProduct(null)}
                >
                    <div
                        className='bg-white rounded-2xl shadow-2xl border-2 border-purple-100 w-full max-w-lg max-h-[85vh] overflow-y-auto'
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className='sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-purple-100 flex items-start justify-between gap-3 z-10 rounded-t-2xl'>
                            <div className='flex-1 min-w-0'>
                                <div className='flex items-center gap-2 flex-wrap'>
                                    <h3 className={`text-lg font-bold truncate ${detailProduct.status === 'Archived' ? 'text-gray-400 line-through' : 'text-[#7c3aed]'}`}>
                                        {detailProduct.name}
                                    </h3>
                                    <span className={[
                                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0',
                                        detailProduct.status === 'Active'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-gray-100 text-gray-500 border-gray-300'
                                    ].join(' ')}>
                                        {detailProduct.status}
                                    </span>
                                </div>
                                <p className='text-xs text-gray-400 mt-0.5'>
                                    Created {new Date(detailProduct.createdAt).toLocaleDateString('en-IN')}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetailProduct(null)}
                                className='w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-xl leading-none'
                            >×</button>
                        </div>

                        {/* Body */}
                        <div className='px-6 py-5 space-y-5'>
                            {detailProduct.status === 'Archived' && (
                                <div className='flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700'>
                                    <span>⚠️</span>
                                    <span>This product is <strong>archived</strong> — read-only, not selectable in BoMs or ECOs.</span>
                                </div>
                            )}

                            {/* Prices + Version */}
                            <div className='grid grid-cols-3 gap-3'>
                                {[
                                    { label: 'Sale Price', value: fmtCurrency(detailProduct.salePrice), border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-[#7c3aed]' },
                                    { label: 'Cost Price', value: fmtCurrency(detailProduct.costPrice), border: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-700' },
                                    { label: 'Version', value: `v${detailProduct.currentVersion}`, border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-700', note: 'Set by ECO' },
                                ].map(f => (
                                    <div key={f.label} className={`rounded-xl border ${f.bg} ${f.border} p-3`}>
                                        <p className='text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1'>{f.label}</p>
                                        <p className={`text-base font-bold ${f.text}`}>{f.value}</p>
                                        {'note' in f && <p className='text-[9px] text-gray-400 mt-0.5'>{f.note}</p>}
                                    </div>
                                ))}
                            </div>

                            {/* Attachments */}
                            <div>
                                <p className='text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2'>Attachments</p>
                                {detailProduct.attachments.length === 0 ? (
                                    <p className='text-sm text-gray-400 italic'>No attachments added</p>
                                ) : (
                                    <div className='space-y-2'>
                                        {detailProduct.attachments.map((a, i) => (
                                            <div key={i} className='flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50'>
                                                <span className='text-lg'>{fileIcon(a.type)}</span>
                                                <div className='flex-1 min-w-0'>
                                                    <p className='text-sm text-gray-700 font-medium truncate'>{a.name}</p>
                                                    <p className='text-[10px] text-gray-400'>{fileSizeLabel(a.size)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className='grid grid-cols-2 gap-3 text-xs text-gray-400 border-t pt-4'>
                                <div><span className='font-semibold'>Created:</span> {new Date(detailProduct.createdAt).toLocaleString('en-IN')}</div>
                                <div><span className='font-semibold'>Updated:</span> {new Date(detailProduct.updatedAt).toLocaleString('en-IN')}</div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className='px-6 pb-5 flex gap-2'>
                            {canWrite && detailProduct.status === 'Active' && (
                                <button
                                    onClick={() => openEdit(detailProduct)}
                                    className='flex-1 py-2.5 rounded-xl border-2 border-[#7c3aed] text-[#7c3aed] font-semibold text-sm hover:bg-purple-50 transition-colors'
                                >
                                    Edit Product
                                </button>
                            )}
                            {canWrite && (
                                <button
                                    onClick={() => { setArchiveTarget(detailProduct); setDetailProduct(null) }}
                                    className={[
                                        'flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm transition-colors',
                                        detailProduct.status === 'Active'
                                            ? 'border-orange-300 text-orange-600 hover:bg-orange-50'
                                            : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                                    ].join(' ')}
                                >
                                    {detailProduct.status === 'Active' ? 'Archive' : 'Restore'}
                                </button>
                            )}
                            <button
                                onClick={() => setDetailProduct(null)}
                                className='flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors'
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════ CREATE / EDIT MODAL ══════════════ */}
            {(showCreate || editProduct) && (
                <div
                    className='fixed inset-0 z-50 flex items-center justify-center p-4'
                    style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                    onClick={() => { setShowCreate(false); setEditProduct(null) }}
                >
                    <div
                        className='bg-white rounded-2xl shadow-2xl border-2 border-purple-100 w-full max-w-lg max-h-[90vh] overflow-y-auto'
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className='sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-purple-100 flex items-center justify-between z-10 rounded-t-2xl'>
                            <div>
                                <h3 className='text-lg font-bold text-[#7c3aed]'>
                                    {editProduct ? 'Edit Product' : 'New Product'}
                                </h3>
                                <p className='text-xs text-gray-400 mt-0.5'>
                                    {editProduct ? 'Update product details. Version is managed by ECO.' : 'Fill in the fields to register a new product.'}
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowCreate(false); setEditProduct(null) }}
                                className='w-8 h-8 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors text-xl'
                            >×</button>
                        </div>

                        {/* Form */}
                        <form onSubmit={editProduct ? handleUpdate : handleCreate} className='px-6 py-5 space-y-5'>
                            {/* Product Name */}
                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1.5'>
                                    Product Name <span className='text-red-500'>*</span>
                                    <span className='text-gray-400 font-normal ml-2 text-xs'>max 255 chars</span>
                                </label>
                                <input
                                    id='field-product-name'
                                    type='text'
                                    maxLength={255}
                                    required
                                    placeholder='e.g. Hydraulic Pump Assembly'
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className='w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition'
                                />
                                <p className='text-[10px] text-gray-400 mt-0.5 text-right'>{form.name.length}/255</p>
                            </div>

                            {/* Prices */}
                            <div className='grid grid-cols-2 gap-4'>
                                <div>
                                    <label className='block text-sm font-semibold text-gray-700 mb-1.5'>Sale Price (₹)</label>
                                    <input
                                        id='field-sale-price'
                                        type='number' min='0' step='0.01' placeholder='0.00'
                                        value={form.salePrice}
                                        onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))}
                                        className='w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-semibold text-gray-700 mb-1.5'>Cost Price (₹)</label>
                                    <input
                                        id='field-cost-price'
                                        type='number' min='0' step='0.01' placeholder='0.00'
                                        value={form.costPrice}
                                        onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                                        className='w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition'
                                    />
                                </div>
                            </div>

                            {/* Version (read-only) */}
                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1.5'>
                                    Current Version
                                    <span className='ml-2 text-[10px] text-[#7c3aed] font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200'>
                                        Read-only · updated via ECO
                                    </span>
                                </label>
                                <div className='flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50'>
                                    <span className='text-[#7c3aed] text-sm font-bold'>v{editProduct ? editProduct.currentVersion : 1}</span>
                                    <span className='text-gray-400 text-xs'>— automatically incremented on ECO approval</span>
                                </div>
                            </div>

                            {/* Attachments */}
                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1.5'>
                                    Attachments
                                    <span className='ml-2 text-[10px] text-gray-400 font-normal'>PDF, Excel, Word, Images · max 10 MB each</span>
                                </label>
                                <input ref={fileInputRef} type='file' multiple
                                    accept='.pdf,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg,.webp'
                                    onChange={handleFileChange} className='hidden' id='file-upload-input' />
                                <button
                                    type='button'
                                    onClick={() => fileInputRef.current?.click()}
                                    className='w-full py-3 border-2 border-dashed border-purple-300 rounded-xl text-sm text-[#7c3aed] font-semibold hover:bg-purple-50 hover:border-purple-400 transition-all flex items-center justify-center gap-2'
                                >
                                    ⬆️ Upload Files
                                </button>
                                {form.attachments.length > 0 && (
                                    <div className='mt-3 space-y-2'>
                                        {form.attachments.map((a, i) => (
                                            <div key={i} className='flex items-center gap-2.5 px-3 py-2 rounded-lg border border-purple-100 bg-purple-50'>
                                                <span className='text-base'>{fileIcon(a.type)}</span>
                                                <div className='flex-1 min-w-0'>
                                                    <p className='text-sm text-gray-700 font-medium truncate'>{a.name}</p>
                                                    <p className='text-[10px] text-gray-400'>{fileSizeLabel(a.size)}</p>
                                                </div>
                                                <button type='button' onClick={() => removeAttachment(i)}
                                                    className='text-red-400 hover:text-red-600 text-lg leading-none transition-colors'>×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className='flex gap-3 pt-2 border-t border-gray-100'>
                                <button
                                    type='button'
                                    onClick={() => { setShowCreate(false); setEditProduct(null) }}
                                    className='flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    disabled={isSaving}
                                    className='flex-1 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm shadow-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                                >
                                    {isSaving ? 'Saving…' : editProduct ? 'Save Changes' : 'Create Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════ ARCHIVE CONFIRM ══════════════ */}
            {archiveTarget && (
                <div
                    className='fixed inset-0 z-50 flex items-center justify-center p-4'
                    style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setArchiveTarget(null)}
                >
                    <div
                        className='bg-white rounded-2xl shadow-2xl border-2 border-orange-200 w-full max-w-sm p-6'
                        onClick={e => e.stopPropagation()}
                    >
                        <div className='text-center space-y-3'>
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl ${archiveTarget.status === 'Active' ? 'bg-orange-100' : 'bg-emerald-100'}`}>
                                {archiveTarget.status === 'Active' ? '📦' : '♻️'}
                            </div>
                            <h3 className='text-lg font-bold text-gray-800'>
                                {archiveTarget.status === 'Active' ? 'Archive Product?' : 'Restore Product?'}
                            </h3>
                            <p className='text-sm text-gray-500'>
                                {archiveTarget.status === 'Active'
                                    ? <><strong className='text-gray-700'>{archiveTarget.name}</strong> will become read-only and hidden from BoMs &amp; ECOs. It remains visible for traceability.</>
                                    : <><strong className='text-gray-700'>{archiveTarget.name}</strong> will be restored to active status and can be used in BoMs &amp; ECOs again.</>
                                }
                            </p>
                        </div>
                        <div className='flex gap-2 mt-5'>
                            <button
                                onClick={() => setArchiveTarget(null)}
                                className='flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleStatusToggle(archiveTarget)}
                                className={[
                                    'flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-150 shadow-sm',
                                    archiveTarget.status === 'Active'
                                        ? 'bg-orange-500 hover:bg-orange-600'
                                        : 'bg-emerald-500 hover:bg-emerald-600'
                                ].join(' ')}
                            >
                                {archiveTarget.status === 'Active' ? 'Archive' : 'Restore'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProductsClient
