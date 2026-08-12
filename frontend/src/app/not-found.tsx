'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from './not-found.module.css'

function RouteIllustration() {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 560 430"
      role="img"
      aria-labelledby="route-illustration-title route-illustration-description"
    >
      <title id="route-illustration-title">A route that could not be found</title>
      <desc id="route-illustration-description">
        An abstract browser window connected to a location pin by a broken route.
      </desc>

      <defs>
        <linearGradient id="window-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f4f8fa" />
        </linearGradient>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#101827" floodOpacity="0.12" />
        </filter>
      </defs>

      <path d="M89 338 C 135 284, 216 335, 277 278 S 362 203, 421 240" fill="none" stroke="#0b8f7e" strokeWidth="6" strokeLinecap="round" strokeDasharray="15 16" />
      <path d="M275 262 l20 20 M295 262 l-20 20" stroke="#0b8f7e" strokeWidth="7" strokeLinecap="round" />

      <g transform="translate(54 286)" filter="url(#soft-shadow)">
        <path d="M45 0 C20 0 0 20 0 45 C0 81 45 126 45 126 C45 126 90 81 90 45 C90 20 70 0 45 0Z" fill="#0b8f7e" />
        <circle cx="45" cy="44" r="18" fill="#ffffff" />
      </g>

      <g transform="translate(181 42)" filter="url(#soft-shadow)">
        <rect width="325" height="210" rx="22" fill="url(#window-fill)" stroke="#d8e1e8" strokeWidth="3" />
        <path d="M0 22 C0 10 10 0 22 0 H303 C315 0 325 10 325 22 V48 H0Z" fill="#101827" />
        <circle cx="27" cy="25" r="7" fill="#67d8c7" />
        <circle cx="51" cy="25" r="7" fill="#9edfd6" />
        <circle cx="75" cy="25" r="7" fill="#dce8ec" />
        <text x="162" y="105" textAnchor="middle" fill="#64748b" fontSize="19" fontFamily="Inter, sans-serif">/unknown-route</text>
        <path d="M163 126 l29 50 h-58Z" fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinejoin="round" />
        <path d="M163 141 v16" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
        <circle cx="163" cy="166" r="3" fill="#94a3b8" />
      </g>

      <g transform="translate(334 294)">
        {[
          [0, 0],
          [86, 0],
          [0, 86],
          [86, 86],
        ].map(([x, y], index) => (
          <g key={index} transform={`translate(${x} ${y})`}>
            <rect width="68" height="68" rx="16" fill="#ffffff" stroke="#dce5ea" strokeWidth="3" />
            <circle cx="34" cy="34" r="10" fill="none" stroke="#0b8f7e" strokeWidth="4" />
            <path d="M34 17 v8 M34 43 v8 M17 34 h8 M43 34 h8" stroke="#0b8f7e" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  )
}

export default function NotFound() {
  const router = useRouter()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Hakika Business OS home">
          <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>
          <span><strong>Hakika</strong><small>Business OS</small></span>
        </Link>

        <Link href="/support" className={styles.supportLink}>Support</Link>
      </header>

      <section className={styles.content} aria-labelledby="not-found-title">
        <div className={styles.card}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Page not found</p>
            <p className={styles.code} aria-hidden="true">404</p>
            <h1 id="not-found-title">This page took a wrong turn.</h1>
            <p className={styles.description}>The link may be outdated, the page may have moved, or you may not have access to this destination.</p>

            <div className={styles.actions}>
              <Link href="/" className={styles.primaryButton}>Back to home</Link>
              <Link href="/apps" className={styles.secondaryButton}>Open app launcher</Link>
            </div>

            <button className={styles.backButton} type="button" onClick={() => router.back()}>
              <span aria-hidden="true">←</span> Go back
            </button>
          </div>

          <div className={styles.visual}>
            <RouteIllustration />
          </div>
        </div>
      </section>
    </main>
  )
}
