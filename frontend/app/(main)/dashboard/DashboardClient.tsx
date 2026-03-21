'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

type DashboardClientProps = {
    userName: string
    userRole: string
    canCreateEco: boolean
}

type EcoStatus = 'New' | 'In Progress' | 'Reviewed' | 'Rejected' | 'Approved'

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

const DUMMY_PRODUCTS = [
    'Hydraulic Pump Assembly',
    'CNC Spindle Motor',
    'Industrial Gearbox Unit',
    'Conveyor Drive Roller',
    'Servo Control Module',
    'Pneumatic Valve Block',
    'Heat Exchanger Core',
    'Pressure Sensor Board',
    'Packaging Line Actuator',
    'Welding Fixture Frame',
]

const DUMMY_BOMS = [
    'BOM-1001: Pump Housing Kit',
    'BOM-1002: Motor Rotor-Stator Set',
    'BOM-1003: Gear Train Assembly',
    'BOM-1004: Conveyor Roller Kit',
    'BOM-1005: Servo PCB Assembly',
    'BOM-1006: Valve Seal & Spring Set',
    'BOM-1007: Exchanger Tube Stack',
    'BOM-1008: Sensor Calibration Pack',
    'BOM-1009: Actuator Linkage Set',
    'BOM-1010: Fixture Clamp Bundle',
]

