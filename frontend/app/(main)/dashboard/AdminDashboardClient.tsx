'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts'
import {
  FileText,
  Package,
  Layers,
  Users,
  Clock,
  TrendingUp,
  Activity,
} from 'lucide-react'

type DashboardStats = {
  ecoByStatus: { status: string; count: number }[]
  ecoByType: { ecoType: string; count: number }[]
  ecoTrend: { month: string; count: number }[]
  productCount: number
  bomCount: number
  userCount: number
  totalEco: number
  pendingEco?: number
  recentEcos?: { id: string; ecoCode: string; title: string; status: string; ecoType: string; createdAt: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  Draft: '#64748b',
  Reviewed: '#3b82f6',
  Approved: '#10b981',
  Applied: '#8b5cf6',
  Rejected: '#ef4444',
}

const TYPE_COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd']

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatMonth = (m: string) => {
  const [y, mo] = m.split('-')
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`
}

const formatDate = (d: string) => {
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const AdminDashboardClient = () => {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/stats`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch stats')
      setStats(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [API_BASE])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 60000)
    return () => clearInterval(interval)
  }, [loadStats])

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center bg-slate-50/80">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-2xl px-8 py-5 max-w-md text-center">
          <p className="font-semibold">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const pendingCount = stats.pendingEco ?? 0
  const approvedCount = stats.ecoByStatus.find((s) => s.status === 'Approved')?.count ?? 0
  const approvalRate = stats.totalEco > 0 ? Math.round((approvedCount / stats.totalEco) * 100) : 0

  const statCards = [
    {
      label: 'Total ECOs',
      value: stats.totalEco,
      sub: `${pendingCount} pending review`,
      icon: FileText,
      gradient: 'from-violet-600 via-purple-600 to-indigo-700',
      shadow: 'shadow-purple-200/50',
    },
    {
      label: 'Products',
      value: stats.productCount,
      sub: 'Active versions',
      icon: Package,
      gradient: 'from-blue-600 to-cyan-500',
      shadow: 'shadow-blue-200/50',
    },
    {
      label: 'Bills of Materials',
      value: stats.bomCount,
      sub: 'Active BOMs',
      icon: Layers,
      gradient: 'from-indigo-600 to-violet-500',
      shadow: 'shadow-indigo-200/50',
    },
    {
      label: 'Users',
      value: stats.userCount,
      sub: 'Registered',
      icon: Users,
      gradient: 'from-purple-600 to-fuchsia-500',
      shadow: 'shadow-fuchsia-200/50',
    },
  ]

  const ecoByStatusData = stats.ecoByStatus.length > 0
    ? stats.ecoByStatus.sort((a, b) => b.count - a.count)
    : [{ status: 'No data', count: 0 }]

  const ecoByTypeData = stats.ecoByType.length > 0 ? stats.ecoByType : [{ ecoType: 'No data', count: 0 }]

  const ecoTrendData = (() => {
    if (stats.ecoTrend.length === 0) return [{ month: 'N/A', count: 0, label: 'N/A' }]
    const months: string[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map((m) => {
      const found = stats.ecoTrend.find((t) => t.month === m)
      return { month: m, count: found?.count ?? 0, label: formatMonth(m) }
    })
  })()

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-indigo-600 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-1">Real-time PLM overview and metrics</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Live data · refreshes every 60s</span>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-6 shadow-xl ${card.shadow} transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 -translate-y-8 translate-x-8 rounded-full bg-white/10" />
              <div className="relative">
                <card.icon className="w-10 h-10 text-white/90 mb-4" strokeWidth={1.5} />
                <p className="text-white/90 text-sm font-medium">{card.label}</p>
                <p className="text-4xl font-bold text-white mt-1 tracking-tight">{card.value}</p>
                <p className="text-white/70 text-xs mt-2">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick metrics row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{pendingCount}</p>
                <p className="text-xs text-slate-500 font-medium">Pending Review</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{approvalRate}%</p>
                <p className="text-xs text-slate-500 font-medium">Approval Rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ECO by Status - Bar Chart */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold text-slate-800">ECO by Status</h2>
              <p className="text-xs text-slate-500 mt-0.5">Distribution across workflow stages</p>
            </div>
            <div className="h-[300px] px-6 pb-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={ecoByStatusData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis
                    type="category"
                    dataKey="status"
                    width={70}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    stroke="#94a3b8"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      value,
                      props.payload.status,
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={32}>
                    {ecoByStatusData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={STATUS_COLORS[entry.status] || '#8b5cf6'}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ECO by Type - Donut Chart */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold text-slate-800">ECO by Type</h2>
              <p className="text-xs text-slate-500 mt-0.5">Products vs Bills of Materials</p>
            </div>
            <div className="h-[300px] px-6 pb-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ecoByTypeData}
                    dataKey="count"
                    nameKey="ecoType"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {ecoByTypeData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={TYPE_COLORS[index % TYPE_COLORS.length]}
                        stroke="white"
                        strokeWidth={3}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
                    }}
                    formatter={(value: number, name: string, props: any) => {
                      const total = ecoByTypeData.reduce((s, d) => s + d.count, 0)
                      const pct = total > 0 ? Math.round((value / total) * 100) : 0
                      return [`${value} (${pct}%)`, props.payload.ecoType]
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ paddingTop: 16 }}
                    formatter={(value) => (
                      <span className="text-sm font-medium text-slate-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Trend + Recent */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ECO Trend - Area Chart */}
          <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold text-slate-800">ECO Created Over Time</h2>
              <p className="text-xs text-slate-500 mt-0.5">Last 6 months</p>
            </div>
            <div className="h-[280px] px-6 pb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={ecoTrendData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="ecoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#94a3b8"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
                    }}
                    labelFormatter={(label) => label}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    fill="url(#ecoGradient)"
                    name="ECOs Created"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent ECOs */}
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="px-6 pt-6 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Recent ECOs</h2>
                <p className="text-xs text-slate-500 mt-0.5">Latest activity</p>
              </div>
              <Link
                href="/eco"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                View all →
              </Link>
            </div>
            <div className="px-6 pb-6 max-h-[280px] overflow-y-auto">
              {stats.recentEcos && stats.recentEcos.length > 0 ? (
                <ul className="space-y-3">
                  {stats.recentEcos.map((eco) => (
                    <li key={eco.ecoCode}>
                      <Link
                        href={`/eco/${eco.id}`}
                        className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors block"
                      >
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            eco.status === 'Approved' || eco.status === 'Applied'
                              ? 'bg-emerald-100 text-emerald-700'
                              : eco.status === 'Rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {eco.status}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate" title={eco.title}>
                            {eco.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {eco.ecoCode} · {formatDate(eco.createdAt)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 py-8 text-center">No ECOs yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboardClient
