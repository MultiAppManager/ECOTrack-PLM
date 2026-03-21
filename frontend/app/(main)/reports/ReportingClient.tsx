'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

type EcoStatus = 'Draft' | 'Reviewed' | 'Approved' | 'Rejected'

type EcoRecord = {
    id: string
    title: string
    ecoType: string
    product: string
    bom: string
    user: string
    effectiveDate: string
    versionUpdate: boolean
    status: EcoStatus
}

type ChangeDetail = {
    field: string
    before: string
    after: string
    type: 'increase' | 'decrease' | 'unchanged' | 'updated'
}

const ECO_CHANGES: Record<string, { bom: ChangeDetail[]; product: ChangeDetail[] }> = {}

const generateChanges = (record: EcoRecord) => {
    if (ECO_CHANGES[record.id]) return ECO_CHANGES[record.id]
    const bom: ChangeDetail[] = [
        { field: 'Component A Qty', before: '10', after: '8', type: 'decrease' },
        { field: 'Component B Qty', before: '2', after: '4', type: 'increase' },
        { field: 'Component C Qty', before: '5', after: '5', type: 'unchanged' },
        { field: 'Operation Time', before: '30m', after: '45m', type: 'increase' },
    ]
    const product: ChangeDetail[] = [
        { field: 'Sale Price', before: '$230', after: '$260', type: 'increase' },
        { field: 'Cost Price', before: '$120', after: '$135', type: 'increase' },
        { field: 'Attachment: Spec', before: 'v1.0', after: 'v2.0', type: 'updated' },
        { field: 'Attachment: Drawing', before: 'Rev A', after: 'Rev A', type: 'unchanged' },
    ]
    ECO_CHANGES[record.id] = { bom, product }
    return { bom, product }
}

const statusColor: Record<EcoStatus, string> = {
    Draft: 'bg-gray-100 text-gray-600 border-gray-300',
    Reviewed: 'bg-blue-50 text-blue-700 border-blue-300',
    Approved: 'bg-green-50 text-green-700 border-green-300',
    Rejected: 'bg-red-50 text-red-700 border-red-300',
}

const changeColor: Record<string, string> = {
    increase: 'text-green-600',
    decrease: 'text-red-600',
    unchanged: 'text-gray-500',
    updated: 'text-blue-600',
}

// ---------- PRODUCT VERSION HISTORY (dummy) ----------
const PRODUCT_VERSION_HISTORY = [
    { product: 'Hydraulic Pump Assembly', version: 'v3', date: '2026-03-10', changedBy: 'Alice', ecoRef: 'ECO-1001' },
    { product: 'CNC Spindle Motor', version: 'v2', date: '2026-02-28', changedBy: 'Bob', ecoRef: 'ECO-1002' },
    { product: 'Industrial Gearbox Unit', version: 'v5', date: '2026-02-14', changedBy: 'Carol', ecoRef: 'ECO-1003' },
    { product: 'Servo Control Module', version: 'v1', date: '2026-01-20', changedBy: 'Dan', ecoRef: 'ECO-1004' },
]

// ---------- BOM CHANGE HISTORY (dummy) ----------
const BOM_CHANGE_HISTORY = [
    { bom: 'BOM-1001: Pump Housing Kit', field: 'Steel Ring Qty', before: '4', after: '6', date: '2026-03-10', ecoRef: 'ECO-1001' },
    { bom: 'BOM-1002: Motor Rotor-Stator Set', field: 'Copper Wire Len', before: '2m', after: '2.5m', date: '2026-02-28', ecoRef: 'ECO-1002' },
    { bom: 'BOM-1003: Gear Train Assembly', field: 'Grease Volume', before: '50ml', after: '75ml', date: '2026-02-14', ecoRef: 'ECO-1003' },
    { bom: 'BOM-1005: Servo PCB Assembly', field: 'Capacitor Count', before: '12', after: '14', date: '2026-01-20', ecoRef: 'ECO-1004' },
]

