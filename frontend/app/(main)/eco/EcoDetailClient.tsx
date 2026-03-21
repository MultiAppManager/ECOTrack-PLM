'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────
type EcoDetailClientProps = {
  ecoId: string
  userName: string
  userRole: string
  canCreateEco: boolean
}
type EcoStatus = 'Draft' | 'Reviewed' | 'Rejected' | 'Approved' | 'Applied'

type EcoRecord = {
  id: string
  ecoCode: string
  title: string
  ecoType: string
  product: string
  bom: string
  productId?: string
  bomId?: string
  user: string
  effectiveDate: string
  versionUpdate: boolean
  status: EcoStatus
  changes: any
  stageId?: string
  stageStatus?: string
}

type VersionRow = {
  id: string
  version: number
  status: string
  isLatest: boolean
  createdAt: string
  name?: string
  salePrice?: number
  costPrice?: number
  components?: any[]
  versionDiff?: any
}

type Component = { name: string; qty: number; unit: string; notes?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge: Record<string, string> = {
  Draft: 'bg-white border border-gray-300 text-gray-700',
  Reviewed: 'bg-blue-50 border border-blue-300 text-blue-700',
  Approved: 'bg-green-50 border border-green-300 text-green-700',
  Applied: 'bg-purple-100 border border-purple-300 text-purple-700 font-bold',
  Rejected: 'bg-red-50 border border-red-300 text-red-700',
}
const fmtINR = (v: number | string) =>
  '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const mapEcoFromApi = (item: any): EcoRecord => ({
  id: item.id,
  ecoCode: item.ecoCode,
  title: item.title,
  ecoType: item.ecoType,
  product: item.product,
  bom: item.bom,
  productId: item.productId,
  bomId: item.bomId,
  user: item.requestedBy,
  effectiveDate: item.effectiveDate || '',
  versionUpdate: Boolean(item.versionUpdate),
  status: (item.status || 'Draft') as EcoStatus,
  changes: item.changes,
  stageId: item.stageId,
  stageStatus: item.stageStatus,
})

