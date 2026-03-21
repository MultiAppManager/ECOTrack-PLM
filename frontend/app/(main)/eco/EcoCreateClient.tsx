'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type EcoCreateClientProps = {
  userName: string
  userRole: string
}

type ProductOption = {
  id: string
  productCode: string
  name: string
  version: number
  salePrice: number
  costPrice: number
}
type BomOption = {
  id: string
  bomCode: string
  name: string
  version: number
  productCode: string
  components: any[]
}
type Component = { name: string; qty: number; unit: string; notes?: string }

const fmtINR = (v: number | string) =>
  '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const EcoCreateClient = ({ userName, userRole }: EcoCreateClientProps) => {
  const router = useRouter()
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  const [title, setTitle] = useState('')
  const [ecoType, setEcoType] = useState<'Products' | 'Bills of Materials'>('Products')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedBomId, setSelectedBomId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [versionUpdate, setVersionUpdate] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [pNewName, setPNewName] = useState('')
  const [pNewSalePrice, setPNewSalePrice] = useState('')
  const [pNewCostPrice, setPNewCostPrice] = useState('')
  const [pNotes, setPNotes] = useState('')
  const [bomComponents, setBomComponents] = useState<Component[]>([])
  const [bomNotes, setBomNotes] = useState('')

  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [bomOptions, setBomOptions] = useState<BomOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  const [currentProduct, setCurrentProduct] = useState<ProductOption | null>(null)
  const [currentBom, setCurrentBom] = useState<BomOption | null>(null)

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true)
    try {
      const [pRes, bRes] = await Promise.all([
        fetch(`${API_BASE}/api/products/active-latest`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/boms/active-latest`, { credentials: 'include' }),
      ])
      if (pRes.ok) setProductOptions(await pRes.json())
      if (bRes.ok) setBomOptions(await bRes.json())
    } catch {
      /* silent */
    } finally {
      setLoadingOptions(false)
    }
  }, [API_BASE])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    const p = productOptions.find((x) => x.id === selectedProductId)
    setCurrentProduct(p || null)
    if (p) {
      setPNewName(p.name)
      setPNewSalePrice(String(p.salePrice))
      setPNewCostPrice(String(p.costPrice))
    }
  }, [selectedProductId, productOptions])

  useEffect(() => {
    const b = bomOptions.find((x) => x.id === selectedBomId)
    setCurrentBom(b || null)
    if (b) {
      setBomComponents(Array.isArray(b.components) ? b.components.map((c) => ({ ...c })) : [])
    }
  }, [selectedBomId, bomOptions])

  const resetForm = () => {
    setTitle('')
    setSelectedProductId('')
    setSelectedBomId('')
    setEffectiveDate('')
    setVersionUpdate(true)
    setPNewName('')
    setPNewSalePrice('')
    setPNewCostPrice('')
    setPNotes('')
    setBomComponents([])
    setBomNotes('')
    setCurrentProduct(null)
    setCurrentBom(null)
  }

  const addBomComponent = () =>
    setBomComponents((prev) => [...prev, { name: '', qty: 1, unit: 'pcs', notes: '' }])
  const updateBomComponent = (i: number, k: keyof Component, v: any) =>
    setBomComponents((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [k]: v } : c))
    )
  const removeBomComponent = (i: number) =>
    setBomComponents((prev) => prev.filter((_, idx) => idx !== i))

  const buildProposedChanges = () => {
    if (ecoType === 'Products') {
      const ch: any = {}
      if (pNewName.trim() && pNewName !== currentProduct?.name) ch.name = pNewName.trim()
      if (pNewSalePrice !== '' && Number(pNewSalePrice) !== Number(currentProduct?.salePrice))
        ch.salePrice = parseFloat(pNewSalePrice)
      if (pNewCostPrice !== '' && Number(pNewCostPrice) !== Number(currentProduct?.costPrice))
        ch.costPrice = parseFloat(pNewCostPrice)
      if (pNotes.trim()) ch.notes = pNotes.trim()
      return ch
    } else {
      const ch: any = { components: bomComponents }
      if (bomNotes.trim()) ch.notes = bomNotes.trim()
      return ch
    }
  }

  const getDiffPreview = () => {
    if (!currentProduct && !currentBom) return []
    if (ecoType === 'Products' && currentProduct) {
      const items: { field: string; from: string; to: string; changed: boolean }[] = []
      items.push({
        field: 'Product Name',
        from: currentProduct.name,
        to: pNewName || currentProduct.name,
        changed: pNewName.trim() !== '' && pNewName !== currentProduct.name,
      })
      items.push({
        field: 'Sale Price',
        from: fmtINR(currentProduct.salePrice),
        to: pNewSalePrice ? fmtINR(pNewSalePrice) : fmtINR(currentProduct.salePrice),
        changed: pNewSalePrice !== '' && Number(pNewSalePrice) !== Number(currentProduct.salePrice),
      })
      items.push({
        field: 'Cost Price',
        from: fmtINR(currentProduct.costPrice),
        to: pNewCostPrice ? fmtINR(pNewCostPrice) : fmtINR(currentProduct.costPrice),
        changed: pNewCostPrice !== '' && Number(pNewCostPrice) !== Number(currentProduct.costPrice),
      })
      return items
    }
    return []
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!selectedProductId) {
      toast.error('Please select a Product')
      return
    }
    if (!selectedBomId) {
      toast.error('Please select a Bill of Materials')
      return
    }

    const proposedChanges = buildProposedChanges()
    if (ecoType === 'Products' && Object.keys(proposedChanges).length === 0) {
      toast.error('Please enter at least one proposed change for the product')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/eco-requests`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          ecoType,
          productId: selectedProductId,
          bomId: selectedBomId,
          product: '',
          bom: '',
          effectiveDate: effectiveDate || null,
          versionUpdate,
          status: 'Draft',
          changes: proposedChanges,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save ECO request')
      toast.success('ECO request created')
      resetForm()
      router.push('/eco')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSaving(false)
    }
  }

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
          <h1 className="text-2xl font-bold text-[#7c3aed]">Create New ECO Request</h1>
        </div>
        <div className="w-8 h-8 rounded-full border border-purple-300 flex items-center justify-center text-purple-600 text-sm font-bold">
          {userName?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>

      <div className="px-8 py-5">
        <div className="rounded-2xl border-2 border-purple-200 shadow-sm p-6 bg-white space-y-5 max-w-4xl">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <Link
              href="/eco"
              className="px-4 py-1.5 rounded-lg border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Update hydraulic pump pricing"
              className="w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ECO Type *</label>
              <select
                value={ecoType}
                onChange={(e) => {
                  setEcoType(e.target.value as any)
                  resetForm()
                  setTitle(title)
                }}
                className="w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Products">Products</option>
                <option value="Bills of Materials">Bills of Materials</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Effective Date</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Product * <span className="text-[10px] text-gray-400 font-normal">active versions only</span>
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">— Select Product —</option>
                {loadingOptions && <option disabled>Loading…</option>}
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.productCode} · {p.name} (v{p.version})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Bill of Materials *{' '}
                <span className="text-[10px] text-gray-400 font-normal">active versions only</span>
              </label>
              <select
                value={selectedBomId}
                onChange={(e) => setSelectedBomId(e.target.value)}
                className="w-full border-2 border-purple-300 p-2.5 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">— Select BOM —</option>
                {loadingOptions && <option disabled>Loading…</option>}
                {bomOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bomCode} · {b.name} (v{b.version})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(selectedProductId || selectedBomId) && (
            <div className="rounded-xl border-2 border-dashed border-purple-200 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#7c3aed]" />
                <p className="font-bold text-sm text-[#7c3aed]">
                  {ecoType === 'Products' ? 'Proposed Product Changes' : 'Proposed BOM Changes'}
                </p>
                <span className="text-[10px] text-gray-400 ml-1">Leave blank to keep current values</span>
              </div>

              {ecoType === 'Products' && currentProduct && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-40 truncate">
                        Current: {currentProduct.name}
                      </span>
                      <input
                        value={pNewName}
                        onChange={(e) => setPNewName(e.target.value)}
                        placeholder="New name (or leave to keep)"
                        className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Sale Price (₹)
                      </label>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">
                          Current: {fmtINR(currentProduct.salePrice)}
                        </p>
                        <input
                          type="number"
                          value={pNewSalePrice}
                          onChange={(e) => setPNewSalePrice(e.target.value)}
                          placeholder={String(currentProduct.salePrice)}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Cost Price (₹)
                      </label>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">
                          Current: {fmtINR(currentProduct.costPrice)}
                        </p>
                        <input
                          type="number"
                          value={pNewCostPrice}
                          onChange={(e) => setPNewCostPrice(e.target.value)}
                          placeholder={String(currentProduct.costPrice)}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Reason / Specification Notes
                    </label>
                    <input
                      value={pNotes}
                      onChange={(e) => setPNotes(e.target.value)}
                      placeholder="e.g. Price updated due to raw material cost increase"
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  {getDiffPreview().some((d) => d.changed) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-2">
                        📋 Proposed Changes Preview
                      </p>
                      <div className="space-y-1">
                        {getDiffPreview()
                          .filter((d) => d.changed)
                          .map((d) => (
                            <div key={d.field} className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-gray-700 w-24">{d.field}:</span>
                              <span className="text-red-500 line-through">{d.from}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600 font-semibold">{d.to}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {ecoType === 'Bills of Materials' && currentBom && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600">
                      Edit Components ({bomComponents.length} items)
                    </p>
                    <button
                      type="button"
                      onClick={addBomComponent}
                      className="text-xs text-[#7c3aed] font-semibold hover:underline"
                    >
                      + Add Component
                    </button>
                  </div>

                  {bomComponents.length === 0 ? (
                    <button
                      type="button"
                      onClick={addBomComponent}
                      className="w-full py-3 border-2 border-dashed border-purple-200 rounded-xl text-xs text-gray-400 hover:border-purple-400 hover:text-[#7c3aed] transition-all"
                    >
                      + Add components
                    </button>
                  ) : (
                    <div className="rounded-xl border border-purple-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-purple-50 border-b border-purple-100">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-purple-800">
                              Component
                            </th>
                            <th className="text-center px-2 py-2 font-semibold text-purple-800 w-20">
                              Qty
                            </th>
                            <th className="text-center px-2 py-2 font-semibold text-purple-800 w-24">
                              Unit
                            </th>
                            <th className="text-left px-2 py-2 font-semibold text-purple-800">Notes</th>
                            <th className="w-6" />
                          </tr>
                        </thead>
                        <tbody>
                          {bomComponents.map((c, i) => (
                            <tr key={i} className="border-t border-purple-50">
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  value={c.name}
                                  onChange={(e) => updateBomComponent(i, 'name', e.target.value)}
                                  placeholder="Component name"
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300"
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  type="number"
                                  value={c.qty}
                                  onChange={(e) =>
                                    updateBomComponent(i, 'qty', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-300"
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <select
                                  value={c.unit}
                                  onChange={(e) => updateBomComponent(i, 'unit', e.target.value)}
                                  className="w-full border border-gray-200 rounded px-1 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-300"
                                >
                                  {['pcs', 'm', 'm²', 'm³', 'kg', 'g', 'L', 'ml', 'set', 'lot'].map(
                                    (u) => (
                                      <option key={u}>{u}</option>
                                    )
                                  )}
                                </select>
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  type="text"
                                  value={c.notes || ''}
                                  onChange={(e) => updateBomComponent(i, 'notes', e.target.value)}
                                  placeholder="optional"
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300"
                                />
                              </td>
                              <td className="px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeBomComponent(i)}
                                  className="text-red-400 hover:text-red-600 text-base"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                    <input
                      value={bomNotes}
                      onChange={(e) => setBomNotes(e.target.value)}
                      placeholder="Reason for BOM change…"
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={versionUpdate}
              onChange={(e) => setVersionUpdate(e.target.checked)}
              className="accent-purple-600 w-4 h-4"
            />
            Version Update (creates new version on approval)
          </label>
        </div>
      </div>
    </div>
  )
}

export default EcoCreateClient
