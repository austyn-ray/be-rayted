import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

export default function Home() {
  const router = useRouter()
  const [role, setRole] = useState(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [alreadySignedUp, setAlreadySignedUp] = useState(false)
  const [signedUpName, setSignedUpName] = useState('')

  useEffect(() => {
    async function checkSignup() {
      const existingName = localStorage.getItem('be_rayted_comic_name')
      const existingSession = localStorage.getItem('be_rayted_session_id')
      if (!existingName) return

      // Check current session from Supabase
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'session_id')
        .single()

      const currentSession = data?.value || 'default'

      if (existingSession === currentSession) {
        setAlreadySignedUp(true)
        setSignedUpName(existingName)
      } else {
        // Session changed — clear stale signup
        localStorage.removeItem('be_rayted_comic_name')
        localStorage.removeItem('be_rayted_session_id')
      }
    }
    checkSignup()
  }, [])

  async function handleComicSubmit() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Please enter your name!'); return }
    setSubmitting(true)
    const { error } = await supabase.from('comics').insert({ name: trimmed, is_active: false })
    if (error) { setError('Something went wrong. Try again!'); setSubmitting(false); return }

    // Get current session and save with signup
    const { data } = await supabase.from('settings').select('value').eq('key', 'session_id').single()
    const currentSession = data?.value || 'default'
    localStorage.setItem('be_rayted_comic_name', trimmed)
    localStorage.setItem('be_rayted_session_id', currentSession)
    router.push('/vote?comic=' + encodeURIComponent(trimmed))
  }

  return (
    <>
      <Head>
        <title>Be Rayted</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Bangers&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="container">
        <div className="logo-wrap">
          <img src="/logo.png" alt="Be Rayted" className="logo" />
        </div>

        <p className="tagline">Don't Get Berated.....BE RAYTED!</p>

        {!role ? (
          <div className="card">
            <p className="card-label">I am here as...</p>
            <div className="role-buttons">
              <button className="role-btn" onClick={() => router.push('/vote')}>
                <span className="role-icon">👥</span>
                <span className="role-text">Audience</span>
              </button>
              <button className="role-btn" onClick={() => {
                if (alreadySignedUp) {
                  router.push('/vote?comic=' + encodeURIComponent(signedUpName))
                } else {
                  setRole('comic')
                }
              }}>
                <span className="role-icon">🎤</span>
                <span className="role-text">Comic</span>
              </button>
            </div>
          </div>
        ) : alreadySignedUp ? (
          <div className="card">
            <div className="already-signed">
              <div className="check-circle">✓</div>
              <p className="card-label">You're already on the list!</p>
              <p className="already-name">{signedUpName}</p>
              <button className="submit-btn" onClick={() => router.push('/vote?comic=' + encodeURIComponent(signedUpName))}>
                View My Spot
              </button>
              <button className="back-btn" onClick={() => {
                localStorage.removeItem('be_rayted_comic_name')
                localStorage.removeItem('be_rayted_session_id')
                setAlreadySignedUp(false)
                setSignedUpName('')
                setRole('comic')
              }}>Not you? Sign up again</button>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="card-label">What's your name?</p>
            <input
              className="input"
              placeholder="Your name..."
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleComicSubmit()}
              autoFocus
            />
            {error && <p className="error">{error}</p>}
            <button
              className={`submit-btn ${!name.trim() ? 'disabled' : ''}`}
              onClick={handleComicSubmit}
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Adding you to the list...' : "I'm In!"}
            </button>
            <button className="back-btn" onClick={() => { setRole(null); setName(''); setError('') }}>← Back</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0a0a0a;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          color: #fff;
        }
        .container {
          max-width: 480px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
        }
        .logo-wrap { width: 220px; }
        .logo { width: 100%; height: auto; }
        .tagline {
          font-family: 'Bangers', cursive;
          font-size: 1rem;
          letter-spacing: 0.15em;
          color: #888;
          text-align: center;
        }
        .card {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 1.25rem;
          padding: 2rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .card-label {
          font-family: 'Bangers', cursive;
          font-size: 1.4rem;
          letter-spacing: 0.08em;
          color: #ffaa00;
          text-align: center;
        }
        .role-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .role-btn {
          background: #222;
          border: 2px solid #333;
          border-radius: 1rem;
          color: #fff;
          padding: 1.5rem 1rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          transition: all 0.2s;
        }
        .role-btn:hover { border-color: #ffaa00; background: #2a2200; }
        .role-icon { font-size: 2rem; }
        .role-text { font-family: 'Bangers', cursive; font-size: 1.3rem; letter-spacing: 0.08em; }
        .input {
          width: 100%;
          background: #222;
          border: 2px solid #333;
          border-radius: 0.75rem;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem;
          padding: 0.85rem 1rem;
          outline: none;
          text-align: center;
        }
        .input:focus { border-color: #ffaa00; }
        .error { color: #ff4444; font-size: 0.85rem; text-align: center; }
        .submit-btn {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, #ffaa00, #ff7700);
          border: none;
          border-radius: 0.75rem;
          color: #000;
          font-family: 'Bangers', cursive;
          font-size: 1.3rem;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.2s;
        }
        .submit-btn:hover:not(.disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,170,0,0.4); }
        .submit-btn.disabled { background: #2a2a2a; color: #555; cursor: not-allowed; }
        .back-btn {
          background: transparent;
          border: none;
          color: #555;
          font-size: 0.85rem;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          text-align: center;
        }
        .already-signed { text-align: center; display: flex; flex-direction: column; gap: 0.75rem; align-items: center; }
        .check-circle {
          width: 55px; height: 55px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffaa00, #ff7700);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; font-weight: bold; color: #000;
        }
        .already-name { font-family: 'Bangers', cursive; font-size: 1.8rem; letter-spacing: 0.05em; color: #fff; }
      `}</style>
    </>
  )
}
