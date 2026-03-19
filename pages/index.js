import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

function getOrCreateRespondentId() {
  if (typeof window === 'undefined') return null
  let id = localStorage.getItem('be_rayted_respondent_id')
  if (!id) {
    id = 'r_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
    localStorage.setItem('be_rayted_respondent_id', id)
  }
  return id
}

export default function Vote() {
  const [activeComic, setActiveComic] = useState(null)
  const [rating, setRating] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyVoted, setAlreadyVoted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [respondentId, setRespondentId] = useState(null)
  const [waitingMessage, setWaitingMessage] = useState(0)

  const waitingMessages = [
    "Waiting for the next comic...",
    "Stay in your seat — it's about to get real.",
    "The mic is warming up...",
    "Almost showtime again!",
  ]

  useEffect(() => {
    setRespondentId(getOrCreateRespondentId())
  }, [])

  useEffect(() => {
    if (!respondentId) return
    fetchActiveComic()

    const channel = supabase
      .channel('comics-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comics' }, () => {
        fetchActiveComic()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [respondentId])

  useEffect(() => {
    if (activeComic) return
    const interval = setInterval(() => {
      setWaitingMessage(prev => (prev + 1) % waitingMessages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [activeComic])

  async function fetchActiveComic() {
    const { data } = await supabase
      .from('comics')
      .select('*')
      .eq('is_active', true)
      .single()

    if (data) {
      if (!activeComic || activeComic.id !== data.id) {
        setActiveComic(data)
        setSubmitted(false)
        setAlreadyVoted(false)
        setRating(null)

        const { data: existingVote } = await supabase
          .from('votes')
          .select('id')
          .eq('comic_id', data.id)
          .eq('respondent_id', respondentId)
          .single()

        if (existingVote) setAlreadyVoted(true)
      }
    } else {
      setActiveComic(null)
    }
    setLoading(false)
  }

  async function submitVote() {
    if (!rating || !activeComic || !respondentId) return
    setSubmitting(true)

    const { error } = await supabase.from('votes').insert({
      comic_id: activeComic.id,
      rating: rating,
      respondent_id: respondentId,
    })

    if (error) {
      if (error.code === '23505') {
        setAlreadyVoted(true)
      }
    } else {
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  return (
    <>
      <Head>
        <title>Be Rayted</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="container">
        <div className="header">
          <div className="logo">BE RAYTED</div>
          <div className="tagline">come to be rated or be berated</div>
        </div>

        <div className="card">
          {loading ? (
            <div className="state-message">
              <div className="spinner" />
            </div>
          ) : !activeComic ? (
            <div className="waiting">
              <div className="mic-icon">🎤</div>
              <p className="waiting-text">{waitingMessages[waitingMessage]}</p>
            </div>
          ) : alreadyVoted ? (
            <div className="already-voted">
              <div className="check">✓</div>
              <h2>Already Rayted!</h2>
              <p>You already voted for <strong>{activeComic.name}</strong>.</p>
              <p className="sub">One vote per comic — no stuffing the ballot!</p>
            </div>
          ) : submitted ? (
            <div className="success">
              <div className="check">✓</div>
              <h2>Rayting Submitted!</h2>
              <p>You gave <strong>{activeComic.name}</strong> a <strong>{rating}/10</strong></p>
              <p className="sub">Next comic coming up soon...</p>
            </div>
          ) : (
            <div className="voting">
              <p className="now-voting">Now Rayting:</p>
              <h2 className="comic-name">{activeComic.name}</h2>

              <div className="rating-grid">
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    className={`rating-btn ${rating === n ? 'selected' : ''} ${n === 0 ? 'zero' : n >= 8 ? 'high' : ''}`}
                    onClick={() => setRating(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {rating !== null && (
                <div className="rating-label">
                  {rating === 0 ? "💀 Tough crowd" :
                   rating <= 3 ? "😬 Not quite" :
                   rating <= 5 ? "😐 Meh" :
                   rating <= 7 ? "😄 Pretty good!" :
                   rating <= 9 ? "🔥 Killing it!" :
                   "🏆 Perfect 10!"}
                </div>
              )}

              <button
                className={`submit-btn ${rating === null ? 'disabled' : ''}`}
                onClick={submitVote}
                disabled={rating === null || submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Rayting'}
              </button>
            </div>
          )}
        </div>

        <div className="footer">NYC Comedy</div>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0a0a0a;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          color: #fff;
          background-image: radial-gradient(ellipse at 20% 50%, rgba(255,60,0,0.08) 0%, transparent 60%),
                            radial-gradient(ellipse at 80% 20%, rgba(255,200,0,0.05) 0%, transparent 50%);
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
          gap: 2rem;
        }
        .header { text-align: center; }
        .logo {
          font-family: 'Black Han Sans', sans-serif;
          font-size: 3.5rem;
          letter-spacing: 0.05em;
          background: linear-gradient(135deg, #ff3c00, #ffcc00);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
        }
        .tagline {
          font-size: 0.75rem;
          color: #666;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-top: 0.5rem;
        }
        .card {
          width: 100%;
          background: #141414;
          border: 1px solid #222;
          border-radius: 1.5rem;
          padding: 2.5rem 2rem;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .waiting { text-align: center; }
        .mic-icon { font-size: 3rem; margin-bottom: 1rem; }
        .waiting-text {
          color: #555;
          font-size: 1rem;
          transition: opacity 0.3s;
        }
        .voting { width: 100%; text-align: center; }
        .now-voting {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #ff3c00;
          margin-bottom: 0.5rem;
        }
        .comic-name {
          font-family: 'Black Han Sans', sans-serif;
          font-size: 2.2rem;
          margin-bottom: 2rem;
          letter-spacing: 0.02em;
        }
        .rating-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.6rem;
          margin-bottom: 1.5rem;
        }
        .rating-btn {
          background: #1e1e1e;
          border: 1px solid #2a2a2a;
          border-radius: 0.75rem;
          color: #fff;
          font-family: 'Black Han Sans', sans-serif;
          font-size: 1.3rem;
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .rating-btn:hover { background: #2a2a2a; border-color: #444; transform: scale(1.05); }
        .rating-btn.selected { background: #ff3c00; border-color: #ff3c00; transform: scale(1.08); }
        .rating-btn.zero { color: #555; }
        .rating-btn.zero.selected { background: #333; border-color: #555; color: #fff; }
        .rating-btn.high.selected { background: linear-gradient(135deg, #ff3c00, #ffcc00); border-color: #ffcc00; }
        .rating-label {
          font-size: 1rem;
          margin-bottom: 1.5rem;
          min-height: 1.5rem;
          color: #aaa;
        }
        .submit-btn {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, #ff3c00, #ff6a00);
          border: none;
          border-radius: 0.75rem;
          color: #fff;
          font-family: 'Black Han Sans', sans-serif;
          font-size: 1.1rem;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.2s;
        }
        .submit-btn:hover:not(.disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,60,0,0.4); }
        .submit-btn.disabled { background: #2a2a2a; color: #555; cursor: not-allowed; }
        .success, .already-voted { text-align: center; }
        .check {
          font-size: 3rem;
          color: #ff3c00;
          margin-bottom: 1rem;
        }
        .success h2, .already-voted h2 {
          font-family: 'Black Han Sans', sans-serif;
          font-size: 1.8rem;
          margin-bottom: 0.75rem;
        }
        .success p, .already-voted p { color: #aaa; margin-bottom: 0.5rem; }
        .sub { font-size: 0.85rem; color: #555 !important; }
        .footer { color: #333; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; }
        .spinner {
          width: 32px; height: 32px;
          border: 3px solid #222;
          border-top-color: #ff3c00;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
