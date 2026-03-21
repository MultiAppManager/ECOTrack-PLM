'use client'

import React, { useEffect, useMemo, useRef } from 'react'

type Star = {
  x: number
  y: number
  z: number
  r: number
  tw: number
  ph: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function StarBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const starsRef = useRef<Star[]>([])

  const seed = useMemo(() => Math.random() * 10000, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const createStars = (w: number, h: number) => {
      // star density tuned for a premium but lightweight feel
      // Higher density + brighter stars so it looks "premium" even under light UI.
      // Slightly reduced so it doesn't look overcrowded.
      // Keep density modest so it feels premium, not crowded.
      const target = clamp(Math.floor((w * h) / 13500), 70, 180)
      const rand = (n: number) => {
        // deterministic-ish RNG per mount
        const x = Math.sin(n + seed) * 10000
        return x - Math.floor(x)
      }

      const stars: Star[] = []
      for (let i = 0; i < target; i++) {
        const z = rand(i * 3.1) // 0..1
        stars.push({
          x: rand(i * 1.7) * w,
          y: rand(i * 2.3) * h,
          z,
          r: 0.65 + z * 1.2,
          tw: 0.6 + z * 1.3,
          ph: rand(i * 9.9) * Math.PI * 2,
        })
      }
      starsRef.current = stars
    }

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      createStars(w, h)
    }

    resize()

    let last = performance.now()
    const draw = (now: number) => {
      const dt = Math.min(40, now - last)
      last = now

      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      // Clear with transparent background so gradients below show through.
      ctx.clearRect(0, 0, w, h)

      const stars = starsRef.current
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]

        // Gentle drifting upward + slight sideways parallax.
        // Subtle drift so it feels premium and not distracting.
        const speed = (0.007 + s.z * 0.03) * (dt / 16.67)
        s.y -= speed * 8
        s.x += Math.sin((now / 1000) * 0.28 + s.ph) * (0.015 + s.z * 0.02) * (dt / 16.67)

        // wrap
        if (s.y < -10) s.y = h + 10
        if (s.x < -10) s.x = w + 10
        if (s.x > w + 10) s.x = -10

        // Light twinkle (premium, not busy).
        const twinkle = 0.55 + Math.sin(now / 300 + s.ph) * (0.14 + s.z * 0.22)
        // Increase visibility on bright UI while staying subtle.
        const alpha = clamp(0.06 + s.z * 0.16 + twinkle * 0.08, 0, 0.38)

        // Lightly sparkly "black" (dark-gray specks).
        const tint =
          s.z > 0.82
            ? { r: 6, g: 8, b: 14 } // deep
            : s.z > 0.58
              ? { r: 14, g: 16, b: 24 } // mid
              : { r: 24, g: 26, b: 38 } // light speck (still dark)

        // Slightly bigger dots so the effect is visible on light cards.
        const dotRadius = s.r * (0.78 + twinkle * 0.18)

        ctx.shadowColor = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${alpha})`
        ctx.shadowBlur = 2.5 + dotRadius * 3.2

        ctx.beginPath()
        ctx.fillStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${alpha})`
        ctx.arc(s.x, s.y, dotRadius, 0, Math.PI * 2)
        ctx.fill()

        // Rare subtle cross-sparkle.
        if (s.z > 0.93 && i % 18 === 0) {
          const k = (Math.sin(now / 520 + s.ph) + 1) * 0.5
          if (k > 0.92) {
            ctx.strokeStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${alpha * 1.05})`
            ctx.lineWidth = 1
            ctx.beginPath()
            const len = 6
            ctx.moveTo(s.x - len, s.y)
            ctx.lineTo(s.x + len, s.y)
            ctx.moveTo(s.x, s.y - len)
            ctx.lineTo(s.x, s.y + len)
            ctx.stroke()
          }
        }
      }

      ctx.globalCompositeOperation = 'source-over'
      rafRef.current = window.requestAnimationFrame(draw)
    }

    rafRef.current = window.requestAnimationFrame(draw)
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [seed])

  return (
    <div className='absolute inset-0 overflow-hidden pointer-events-none'>
      <canvas ref={canvasRef} className='absolute inset-0 w-full h-full' />
      {/* Subtle vignette so dark specks become visible on white UI */}
      <div className='absolute inset-0 bg-[radial-gradient(1000px_circle_at_25%_15%,rgba(0,0,0,0.06),transparent_58%),radial-gradient(700px_circle_at_80%_30%,rgba(0,0,0,0.04),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.02),transparent_45%)]' />
    </div>
  )
}

