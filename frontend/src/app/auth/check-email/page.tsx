import Link from "next/link";

export default function CheckEmail() { return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">Account recovery</div><h1>Check your email</h1><p className="auth-lede">If an account matches those details, recovery instructions have been sent. Follow the secure link to choose a new password.</p><Link className="button primary auth-submit" href="/login">Return to sign in</Link></div></section></main>; }
