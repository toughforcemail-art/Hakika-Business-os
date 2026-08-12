import Link from "next/link";

export default function ResetSuccess() { return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">Account recovery</div><h1>Password updated</h1><p className="auth-lede">Your password has been changed successfully. Sign in with your new password.</p><Link className="button primary auth-submit" href="/login">Continue to sign in</Link></div></section></main>; }
