'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

type Approval = { id: string; userId: string; userName: string; category: 'Required' | 'Optional' }
type Stage    = { id: string; name: string; sequence: number; isFinal: boolean; approvals: Approval[]; createdAt: string }
type User     = { id: string; name: string; email: string; role: string }

export default function EcoStagesPage() {
    const [stages, setStages]           = useState<Stage[]>([])
    const [users, setUsers]             = useState<User[]>([])
    const [loading, setLoading]         = useState(true)
    const [selectedStage, setSelectedStage] = useState<Stage | null>(null)

    // Stage form
    const [stageName, setStageName]     = useState('')
    const [stageSeq, setStageSeq]       = useState(0)
    const [stageFinal, setStageFinal]   = useState(false)
    const [showStageForm, setShowStageForm] = useState(false)
    const [editingStageId, setEditingStageId] = useState<string | null>(null)
    const [savingStage, setSavingStage] = useState(false)

    // Approval form
    const [appUserId, setAppUserId]     = useState('')
    const [appCategory, setAppCategory] = useState<'Required' | 'Optional'>('Required')
    const [addingApproval, setAddingApproval] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [sRes, uRes] = await Promise.all([
                fetch(`${API_BASE}/api/eco-stages`,  { credentials: 'include' }),
                fetch(`${API_BASE}/api/users-list`,   { credentials: 'include' }),
            ])
            if (sRes.ok)  setStages(await sRes.json())
            if (uRes.ok)  setUsers(await uRes.json())
        } catch { toast.error('Failed to load data') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    // Sync selectedStage from latest stages list
    useEffect(() => {
        if (selectedStage) {
            const fresh = stages.find(s => s.id === selectedStage.id)
            if (fresh) setSelectedStage(fresh)
        }
    }, [stages]) // eslint-disable-line

    const openNew = () => {
        setEditingStageId(null)
        setStageName('')
        setStageSeq(stages.length)
        setStageFinal(false)
        setShowStageForm(true)
    }

    const openEdit = (s: Stage) => {
        setEditingStageId(s.id)
        setStageName(s.name)
        setStageSeq(s.sequence)
        setStageFinal(s.isFinal)
        setShowStageForm(true)
    }

    const saveStage = async () => {
        if (!stageName.trim()) return toast.error('Stage name is required')
        setSavingStage(true)
        try {
            const url = editingStageId ? `${API_BASE}/api/eco-stages/${editingStageId}` : `${API_BASE}/api/eco-stages`
            const method = editingStageId ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method, credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: stageName.trim(), sequence: stageSeq, isFinal: stageFinal }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || res.statusText)
            toast.success(editingStageId ? 'Stage updated' : 'Stage created')
            setShowStageForm(false)
            await load()
        } catch (e: any) { toast.error(e.message) }
        finally { setSavingStage(false) }
    }

    const deleteStage = async (id: string) => {
        if (!confirm('Delete this stage? All approval rules will also be removed.')) return
        try {
            const res = await fetch(`${API_BASE}/api/eco-stages/${id}`, { method: 'DELETE', credentials: 'include' })
            if (!res.ok) throw new Error((await res.json())?.error)
            toast.success('Stage deleted')
            if (selectedStage?.id === id) setSelectedStage(null)
            await load()
        } catch (e: any) { toast.error(e.message) }
    }

    const addApproval = async () => {
        if (!selectedStage || !appUserId) return toast.error('Select a user')
        const user = users.find(u => u.id === appUserId)
        setAddingApproval(true)
        try {
            const res = await fetch(`${API_BASE}/api/eco-stages/${selectedStage.id}/approvals`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: appUserId, userName: user?.name || '', category: appCategory }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error)
            toast.success('Approver added')
            setAppUserId('')
            await load()
        } catch (e: any) { toast.error(e.message) }
        finally { setAddingApproval(false) }
    }

    const removeApproval = async (approvalId: string) => {
        if (!selectedStage) return
        try {
            const res = await fetch(`${API_BASE}/api/eco-stages/${selectedStage.id}/approvals/${approvalId}`, { method: 'DELETE', credentials: 'include' })
            if (!res.ok) throw new Error((await res.json())?.error)
            toast.success('Approver removed')
            await load()
        } catch (e: any) { toast.error(e.message) }
    }

    return (
        <div className='min-h-screen p-6 bg-gradient-to-br from-slate-50 to-purple-50/30'>
            <div className='max-w-6xl mx-auto space-y-6'>

                {/* Header */}
                <div className='flex items-center justify-between'>
                    <div>
                        <h1 className='text-2xl font-bold text-purple-800'>ECO Stages</h1>
                        <p className='text-sm text-gray-500 mt-0.5'>Configure stages and approval rules for Engineering Change Orders</p>
                    </div>
                    <button
                        onClick={openNew}
                        className='flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow transition'
                    >
                        <span className='text-lg leading-none'>+</span> New Stage
                    </button>
                </div>

                {/* Stage creation / edit modal */}
                {showStageForm && (
                    <div className='fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
                        <div className='bg-white rounded-2xl shadow-2xl border border-purple-100 w-full max-w-md p-6 space-y-4'>
                            <h2 className='text-lg font-bold text-purple-800'>{editingStageId ? 'Edit Stage' : 'New Stage'}</h2>

                            <div className='space-y-3'>
                                <div>
                                    <label className='block text-xs font-semibold text-gray-600 mb-1'>Stage Name <span className='text-red-500'>*</span></label>
                                    <input
                                        value={stageName} onChange={e => setStageName(e.target.value)}
                                        placeholder='e.g. New, Approval, Done'
                                        className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400'
                                    />
                                </div>
                                <div>
                                    <label className='block text-xs font-semibold text-gray-600 mb-1'>Sequence (order)</label>
                                    <input
                                        type='number' min={0} value={stageSeq} onChange={e => setStageSeq(Number(e.target.value))}
                                        className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400'
                                    />
                                </div>
                                <label className='flex items-center gap-3 cursor-pointer select-none'>
                                    <input
                                        type='checkbox' checked={stageFinal} onChange={e => setStageFinal(e.target.checked)}
                                        className='w-4 h-4 accent-purple-600'
                                    />
                                    <span className='text-sm font-medium text-gray-700'>Final stage — marks ECO as <span className='text-green-600 font-bold'>Applied</span> when reached</span>
                                </label>
                            </div>

                            <div className='flex gap-2 pt-2'>
                                <button
                                    onClick={saveStage} disabled={savingStage}
                                    className='flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold transition'
                                >
                                    {savingStage ? 'Saving…' : editingStageId ? 'Update Stage' : 'Create Stage'}
                                </button>
                                <button
                                    onClick={() => setShowStageForm(false)}
                                    className='flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>

                    {/* ── Left: Stages list ── */}
                    <div className='bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden'>
                        <div className='bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-purple-100'>
                            <h2 className='text-sm font-bold text-purple-800 uppercase tracking-wider'>ECO&apos;s Stages</h2>
                        </div>

                        {loading ? (
                            <div className='p-8 text-center text-gray-400 text-sm'>Loading stages…</div>
                        ) : stages.length === 0 ? (
                            <div className='p-8 text-center'>
                                <p className='text-gray-400 text-sm mb-3'>No stages configured yet.</p>
                                <button onClick={openNew} className='text-purple-600 text-sm font-semibold hover:underline'>Create your first stage →</button>
                            </div>
                        ) : (
                            <div className='divide-y divide-gray-50'>
                                {/* Flow visualization */}
                                <div className='px-4 py-3 bg-purple-50/50 flex items-center gap-2 flex-wrap'>
                                    {[...stages].sort((a,b) => a.sequence - b.sequence).map((s, i, arr) => (
                                        <React.Fragment key={s.id}>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.isFinal ? 'bg-green-100 text-green-700 border-green-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                                                {s.name}
                                            </span>
                                            {i < arr.length - 1 && <span className='text-gray-400 text-xs'>→</span>}
                                        </React.Fragment>
                                    ))}
                                </div>
                                {stages.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => setSelectedStage(selectedStage?.id === s.id ? null : s)}
                                        className={`px-4 py-3 cursor-pointer transition flex items-center justify-between group ${selectedStage?.id === s.id ? 'bg-purple-50 border-l-4 border-l-purple-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                                    >
                                        <div className='flex items-center gap-3'>
                                            <span className='w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center'>{s.sequence}</span>
                                            <div>
                                                <div className='flex items-center gap-2'>
                                                    <span className='font-semibold text-gray-800 text-sm'>{s.name}</span>
                                                    {s.isFinal && <span className='px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 border border-green-200'>FINAL</span>}
                                                </div>
                                                <div className='text-xs text-gray-400 mt-0.5'>
                                                    {s.approvals?.length > 0
                                                        ? `${s.approvals.length} approver${s.approvals.length !== 1 ? 's' : ''} (${s.approvals.filter(a => a.category === 'Required').length} required)`
                                                        : 'No approvers — Validate button shown'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition'>
                                            <button
                                                onClick={e => { e.stopPropagation(); openEdit(s) }}
                                                className='p-1.5 rounded hover:bg-purple-100 text-purple-600 text-xs font-bold transition'
                                                title='Edit'
                                            >✏️</button>
                                            <button
                                                onClick={e => { e.stopPropagation(); deleteStage(s.id) }}
                                                className='p-1.5 rounded hover:bg-red-100 text-red-500 text-xs font-bold transition'
                                                title='Delete'
                                            >🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Right: Stage detail + approvals ── */}
                    <div className='bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden'>
                        {!selectedStage ? (
                            <div className='h-full flex items-center justify-center p-12 text-center'>
                                <div>
                                    <div className='text-4xl mb-3'>👈</div>
                                    <p className='text-gray-400 text-sm'>Select a stage to configure its approval rules</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className='bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-purple-100 flex items-center justify-between'>
                                    <div>
                                        <h2 className='text-sm font-bold text-indigo-800 uppercase tracking-wider'>Approvals</h2>
                                        <p className='text-xs text-indigo-500 mt-0.5'>Stage: <span className='font-semibold'>{selectedStage.name}</span></p>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        {selectedStage.approvals?.some(a => a.category === 'Required') ? (
                                            <span className='px-2 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200'>
                                                🔐 Approve button shown
                                            </span>
                                        ) : (
                                            <span className='px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200'>
                                                ✅ Validate button shown
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className='p-4 space-y-4'>
                                    {/* Approvals table */}
                                    {selectedStage.approvals?.length > 0 ? (
                                        <div className='rounded-xl border border-gray-100 overflow-hidden'>
                                            <table className='w-full text-sm'>
                                                <thead className='bg-gray-50 border-b border-gray-100'>
                                                    <tr>
                                                        <th className='text-left px-3 py-2.5 text-xs font-bold text-gray-600'>User</th>
                                                        <th className='text-left px-3 py-2.5 text-xs font-bold text-gray-600'>Approval Category</th>
                                                        <th className='w-10'></th>
                                                    </tr>
                                                </thead>
                                                <tbody className='divide-y divide-gray-50'>
                                                    {selectedStage.approvals.map(a => (
                                                        <tr key={a.id} className='hover:bg-gray-50 transition'>
                                                            <td className='px-3 py-2.5'>
                                                                <div className='font-medium text-gray-800'>{a.userName}</div>
                                                                <div className='text-xs text-gray-400'>{users.find(u => u.id === a.userId)?.email || a.userId}</div>
                                                            </td>
                                                            <td className='px-3 py-2.5'>
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${
                                                                    a.category === 'Required'
                                                                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                                                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                                                }`}>
                                                                    {a.category === 'Required' ? '🔐' : '🔓'} {a.category}
                                                                </span>
                                                            </td>
                                                            <td className='px-2'>
                                                                <button
                                                                    onClick={() => removeApproval(a.id)}
                                                                    className='p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition text-xs'
                                                                    title='Remove'
                                                                >✕</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className='rounded-xl border-2 border-dashed border-gray-200 p-6 text-center'>
                                            <p className='text-gray-400 text-sm'>No approvers configured for this stage.</p>
                                            <p className='text-xs text-gray-400 mt-1'>A <strong className='text-blue-600'>Validate</strong> button will be shown instead of Approve.</p>
                                        </div>
                                    )}

                                    {/* Add approver form */}
                                    <div className='border border-purple-100 rounded-xl p-4 bg-purple-50/30 space-y-3'>
                                        <p className='text-xs font-bold text-purple-700 uppercase tracking-wider'>Add Approver</p>
                                        <div className='grid grid-cols-1 gap-2'>
                                            <select
                                                value={appUserId} onChange={e => setAppUserId(e.target.value)}
                                                className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400'
                                            >
                                                <option value=''>— Select User —</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                                ))}
                                            </select>
                                            <div className='flex gap-2'>
                                                <select
                                                    value={appCategory} onChange={e => setAppCategory(e.target.value as 'Required' | 'Optional')}
                                                    className='flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400'
                                                >
                                                    <option value='Required'>🔐 Required</option>
                                                    <option value='Optional'>🔓 Optional</option>
                                                </select>
                                                <button
                                                    onClick={addApproval} disabled={addingApproval || !appUserId}
                                                    className='px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition whitespace-nowrap'
                                                >
                                                    {addingApproval ? '…' : '+ Add'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Logic explanation */}
                                        <div className='rounded-lg bg-white border border-gray-100 p-3 space-y-1.5 text-xs text-gray-500'>
                                            <p><span className='font-semibold text-orange-600'>🔐 Required</span> — Approval must happen before ECO can advance to next stage</p>
                                            <p><span className='font-semibold text-blue-600'>🔓 Optional</span> — Approval is optional; ECO can advance regardless</p>
                                            <p className='pt-1 border-t border-gray-100'><span className='font-semibold text-gray-600'>No approvers</span> → Shows <strong>Validate</strong> button (advance without approval)</p>
                                            <p><span className='font-semibold text-gray-600'>Has required approvers</span> → Shows <strong>Approve</strong> button</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