// ─── Main ──────────────────────────────────────────────────────────────────────
const EcoDetailClient = ({
  ecoId,
  userName,
  userRole,
  canCreateEco,
}: EcoDetailClientProps) => {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  const [eco, setEco] = useState<EcoRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [productVersions, setProductVersions] = useState<VersionRow[]>([])
  const [bomVersions, setBomVersions] = useState<VersionRow[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [allStages, setAllStages] = useState<any[]>([])
  const [advancingStage, setAdvancingStage] = useState(false)

  const canReviewEco = userRole === 'Approver' || userRole === 'Admin'

  const loadEco = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/eco-requests/${ecoId}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch ECO')
      setEco(mapEcoFromApi(data))
    } catch (e: any) {
      toast.error(e.message || 'Failed to load ECO')
      setEco(null)
    } finally {
      setLoading(false)
    }
  }, [API_BASE, ecoId])

  const loadVersionHistory = useCallback(
    async (e: EcoRecord) => {
      setProductVersions([])
      setBomVersions([])
      if (!e.productId && !e.bomId) return
      setLoadingVersions(true)
      try {
        const fetches: Promise<void>[] = []
        if (e.productId) {
          fetches.push(
            fetch(
              `${API_BASE}/api/products/versions-by-id/${e.productId}`,
              { credentials: 'include' }
            )
              .then(async (r) => {
                if (!r.ok) return
                const data = await r.json()
                setProductVersions(Array.isArray(data) ? data : [])
              })
              .catch(() => {})
          )
        }
        if (e.bomId) {
          fetches.push(
            fetch(`${API_BASE}/api/boms/versions-by-id/${e.bomId}`, {
              credentials: 'include',
            })
              .then(async (r) => {
                if (!r.ok) return
                const data = await r.json()
                setBomVersions(Array.isArray(data) ? data : [])
              })
              .catch(() => {})
          )
        }
        await Promise.all(fetches)
      } finally {
        setLoadingVersions(false)
      }
    },
    [API_BASE]
  )

  const loadStages = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/eco-stages`, { credentials: 'include' })
      if (r.ok) setAllStages(await r.json())
    } catch {
      /* silent */
    }
  }, [API_BASE])

  useEffect(() => {
    loadEco()
  }, [loadEco])

  useEffect(() => {
    loadStages()
  }, [loadStages])

  useEffect(() => {
    if (eco) loadVersionHistory(eco)
    else {
      setProductVersions([])
      setBomVersions([])
    }
  }, [eco, loadVersionHistory])

  const updateEcoStatus = async (id: string, nextStatus: EcoStatus) => {
    if (!canReviewEco) {
      toast.error('Only Approver or Admin can update ECO status')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/eco-requests/${id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Update failed')
      toast.success(`ECO marked as ${nextStatus}`)
      if (nextStatus === 'Approved') {
        toast.info('Product/BOM updated — new version created & old archived')
        if (eco) setTimeout(() => loadVersionHistory(eco), 800)
      }
      loadEco()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const advanceStage = async (ecoIdParam: string) => {
    setAdvancingStage(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/eco-requests/${ecoIdParam}/advance-stage`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to advance stage')
      const updatedStatus = data.status as EcoStatus
      if (data.isFinalStage) {
        toast.success('🎉 ECO Applied — new version created!')
        if (eco) setTimeout(() => loadVersionHistory(eco), 800)
      } else {
        toast.success(`✅ Moved to stage: ${data.nextStage?.name || 'next'}`)
      }
      loadEco()
    } catch (e: any) {
      toast.error((e as Error).message)
    } finally {
      setAdvancingStage(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 bg-white min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading ECO…</p>
      </div>
    )
  }

  if (!eco) {
    return (
      <div className="flex-1 bg-white min-h-screen p-8">
        <Link
          href="/eco"
          className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold mb-6"
        >
          ← Back to ECO list
        </Link>
        <p className="text-red-600">ECO not found.</p>
      </div>
    )
  }

  const selectedEco = eco

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="px-8 pt-7 pb-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-4">
          <Link
            href="/eco"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 font-semibold text-sm"
          >
            ← Back to ECO list
          </Link>
          <h1 className="text-2xl font-bold text-[#7c3aed]">
            Engineering Change Orders
          </h1>
        </div>
        <div className="w-8 h-8 rounded-full border border-purple-300 flex items-center justify-center text-purple-600 text-sm font-bold">
          {userName?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>

      <div className="px-8 py-5">
        <div className="rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden bg-white">
          {/* Header */}
          <div className="px-6 py-4 border-b border-purple-100">
            {allStages.length > 0 &&
              (() => {
                const sortedStages = [...allStages].sort(
                  (a, b) => a.sequence - b.sequence
                )
                const currentStageIdx = selectedEco.stageId
                  ? sortedStages.findIndex((s) => s.id === selectedEco.stageId)
                  : -1
                const currentStage =
                  currentStageIdx >= 0 ? sortedStages[currentStageIdx] : null
                const nextStage = sortedStages[currentStageIdx + 1]
                const currentApprovals: any[] =
                  currentStage?.approvals || []
                const hasRequiredApproval = currentApprovals.some(
                  (a: any) => a.category === 'Required'
                )
                const isFinished =
                  selectedEco.status === 'Applied' || currentStage?.isFinal

                return (
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {sortedStages.map((s, i) => {
                        const done = i <= currentStageIdx
                        const active = i === currentStageIdx
                        return (
                          <React.Fragment key={s.id}>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition ${
                                active
                                  ? 'bg-purple-600 text-white border-purple-700 shadow'
                                  : done
                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                    : 'bg-gray-100 text-gray-400 border-gray-200'
                              }`}
                            >
                              {s.isFinal && done ? '✅ ' : ''}
                              {s.name}
                            </span>
                            {i < sortedStages.length - 1 && (
                              <span
                                className={`text-xs font-bold ${i < currentStageIdx ? 'text-purple-400' : 'text-gray-300'}`}
                              >
                                ›
                              </span>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </div>
                    {!isFinished &&
                      nextStage &&
                      canReviewEco && (
                        <button
                          onClick={() => advanceStage(selectedEco.id)}
                          disabled={advancingStage}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition ${
                            hasRequiredApproval
                              ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600'
                              : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600'
                          } disabled:opacity-50`}
                        >
                          {advancingStage
                            ? '…'
                            : hasRequiredApproval
                              ? `🔐 Approve → ${nextStage.name}`
                              : `✅ Validate → ${nextStage.name}`}
                        </button>
                      )}
                  </div>
                )
              })()}

            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#7c3aed]">
                  {selectedEco.ecoCode} — {selectedEco.title}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedEco.ecoType} · {selectedEco.user} ·{' '}
                  {selectedEco.effectiveDate || 'No effective date'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge[selectedEco.status] || ''}`}
                >
                  {selectedEco.status === 'Approved'
                    ? 'Applied'
                    : selectedEco.status}
                </span>
                {canReviewEco && selectedEco.status === 'Draft' && (
                  <button
                    onClick={() =>
                      updateEcoStatus(selectedEco.id, 'Reviewed')
                    }
                    className="px-3 py-1 rounded border border-purple-300 text-purple-700 text-xs font-semibold hover:bg-purple-50"
                  >
                    Review
                  </button>
                )}
                {canReviewEco && selectedEco.status === 'Reviewed' && (
                  <>
                    <button
                      onClick={() =>
                        updateEcoStatus(selectedEco.id, 'Approved')
                      }
                      className="px-3 py-1 rounded border border-green-300 text-green-700 text-xs font-semibold hover:bg-green-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        updateEcoStatus(selectedEco.id, 'Rejected')
                      }
                      className="px-3 py-1 rounded border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Detail fields */}
          <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-purple-50">
            {[
              { label: 'Title', value: selectedEco.title, span: 2 },
              { label: 'ECO Type', value: selectedEco.ecoType },
              { label: 'Product', value: selectedEco.product },
              {
                label: 'Bill of Materials',
                value: selectedEco.bom,
                span: 2,
              },
              { label: 'Requested By', value: selectedEco.user },
              {
                label: 'Effective Date',
                value: selectedEco.effectiveDate || '—',
              },
            ].map((f) => (
              <div
                key={f.label}
                className={f.span === 2 ? 'col-span-2' : ''}
              >
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  {f.label}
                </label>
                <div className="border-2 border-purple-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          {/* Proposed Changes + Approver Diff */}
          {selectedEco.changes &&
            Object.keys(selectedEco.changes).length > 0 && (
              <div className="px-6 py-5 border-b border-purple-50">
                <h3 className="font-bold text-sm text-[#7c3aed] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  {selectedEco.status === 'Approved'
                    ? 'Applied Changes'
                    : 'Proposed Changes — Approver Review'}
                </h3>

                {selectedEco.ecoType === 'Products' &&
                  (() => {
                    const ch = selectedEco.changes as Record<string, any>
                    const latestVer = productVersions.find((v) => v.isLatest)
                    const vdiff = latestVer?.versionDiff as
                      | Record<string, { from: any; to: any }>
                      | undefined
                    const archVer =
                      productVersions.find((v) => !v.isLatest) ??
                      productVersions[productVersions.length - 1]

                    const fieldMeta: Record<
                      string,
                      { label: string; fmt: (v: any) => string }
                    > = {
                      name: { label: 'Product Name', fmt: (v) => String(v) },
                      salePrice: { label: 'Sale Price', fmt: (v) => fmtINR(v) },
                      costPrice: { label: 'Cost Price', fmt: (v) => fmtINR(v) },
                      notes: { label: 'Notes', fmt: (v) => String(v) },
                    }

                    type DiffRow = {
                      field: string
                      label: string
                      from: string
                      to: string
                    }
                    let rows: DiffRow[] = []

                    if (vdiff && Object.keys(vdiff).length > 0) {
                      rows = Object.entries(vdiff).map(([field, val]) => ({
                        field,
                        label: fieldMeta[field]?.label || field,
                        from:
                          fieldMeta[field]?.fmt(val.from) ?? String(val.from),
                        to: fieldMeta[field]?.fmt(val.to) ?? String(val.to),
                      }))
                    } else {
                      const getArchVal = (f: string): any => {
                        if (f === 'salePrice') return archVer?.salePrice
                        if (f === 'costPrice') return archVer?.costPrice
                        if (f === 'name') return archVer?.name
                        return undefined
                      }
                      rows = Object.entries(ch)
                        .filter(([k]) => k !== 'notes' && fieldMeta[k])
                        .map(([field, proposed]) => ({
                          field,
                          label: fieldMeta[field]?.label || field,
                          from:
                            fieldMeta[field]?.fmt(getArchVal(field)) ??
                            String(getArchVal(field) ?? '—'),
                          to:
                            fieldMeta[field]?.fmt(proposed) ?? String(proposed),
                        }))
                    }

                    return (
                      <div className="rounded-xl border-2 border-amber-200 overflow-hidden">
                        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
                          <p className="text-xs font-bold text-amber-800">
                            📦 Product Changes
                          </p>
                          <span className="text-[10px] text-amber-600 font-semibold">
                            {rows.length} field
                            {rows.length !== 1 ? 's' : ''} changed
                          </span>
                        </div>
                        <table className="w-full text-sm">
                          <thead className="border-b border-amber-100 bg-amber-50/30">
                            <tr>
                              <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-600 w-32">
                                Field
                              </th>
                              <th className="text-left px-4 py-2.5 text-xs font-bold text-red-600">
                                Before
                              </th>
                              <th className="text-center px-3 py-2.5 text-xs text-gray-400 w-8">
                                →
                              </th>
                              <th className="text-left px-4 py-2.5 text-xs font-bold text-green-700">
                                After
                              </th>
                              <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-400 w-28">
                                Δ Change
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-4 py-4 text-xs text-gray-400 italic text-center"
                                >
                                  No changes recorded yet — data will appear
                                  after approval.
                                </td>
                              </tr>
                            ) : (
                              rows.map((row) => {
                                const isPrice =
                                  row.field === 'salePrice' ||
                                  row.field === 'costPrice'
                                const delta = isPrice
                                  ? Number(
                                      String(row.to).replace(/[^0-9.-]/g, '')
                                    ) -
                                    Number(
                                      String(row.from).replace(/[^0-9.-]/g, '')
                                    )
                                  : null
                                return (
                                  <tr
                                    key={row.field}
                                    className="border-t border-amber-50 hover:bg-amber-50/20"
                                  >
                                    <td className="px-4 py-3 font-semibold text-gray-700 text-xs">
                                      {row.label}
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-600 font-mono">
                                        {row.from}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 text-center text-gray-400 text-xs font-bold">
                                      →
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 font-mono font-semibold">
                                        {row.to}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-right">
                                      {delta !== null ? (
                                        <span
                                          className={`font-semibold ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-600' : 'text-gray-400'}`}
                                        >
                                          {delta > 0 ? '+' : ''}
                                          {fmtINR(delta)}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                            {ch.notes && (
                              <tr className="border-t border-amber-100 bg-amber-50/30">
                                <td className="px-4 py-2.5 text-xs font-bold text-gray-600">
                                  Reason
                                </td>
                                <td
                                  colSpan={4}
                                  className="px-4 py-2.5 text-xs text-gray-600 italic"
                                >
                                  {ch.notes}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}

                {selectedEco.ecoType === 'Bills of Materials' &&
                  (() => {
                    const ch = selectedEco.changes as Record<string, any>
                    const latestBom = bomVersions.find((v) => v.isLatest)
                    const vdiff = latestBom?.versionDiff as
                      | Record<string, { from: any; to: any }>
                      | undefined
                    const oldComps: Component[] = (vdiff?.components?.from ??
                      bomVersions.find((v) => !v.isLatest)?.components ??
                      []) as Component[]
                    const newComps: Component[] = (vdiff?.components?.to ??
                      ch.components ??
                      []) as Component[]

                    type CompRow = {
                      name: string
                      oldQty?: number
                      newQty?: number
                      oldUnit?: string
                      newUnit?: string
                      state: 'added' | 'removed' | 'changed' | 'unchanged'
                    }
                    const compRows: CompRow[] = []
                    const oldMap = new Map<string, Component>(
                      oldComps.map((c) => [c.name.toLowerCase(), c])
                    )
                    const newMap = new Map<string, Component>(
                      newComps.map((c) => [c.name.toLowerCase(), c])
                    )
                    const allKeys = new Set([
                      ...oldMap.keys(),
                      ...newMap.keys(),
                    ])
                    allKeys.forEach((key) => {
                      const o = oldMap.get(key)
                      const n = newMap.get(key)
                      if (!o && n)
                        compRows.push({
                          name: n.name,
                          newQty: n.qty,
                          newUnit: n.unit,
                          state: 'added',
                        })
                      else if (o && !n)
                        compRows.push({
                          name: o.name,
                          oldQty: o.qty,
                          oldUnit: o.unit,
                          state: 'removed',
                        })
                      else if (o && n)
                        compRows.push({
                          name: o.name,
                          oldQty: o.qty,
                          newQty: n.qty,
                          oldUnit: o.unit,
                          newUnit: n.unit,
                          state:
                            o.qty !== n.qty || o.unit !== n.unit
                              ? 'changed'
                              : 'unchanged',
                        })
                    })

                    const stateMeta: Record<
                      CompRow['state'],
                      {
                        label: string
                        bg: string
                        text: string
                        dot: string
                      }
                    > = {
                      added: {
                        label: 'Added',
                        bg: 'bg-green-50  border-green-200',
                        text: 'text-green-700',
                        dot: 'bg-green-400',
                      },
                      removed: {
                        label: 'Removed',
                        bg: 'bg-red-50    border-red-200',
                        text: 'text-red-600',
                        dot: 'bg-red-400',
                      },
                      changed: {
                        label: 'Changed',
                        bg: 'bg-amber-50  border-amber-200',
                        text: 'text-amber-700',
                        dot: 'bg-amber-400',
                      },
                      unchanged: {
                        label: 'Unchanged',
                        bg: 'bg-gray-50   border-gray-200',
                        text: 'text-gray-500',
                        dot: 'bg-gray-300',
                      },
                    }

                    const changed = compRows.filter((r) => r.state !== 'unchanged')
                    const unchanged = compRows.filter(
                      (r) => r.state === 'unchanged'
                    )

                    return (
                      <div className="rounded-xl border-2 border-indigo-200 overflow-hidden mt-4">
                        <div className="bg-indigo-50 px-4 py-2.5 border-b border-indigo-200 flex items-center justify-between">
                          <p className="text-xs font-bold text-indigo-800">
                            🔧 BOM Component Changes
                          </p>
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-green-600 font-semibold">
                              +{compRows.filter((r) => r.state === 'added').length}{' '}
                              added
                            </span>
                            <span className="text-red-500 font-semibold">
                              −
                              {
                                compRows.filter((r) => r.state === 'removed')
                                  .length
                              }{' '}
                              removed
                            </span>
                            <span className="text-amber-600 font-semibold">
                              ~
                              {
                                compRows.filter((r) => r.state === 'changed')
                                  .length
                              }{' '}
                              changed
                            </span>
                            <span className="text-gray-400">
                              {
                                compRows.filter((r) => r.state === 'unchanged')
                                  .length
                              }{' '}
                              unchanged
                            </span>
                          </div>
                        </div>
                        <table className="w-full text-xs">
                          <thead className="bg-indigo-50/50 border-b border-indigo-100">
                            <tr>
                              <th className="text-left px-4 py-2.5 font-bold text-indigo-800">
                                Component
                              </th>
                              <th className="text-center px-4 py-2.5 font-bold text-red-600">
                                Before (Qty · Unit)
                              </th>
                              <th className="text-center px-2 py-2.5 font-bold text-gray-400 w-8">
                                →
                              </th>
                              <th className="text-center px-4 py-2.5 font-bold text-green-700">
                                After (Qty · Unit)
                              </th>
                              <th className="text-center px-4 py-2.5 font-bold text-indigo-700 w-24">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...changed, ...unchanged].map((r, i) => {
                              const m = stateMeta[r.state]
                              return (
                                <tr
                                  key={i}
                                  className={`border-t border-indigo-50 ${r.state === 'unchanged' ? 'opacity-50' : ''}`}
                                >
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`}
                                      />
                                      <span className="font-medium text-gray-800">
                                        {r.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    {r.oldQty != null ? (
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded border font-mono ${r.state === 'removed' ? 'bg-red-50 border-red-200 text-red-600 line-through' : r.state === 'changed' ? 'bg-red-50 border-red-200 text-red-500' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                      >
                                        {r.oldQty} {r.oldUnit}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2.5 text-center text-gray-400 font-bold">
                                    →
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    {r.newQty != null ? (
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded border font-mono font-semibold ${r.state === 'added' ? 'bg-green-50 border-green-200 text-green-700' : r.state === 'changed' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                      >
                                        {r.newQty} {r.newUnit}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${m.bg} ${m.text}`}
                                    >
                                      {m.label}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                            {compRows.length === 0 && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-4 py-4 text-gray-400 italic text-center"
                                >
                                  No component data available.
                                </td>
                              </tr>
                            )}
                            {(ch.notes || vdiff?.notes) && (
                              <tr className="border-t border-indigo-100 bg-indigo-50/20">
                                <td className="px-4 py-2.5 font-bold text-gray-600">
                                  Reason
                                </td>
                                <td
                                  colSpan={4}
                                  className="px-4 py-2.5 text-gray-600 italic"
                                >
                                  {ch.notes || vdiff?.notes?.to}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
              </div>
            )}

          {/* Version History */}
          <div className="px-6 py-5">
            <h3 className="font-bold text-sm text-[#7c3aed] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              Version History
            </h3>
            {loadingVersions && (
              <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
            )}
            {!loadingVersions &&
              productVersions.length === 0 &&
              bomVersions.length === 0 && (
                <p className="text-sm text-gray-400 italic">
                  {selectedEco.productId || selectedEco.bomId
                    ? 'No version history yet.'
                    : 'Version history not available for legacy ECOs.'}
                </p>
              )}
            <div className="space-y-6">
              {productVersions.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />{' '}
                    Product Versions
                  </p>
                  <div className="rounded-xl border border-purple-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-purple-50 border-b border-purple-100">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-bold text-purple-800">
                            Version
                          </th>
                          <th className="text-right px-3 py-2.5 font-bold text-purple-800">
                            Sale Price
                          </th>
                          <th className="text-right px-3 py-2.5 font-bold text-purple-800">
                            Cost Price
                          </th>
                          <th className="text-right px-3 py-2.5 font-bold text-red-500">
                            Δ Sale Price
                          </th>
                          <th className="text-right px-3 py-2.5 font-bold text-orange-500">
                            Δ Cost Price
                          </th>
                          <th className="text-center px-3 py-2.5 font-bold text-amber-600">
                            Δ Fields
                          </th>
                          <th className="text-left px-3 py-2.5 font-bold text-purple-800">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {productVersions.map((v, i) => {
                          const prev = productVersions[i + 1]
                          const saleDiff =
                            prev != null
                              ? Number(v.salePrice || 0) - Number(prev.salePrice || 0)
                              : null
                          const costDiff =
                            prev != null
                              ? Number(v.costPrice || 0) - Number(prev.costPrice || 0)
                              : null
                          const isFirst = !prev
                          const fmtDelta = (val: number | null) => {
                            if (val === null)
                              return (
                                <span className="text-gray-300 text-[10px]">—</span>
                              )
                            if (val === 0)
                              return (
                                <span className="text-gray-400 text-[10px]">
                                  No change
                                </span>
                              )
                            return (
                              <div className="flex flex-col">
                                <span
                                  className={`font-mono font-bold ${val > 0 ? 'text-red-500' : 'text-green-600'}`}
                                >
                                  {val > 0 ? '+' : ''}
                                  {fmtINR(val)}
                                </span>
                                <span className="text-[9px] text-gray-400">
                                  {val > 0 ? '▲ increased' : '▼ decreased'}
                                </span>
                              </div>
                            )
                          }
                          return (
                            <tr
                              key={v.id}
                              className={`border-t border-purple-50 hover:bg-purple-50/20 ${i === 0 ? 'bg-emerald-50/30' : ''}`}
                            >
                              <td className="px-3 py-2.5 font-bold text-purple-700">
                                <span>v{v.version}</span>
                                {v.isLatest && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                    LATEST
                                  </span>
                                )}
                                {isFirst && (
                                  <span className="ml-1.5 text-gray-400 font-normal text-[9px]">
                                    (initial)
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right text-gray-700 font-mono">
                                {fmtINR(Number(v.salePrice) || 0)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-gray-700 font-mono">
                                {fmtINR(Number(v.costPrice) || 0)}
                              </td>
                              <td className="px-3 py-3">{fmtDelta(saleDiff)}</td>
                              <td className="px-3 py-3">{fmtDelta(costDiff)}</td>
                              <td className="px-3 py-2.5 text-center">
                                {prev != null ? (
                                  (() => {
                                    let count = 0
                                    if (
                                      Number(v.salePrice || 0) !==
                                      Number(prev.salePrice || 0)
                                    )
                                      count++
                                    if (
                                      Number(v.costPrice || 0) !==
                                      Number(prev.costPrice || 0)
                                    )
                                      count++
                                    if (v.name !== prev.name) count++
                                    return count > 0 ? (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                        {count}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-[10px]">
                                        0
                                      </span>
                                    )
                                  })()
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${v.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                                >
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

              {bomVersions.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />{' '}
                    BOM Versions
                  </p>
                  <div className="rounded-xl border border-indigo-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-indigo-50 border-b border-indigo-100">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-bold text-indigo-800">
                            Version
                          </th>
                          <th className="text-center px-3 py-2.5 font-bold text-indigo-800">
                            Items
                          </th>
                          <th className="text-center px-3 py-2.5 font-bold text-red-500">
                            Δ Items
                          </th>
                          <th className="text-left px-3 py-2.5 font-bold text-amber-600">
                            Qty Changes
                          </th>
                          <th className="text-left px-3 py-2.5 font-bold text-indigo-800">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomVersions.map((v, i) => {
                          const prev = bomVersions[i + 1]
                          const isFirst = !prev
                          const currComps: Component[] = Array.isArray(
                            v.components
                          )
                            ? (v.components as Component[])
                            : []
                          const prevComps: Component[] =
                            prev && Array.isArray(prev.components)
                              ? (prev.components as Component[])
                              : []
                          const deltaItems =
                            prev != null
                              ? currComps.length - prevComps.length
                              : null
                          type QtyRow = {
                            name: string
                            oldQty: number
                            newQty: number
                            delta: number
                          }
                          const qtyRows: QtyRow[] = []
                          if (prev != null) {
                            const prevMap = new Map<string, Component>(
                              prevComps.map((c) => [
                                c.name.toLowerCase(),
                                c,
                              ])
                            )
                            const currMap = new Map<string, Component>(
                              currComps.map((c) => [
                                c.name.toLowerCase(),
                                c,
                              ])
                            )
                            currMap.forEach((nc, key) => {
                              const oc = prevMap.get(key)
                              if (
                                oc &&
                                Number(oc.qty) !== Number(nc.qty)
                              )
                                qtyRows.push({
                                  name: nc.name,
                                  oldQty: Number(oc.qty),
                                  newQty: Number(nc.qty),
                                  delta:
                                    Number(nc.qty) - Number(oc.qty),
                                })
                            })
                          }
                          return (
                            <tr
                              key={v.id}
                              className={`border-t border-indigo-50 hover:bg-indigo-50/20 ${i === 0 ? 'bg-emerald-50/30' : ''} align-top`}
                            >
                              <td className="px-3 py-2.5 font-bold text-indigo-700">
                                <span>v{v.version}</span>
                                {v.isLatest && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                    LATEST
                                  </span>
                                )}
                                {isFirst && (
                                  <span className="ml-1.5 text-gray-400 font-normal text-[9px]">
                                    (initial)
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center text-gray-700 font-semibold">
                                {currComps.length}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold">
                                {deltaItems !== null ? (
                                  <div className="flex flex-col items-center">
                                    <span
                                      className={
                                        deltaItems > 0
                                          ? 'text-green-600'
                                          : deltaItems < 0
                                            ? 'text-red-500'
                                            : 'text-gray-400'
                                      }
                                    >
                                      {deltaItems > 0 ? '+' : ''}
                                      {deltaItems}
                                    </span>
                                    {deltaItems !== 0 && (
                                      <span className="text-[9px] text-gray-400">
                                        {deltaItems > 0 ? '▲ added' : '▼ removed'}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-300 font-normal">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {isFirst ? (
                                  <span className="text-gray-300 text-[10px]">
                                    —
                                  </span>
                                ) : qtyRows.length === 0 ? (
                                  <span className="text-gray-400 italic text-[10px]">
                                    {deltaItems === 0
                                      ? 'No quantity changes'
                                      : 'Components added/removed only'}
                                  </span>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    {qtyRows.map((r) => (
                                      <div
                                        key={r.name}
                                        className="flex items-center gap-1 flex-wrap"
                                      >
                                        <span
                                          className="font-medium text-gray-700 truncate max-w-[110px]"
                                          title={r.name}
                                        >
                                          {r.name}:
                                        </span>
                                        <span className="font-mono text-red-400 bg-red-50 px-1 rounded">
                                          {r.oldQty}
                                        </span>
                                        <span className="text-gray-400">→</span>
                                        <span className="font-mono text-green-600 font-semibold bg-green-50 px-1 rounded">
                                          {r.newQty}
                                        </span>
                                        <span
                                          className={`font-bold text-[10px] px-1 rounded ${r.delta > 0 ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}
                                        >
                                          ({r.delta > 0 ? '+' : ''}
                                          {r.delta})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${v.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                                >
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
      </div>
    </div>
  )
}

export default EcoDetailClient