// ---------- ARCHIVED PRODUCTS (dummy) ----------
const ARCHIVED_PRODUCTS = [
    { product: 'Legacy Conveyor Belt v1', archivedDate: '2025-12-01', archivedBy: 'Admin', reason: 'Replaced by v2' },
    { product: 'Old Pressure Valve XR', archivedDate: '2025-10-15', archivedBy: 'Alice', reason: 'Discontinued' },
    { product: 'Pneumatic Arm Gen-1', archivedDate: '2025-08-20', archivedBy: 'Carol', reason: 'End of Life' },
]

// ---------- PRODUCT-VERSION-BOM MATRIX (dummy) ----------
const MATRIX_DATA = [
    { product: 'Hydraulic Pump Assembly', version: 'v3', bom: 'BOM-1001: Pump Housing Kit', status: 'Active' },
    { product: 'CNC Spindle Motor', version: 'v2', bom: 'BOM-1002: Motor Rotor-Stator Set', status: 'Active' },
    { product: 'Industrial Gearbox Unit', version: 'v5', bom: 'BOM-1003: Gear Train Assembly', status: 'Active' },
    { product: 'Conveyor Drive Roller', version: 'v1', bom: 'BOM-1004: Conveyor Roller Kit', status: 'Draft' },
    { product: 'Servo Control Module', version: 'v1', bom: 'BOM-1005: Servo PCB Assembly', status: 'Active' },
]