const DashboardClient = ({ userName, userRole, canCreateEco }: DashboardClientProps) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const [showNewForm, setShowNewForm] = useState(false)
    const [ecoRecords, setEcoRecords] = useState<EcoRecord[]>([])
    const [title, setTitle] = useState('')
    const [ecoType, setEcoType] = useState('Products')
    const [product, setProduct] = useState('')
    const [bom, setBom] = useState('')
    const [ecoUser, setEcoUser] = useState(userName || '')
    const [effectiveDate, setEffectiveDate] = useState('')
    const [versionUpdate, setVersionUpdate] = useState(false)
    const [status, setStatus] = useState<EcoStatus>('New')
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const canReviewEco = userRole === 'Approver' || userRole === 'Admin'

    const loadEcoRequests = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/eco-requests`, {
                credentials: 'include',
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to fetch ECO requests')
            }
            setEcoRecords(
                (data as any[]).map((item) => ({
                    id: item.id,
                    title: item.title,
                    ecoType: item.ecoType,
                    product: item.product,
                    bom: item.bom,
                    user: item.requestedBy,
                    effectiveDate: item.effectiveDate || '',
                    versionUpdate: Boolean(item.versionUpdate),
                    status: (item.status || 'New') as EcoStatus,
                }))
            )
        } catch (error: any) {
            toast.error(error.message || 'Failed to load ECO requests')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadEcoRequests()
    }, [])

    const resetForm = () => {
        setTitle('')
        setEcoType('Products')
        setProduct('')
        setBom('')
        setEcoUser(userName || '')
        setEffectiveDate('')
        setVersionUpdate(false)
        setStatus('New')
    }

    const handleSave = async () => {
        if (!canCreateEco) {
            toast.error('Only Admin or Engineering User can create ECO requests')
            return
        }

        if (!title.trim() || !ecoType || !product || !bom || !ecoUser.trim()) {
            toast.error('Please fill all mandatory fields')
            return
        }

        setIsSaving(true)
        try {
            const response = await fetch(`${API_BASE}/api/eco-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: title.trim(),
                    ecoType,
                    product,
                    bom,
                    user: ecoUser.trim(),
                    effectiveDate: effectiveDate || null,
                    versionUpdate,
                    status,
                }),
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to save ECO request')
            }
            toast.success('ECO saved successfully')
            setShowNewForm(false)
            resetForm()
            await loadEcoRequests()
        } catch (error: any) {
            toast.error(error.message || 'Failed to save ECO request')
        } finally {
            setIsSaving(false)
        }
    }

    const updateEcoStatus = async (id: string, nextStatus: EcoStatus) => {
        if (!canReviewEco) {
            toast.error('Only Approver or Admin can update ECO status')
            return
        }
        try {
            const response = await fetch(`${API_BASE}/api/eco-requests/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: nextStatus }),
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to update ECO status')
            }
            setEcoRecords((prev) =>
                prev.map((row) => (row.id === id ? { ...row, status: nextStatus } : row))
            )
            toast.success(`ECO status updated to ${nextStatus}`)
        } catch (error: any) {
            toast.error(error.message || 'Failed to update ECO status')
        }
    }

    return (
        <div className='min-h-screen p-6'>
            <div className='max-w-7xl mx-auto space-y-5'>
                <div className='bg-white rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden'>
                    <div className='px-5 py-3 border-b border-purple-200 flex items-center justify-between gap-3'>
                        <h1 className='text-base md:text-lg font-semibold text-purple-700'>
                            Engineering Change Orders (ECO&apos;s)
                        </h1>
                        <div className='w-8 h-8 rounded-full border border-purple-300 flex items-center justify-center text-purple-600 text-sm'>
                            {userName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    </div>

                    <div className='px-5 py-3 border-b border-purple-100 flex flex-wrap items-center gap-3'>
                        {canCreateEco && (
                            <button
                                onClick={() => setShowNewForm(true)}
                                className='px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors'
                            >
                                New
                            </button>
                        )}
                        <input
                            type='text'
                            placeholder='Search Bar'
                            className='flex-1 min-w-[220px] border-2 border-purple-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                        />
                        <button className='px-3 py-1.5 rounded-lg border-2 border-purple-300 text-purple-700 text-sm font-semibold bg-white hover:bg-purple-50 transition-colors'>
                            Filters
                        </button>
                    </div>

                    <div className='overflow-x-auto'>
                        <table className='w-full min-w-[700px]'>
                            <thead className='bg-purple-50 border-b border-purple-200'>
                                <tr>
                                    <th className='text-left p-3 font-semibold text-purple-800'>Name</th>
                                    <th className='text-left p-3 font-semibold text-purple-800'>ECO Type</th>
                                    <th className='text-left p-3 font-semibold text-purple-800'>Product</th>
                                    <th className='text-left p-3 font-semibold text-purple-800'>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className='p-6 text-sm text-gray-500 text-center'>
                                            Loading ECO records...
                                        </td>
                                    </tr>
                                ) : ecoRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className='p-6 text-sm text-gray-500 text-center'>
                                            No ECO records yet.
                                        </td>
                                    </tr>
                                ) : (
                                    ecoRecords.map((record) => (
                                        <tr key={record.id} className='border-b border-gray-100'>
                                            <td className='p-3 text-sm text-gray-700'>{record.title}</td>
                                            <td className='p-3 text-sm text-gray-700'>{record.ecoType}</td>
                                            <td className='p-3 text-sm text-gray-700'>{record.product}</td>
                                            <td className='p-3 text-sm'>
                                                {canReviewEco ? (
                                                    <select
                                                        value={record.status}
                                                        onChange={(e) => updateEcoStatus(record.id, e.target.value as EcoStatus)}
                                                        className='border border-purple-300 rounded-md px-2 py-1 text-xs font-semibold text-gray-700 bg-white'
                                                    >
                                                        <option value='New'>New</option>
                                                        <option value='In Progress'>In Progress</option>
                                                        <option value='Reviewed'>Reviewed</option>
                                                        <option value='Rejected'>Rejected</option>
                                                        <option value='Approved'>Approved</option>
                                                    </select>
                                                ) : (
                                                    <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-white border border-gray-300 text-gray-700'>
                                                        {record.status}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {showNewForm && canCreateEco && (
                    <div className='bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-5'>
                        <div className='flex items-center gap-3 mb-5'>
                            <button
                                onClick={() => setStatus('In Progress')}
                                className='px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors'
                            >
                                Start
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className='px-4 py-1.5 rounded-lg border-2 border-purple-300 text-purple-700 text-sm font-semibold bg-white hover:bg-purple-50 transition-colors'
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={() => setShowNewForm(false)}
                                className='ml-auto px-4 py-1.5 rounded-lg border-2 border-gray-300 text-gray-700 text-sm font-semibold bg-white hover:bg-gray-50 transition-colors'
                            >
                                Close
                            </button>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div className='md:col-span-2'>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>Title *</label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                                />
                            </div>

                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>ECO Type *</label>
                                <select
                                    value={ecoType}
                                    onChange={(e) => setEcoType(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white'
                                >
                                    <option value='Products'>Products</option>
                                    <option value='Bills of Materials'>Bills of Materials</option>
                                </select>
                            </div>

                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>Product *</label>
                                <select
                                    value={product}
                                    onChange={(e) => setProduct(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white'
                                >
                                    <option value=''>Select Product</option>
                                    {DUMMY_PRODUCTS.map((product) => (
                                        <option key={product} value={product}>
                                            {product}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className='md:col-span-2'>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>Bill of Materials *</label>
                                <select
                                    value={bom}
                                    onChange={(e) => setBom(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white'
                                >
                                    <option value=''>Select Bill of Materials</option>
                                    {DUMMY_BOMS.map((bom) => (
                                        <option key={bom} value={bom}>
                                            {bom}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>User *</label>
                                <input
                                    value={ecoUser}
                                    onChange={(e) => setEcoUser(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                                />
                            </div>

                            <div>
                                <label className='block text-sm font-semibold text-gray-700 mb-1'>Effective Date</label>
                                <input
                                    type='date'
                                    value={effectiveDate}
                                    onChange={(e) => setEffectiveDate(e.target.value)}
                                    className='w-full border-2 border-purple-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500'
                                />
                            </div>

                            <div className='md:col-span-2'>
                                <label className='inline-flex items-center gap-2 text-sm font-semibold text-gray-700'>
                                    <input
                                        type='checkbox'
                                        checked={versionUpdate}
                                        onChange={(e) => setVersionUpdate(e.target.checked)}
                                        className='accent-purple-600'
                                    />
                                    Version Update
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {!canCreateEco && (
                    <div className='bg-white rounded-xl border border-purple-200 p-4 text-sm text-gray-600'>
                        Your role (`{userRole}`) has view-only access for ECO creation.
                    </div>
                )}
            </div>
        </div>
    )
}

export default DashboardClient