// ==================== MAIN COMPONENT ====================
const ReportingClient = ({ userRole }: { userRole: string }) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const [ecoRecords, setEcoRecords] = useState<EcoRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'eco' | 'version' | 'bom' | 'archived' | 'matrix'>(userRole === 'Operations User' ? 'version' : 'eco')
    const [selectedEco, setSelectedEco] = useState<EcoRecord | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (userRole === 'Operations User') {
            setIsLoading(false)
            return
        }
        const fetchEco = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/eco-requests`, { credentials: 'include' })
                if (!res.ok) throw new Error('Failed to fetch')
                const data = await res.json()
                setEcoRecords((data as any[]).map((item) => ({
                    id: item.id,
                    title: item.title,
                    ecoType: item.ecoType,
                    product: item.product,
                    bom: item.bom,
                    user: item.requestedBy,
                    effectiveDate: item.effectiveDate || '',
                    versionUpdate: Boolean(item.versionUpdate),
                    status: (item.status || 'Draft') as EcoStatus,
                })))
            } catch {
                toast.error('Failed to load ECO records')
            } finally {
                setIsLoading(false)
            }
        }
        fetchEco()
    }, [API_BASE, userRole])

    const filteredEco = ecoRecords.filter(
        (r) =>
            r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.ecoType.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.product.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const tabs = ([
        { id: 'eco', label: 'ECO Report' },
        { id: 'version', label: 'Product Version History' },
        { id: 'bom', label: 'BoM Change History' },
        { id: 'archived', label: 'Archived Products' },
        { id: 'matrix', label: 'Product–Version–BoM Matrix' },
    ] as const).filter(tab => {
        if (userRole === 'Operations User') {
            return tab.id !== 'eco' && tab.id !== 'bom'
        }
        return true
    })

    return (
        <div className='min-h-screen p-8 bg-gradient-to-br from-slate-50 to-purple-50/30 overflow-x-auto'>
            <div className='max-w-7xl min-w-[900px] mx-auto space-y-6'>

                {/* Page Header - Matched to screenshot */}
                <div className='flex items-center gap-3 mb-2'>
                    <div className='w-1.5 h-8 rounded-full bg-purple-600' />
                    <div className='bg-purple-600/90 text-white px-4 py-1.5 rounded-lg shadow-sm backdrop-blur'>
                        <h1 className='text-lg font-bold tracking-wide'>Reporting</h1>
                    </div>
                </div>

                {/* Tab bar - More consistent and polished */}
                <div className='flex items-center gap-1 bg-white/80 backdrop-blur-sm border border-purple-100 rounded-2xl p-1 shadow-sm w-full overflow-x-auto no-scrollbar'>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={[
                                'px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap',
                                activeTab === tab.id
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'text-purple-400 hover:bg-purple-50 hover:text-purple-700',
                            ].join(' ')}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ====== ECO REPORT ====== */}
                {activeTab === 'eco' && (
                    <div className='bg-white rounded-2xl border border-purple-100 shadow-xl shadow-purple-100/20 overflow-hidden'>
                        <div className='px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 flex items-center justify-between gap-4'>
                            <div>
                                <h2 className='text-lg font-bold text-purple-800 tracking-tight'>
                                    Engineering Change Orders Report
                                </h2>
                                <p className='text-xs text-purple-500 mt-0.5 font-medium'>Full audit trail of all ECO requests</p>
                            </div>
                            <div className='relative'>
                                <input
                                    type='text'
                                    placeholder='Search reports…'
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className='border border-purple-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 w-64 bg-white/80 backdrop-blur transition-all placeholder:text-gray-400'
                                />
                                <span className='absolute right-3 top-2.5 opacity-30'>🔍</span>
                            </div>
                        </div>

                        <div className='overflow-x-auto'>
                            <table className='w-full min-w-[640px]'>
                                <thead className='bg-purple-100/50 border-b-2 border-purple-100'>
                                    <tr>
                                        <th className='text-left p-4 font-bold text-purple-900 text-xs uppercase tracking-wider whitespace-nowrap'>ECO Title</th>
                                        <th className='text-left p-4 font-bold text-purple-900 text-xs uppercase tracking-wider whitespace-nowrap'>ECO Type</th>
                                        <th className='text-left p-4 font-bold text-purple-900 text-xs uppercase tracking-wider whitespace-nowrap'>Product Name</th>
                                        <th className='text-left p-4 font-bold text-purple-900 text-xs uppercase tracking-wider whitespace-nowrap'>Status</th>
                                        <th className='text-left p-4 font-bold text-purple-900 text-xs uppercase tracking-wider whitespace-nowrap'>Changes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className='p-8 text-center text-sm text-gray-500'>
                                                Loading ECO records…
                                            </td>
                                        </tr>
                                    ) : filteredEco.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className='p-8 text-center text-sm text-gray-500'>
                                                No ECO records found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEco.map((record) => (
                                            <tr
                                                key={record.id}
                                                className='border-b border-gray-100 hover:bg-purple-50/50 transition-colors'
                                            >
                                                <td className='p-3 text-sm text-gray-800 font-medium whitespace-nowrap'>{record.title}</td>
                                                <td className='p-3 text-sm text-gray-600 whitespace-nowrap'>{record.ecoType}</td>
                                                <td className='p-3 text-sm text-gray-600 whitespace-nowrap'>{record.product}</td>
                                                <td className='p-3 text-sm whitespace-nowrap'>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor[record.status]}`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td className='p-3 whitespace-nowrap'>
                                                    <button
                                                        onClick={() => setSelectedEco(record)}
                                                        className='px-3 py-1 rounded-md text-xs font-semibold border-2 border-purple-400 text-purple-700 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all duration-150 shadow-sm'
                                                    >
                                                        Changes
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ====== PRODUCT VERSION HISTORY ====== */}
                {activeTab === 'version' && (
                    <div className='bg-white rounded-2xl border border-purple-100 shadow-xl shadow-purple-100/20 overflow-hidden'>
                        <div className='px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-purple-100'>
                            <h2 className='text-lg font-bold text-purple-800 tracking-tight'>Product Version History</h2>
                            <p className='text-xs text-indigo-500 mt-0.5 font-medium'>Track all version changes across products</p>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='w-full min-w-[540px]'>
                                <thead className='bg-purple-50 border-b border-purple-200'>
                                    <tr>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Product</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Version</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Date</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Changed By</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>ECO Ref</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {PRODUCT_VERSION_HISTORY.map((row, i) => (
                                        <tr key={i} className='border-b border-gray-100 hover:bg-purple-50/50 transition-colors'>
                                            <td className='p-3 text-sm text-gray-800 font-medium'>{row.product}</td>
                                            <td className='p-3 text-sm'>
                                                <span className='inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200'>{row.version}</span>
                                            </td>
                                            <td className='p-3 text-sm text-gray-600'>{row.date}</td>
                                            <td className='p-3 text-sm text-gray-600'>{row.changedBy}</td>
                                            <td className='p-3 text-sm text-purple-600 font-medium'>{row.ecoRef}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ====== BOM CHANGE HISTORY ====== */}
                {activeTab === 'bom' && (
                    <div className='bg-white rounded-2xl border border-purple-100 shadow-xl shadow-purple-100/20 overflow-hidden'>
                        <div className='px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100'>
                            <h2 className='text-lg font-bold text-purple-800 tracking-tight'>BoM Change History</h2>
                            <p className='text-xs text-purple-500 mt-0.5 font-medium'>All Bill of Materials field-level changes</p>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='w-full min-w-[600px]'>
                                <thead className='bg-purple-50 border-b border-purple-200'>
                                    <tr>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Bill of Materials</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Field Changed</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Before</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>After</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Date</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>ECO Ref</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {BOM_CHANGE_HISTORY.map((row, i) => (
                                        <tr key={i} className='border-b border-gray-100 hover:bg-purple-50/50 transition-colors'>
                                            <td className='p-3 text-sm text-gray-800 font-medium'>{row.bom}</td>
                                            <td className='p-3 text-sm text-gray-600'>{row.field}</td>
                                            <td className='p-3 text-sm text-red-500 font-medium'>{row.before}</td>
                                            <td className='p-3 text-sm text-green-600 font-medium'>{row.after}</td>
                                            <td className='p-3 text-sm text-gray-600'>{row.date}</td>
                                            <td className='p-3 text-sm text-purple-600 font-medium'>{row.ecoRef}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ====== ARCHIVED PRODUCTS ====== */}
                {activeTab === 'archived' && (
                    <div className='bg-white rounded-2xl border border-purple-100 shadow-xl shadow-purple-100/20 overflow-hidden'>
                        <div className='px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-purple-100'>
                            <h2 className='text-lg font-bold text-purple-800 tracking-tight'>Archived Products</h2>
                            <p className='text-xs text-indigo-500 mt-0.5 font-medium'>Products no longer in active production</p>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='w-full min-w-[520px]'>
                                <thead className='bg-purple-50 border-b border-purple-200'>
                                    <tr>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Product</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Archived Date</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Archived By</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ARCHIVED_PRODUCTS.map((row, i) => (
                                        <tr key={i} className='border-b border-gray-100 hover:bg-purple-50/50 transition-colors'>
                                            <td className='p-3 text-sm text-gray-800 font-medium'>{row.product}</td>
                                            <td className='p-3 text-sm text-gray-600'>{row.archivedDate}</td>
                                            <td className='p-3 text-sm text-gray-600'>{row.archivedBy}</td>
                                            <td className='p-3 text-sm'>
                                                <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300'>{row.reason}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ====== MATRIX ====== */}
                {activeTab === 'matrix' && (
                    <div className='bg-white rounded-2xl border border-purple-100 shadow-xl shadow-purple-100/20 overflow-hidden'>
                        <div className='px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100'>
                            <h2 className='text-lg font-bold text-purple-800 tracking-tight'>Product – Version – BoM Matrix</h2>
                            <p className='text-xs text-purple-500 mt-0.5 font-medium'>Current state of all product versions and their linked BoMs</p>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='w-full min-w-[580px]'>
                                <thead className='bg-purple-50 border-b border-purple-200'>
                                    <tr>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Product</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Version</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Bill of Materials</th>
                                        <th className='text-left p-3 font-semibold text-purple-800 text-sm'>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MATRIX_DATA.map((row, i) => (
                                        <tr key={i} className='border-b border-gray-100 hover:bg-purple-50/50 transition-colors'>
                                            <td className='p-3 text-sm text-gray-800 font-medium'>{row.product}</td>
                                            <td className='p-3 text-sm'>
                                                <span className='inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200'>{row.version}</span>
                                            </td>
                                            <td className='p-3 text-sm text-gray-600'>{row.bom}</td>
                                            <td className='p-3 text-sm'>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${row.status === 'Active' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ====== CHANGES MODAL ====== */}
            {selectedEco && (() => {
                const changes = generateChanges(selectedEco)
                return (
                    <div
                        className='fixed inset-0 z-50 flex items-center justify-center p-4'
                        style={{ background: 'rgba(10,5,30,0.65)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setSelectedEco(null)}
                    >
                        <div
                            className='bg-white rounded-2xl shadow-2xl border-2 border-purple-200 w-full max-w-2xl max-h-[85vh] overflow-y-auto'
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal header */}
                            <div className='sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-purple-200 flex items-start justify-between gap-4 z-10'>
                                <div>
                                    <h3 className='text-lg font-bold text-purple-700'>Change Comparison</h3>
                                    <p className='text-sm text-gray-500 mt-0.5'>
                                        <span className='font-semibold text-gray-700'>{selectedEco.title}</span>
                                        {' · '}{selectedEco.ecoType}{' · '}{selectedEco.product}
                                    </p>
                                </div>
                                <div className='flex items-center gap-2 flex-shrink-0'>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor[selectedEco.status]}`}>
                                        {selectedEco.status}
                                    </span>
                                    <button
                                        onClick={() => setSelectedEco(null)}
                                        className='w-8 h-8 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors text-lg leading-none'
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            {/* Modal body */}
                            <div className='px-6 py-5 space-y-6'>
                                {/* BoM Changes */}
                                <div>
                                    <h4 className='font-semibold text-purple-700 mb-3 flex items-center gap-2'>
                                        <span className='w-2 h-2 rounded-full bg-purple-500 inline-block' />
                                        BoM Change Comparison
                                    </h4>
                                    <div className='border border-purple-200 rounded-xl overflow-hidden'>
                                        <table className='w-full text-sm'>
                                            <thead className='bg-purple-50'>
                                                <tr>
                                                    <th className='text-left px-4 py-2 font-semibold text-purple-800'>Field</th>
                                                    <th className='text-left px-4 py-2 font-semibold text-purple-800'>Before</th>
                                                    <th className='text-left px-4 py-2 font-semibold text-purple-800'>After</th>
                                                    <th className='text-left px-4 py-2 font-semibold text-purple-800'>Δ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {changes.bom.map((c, i) => (
                                                    <tr key={i} className='border-t border-purple-100'>
                                                        <td className='px-4 py-2.5 text-gray-700'>{c.field}</td>
                                                        <td className='px-4 py-2.5 text-red-500'>{c.before}</td>
                                                        <td className='px-4 py-2.5 text-green-600'>{c.after}</td>
                                                        <td className={`px-4 py-2.5 font-semibold text-xs ${changeColor[c.type]}`}>
                                                            {c.type === 'unchanged' ? '—' : c.type.toUpperCase()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Product Changes */}
                                <div>
                                    <h4 className='font-semibold text-purple-700 mb-3 flex items-center gap-2'>
                                        <span className='w-2 h-2 rounded-full bg-indigo-500 inline-block' />
                                        Product Change Comparison
                                    </h4>
                                    <div className='border border-purple-200 rounded-xl overflow-hidden'>
                                        <table className='w-full text-sm'>
                                            <thead className='bg-purple-50'>
                                                <tr>
                                                    <th className='text-left px-4 py-2 font-semibold text-purple-800'>Field</th>
                                                    <th className='text-left px-4 py-2 font-semibold text-purple-800'>Before</th>
                                                    <th className='text-left px-4 py-2 font-semibold text-purple-800'>After</th>
                                                    <th className='text-left px-4 py-2 font-semibold text-purple-800'>Δ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {changes.product.map((c, i) => (
                                                    <tr key={i} className='border-t border-purple-100'>
                                                        <td className='px-4 py-2.5 text-gray-700'>{c.field}</td>
                                                        <td className='px-4 py-2.5 text-red-500'>{c.before}</td>
                                                        <td className='px-4 py-2.5 text-green-600'>{c.after}</td>
                                                        <td className={`px-4 py-2.5 font-semibold text-xs ${changeColor[c.type]}`}>
                                                            {c.type === 'unchanged' ? '—' : c.type.toUpperCase()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className='px-6 pb-5'>
                                <button
                                    onClick={() => setSelectedEco(null)}
                                    className='w-full py-2.5 rounded-lg border-2 border-purple-300 text-purple-700 font-semibold text-sm hover:bg-purple-50 transition-colors'
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}

export default ReportingClient
