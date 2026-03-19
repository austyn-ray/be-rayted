import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
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
  const router = useRouter()
  const { comic: comicName } = router.query

  const [activeComic, setActiveComic] = useState(null)
  const [allComics, setAllComics] = useState([])
  const [rating, setRating] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyVoted, setAlreadyVoted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [respondentId, setRespondentId] = useState(null)
  const [waitingMessage, setWaitingMessage] = useState(0)

  const waitingMessages = [
    "The mic is warming up...",
    "Stay in your seat — it's about to get real.",
    "Almost showtime again!",
    "Next comic incoming...",
  ]

  useEffect(() => {
    setRespondentId(getOrCreateRespondentId())
  }, [])

  useEffect(() => {
    if (!respondentId) return
    fetchAll()

    const channel = supabase
      .channel('vote-comics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comics' }, fetchAll)
      .subscribe()

    // Poll every 5 seconds to catch sort_order changes
    const poll = setInterval(fetchAll, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [respondentId])

  useEffect(() => {
    if (activeComic) return
    const interval = setInterval(() => {
      setWaitingMessage(prev => (prev + 1) % waitingMessages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [activeComic])

  async function fetchAll() {
    const { data } = await supabase
      .from('comics')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (data) {
      setAllComics(data)
      const active = data.find(c => c.is_active)

      if (active) {
        setActiveComic(prev => {
          if (!prev || prev.id !== active.id) {
            // New comic became active — reset voting state
            setSubmitted(false)
            setAlreadyVoted(false)
            setRating(null)
            // Check if this device already voted for the new comic
            supabase
              .from('votes')
              .select('id')
              .eq('comic_id', active.id)
              .eq('respondent_id', respondentId)
              .single()
              .then(({ data: existingVote }) => {
                if (existingVote) setAlreadyVoted(true)
              })
          }
          return active
        })
      } else {
        setActiveComic(null)
      }
    }
    setLoading(false)
  }

  async function submitVote() {
    if (rating === null || !activeComic || !respondentId) return
    setSubmitting(true)

    const { error } = await supabase.from('votes').insert({
      comic_id: activeComic.id,
      rating: rating,
      respondent_id: respondentId,
    })

    if (error?.code === '23505') {
      setAlreadyVoted(true)
    } else {
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  function getComicsAhead() {
    if (!comicName || allComics.length === 0) return null
    const idx = allComics.findIndex(c => c.name.toLowerCase() === comicName.toLowerCase())
    if (idx === -1) return null
    const ahead = allComics.slice(0, idx).filter(c => !c.is_active).length
    return ahead
  }

  function getOnStage() {
    return allComics.find(c => c.is_active) || null
  }

  function getOnDeck() {
    const remaining = allComics.filter(c => !c.has_performed && !c.is_active)
    return remaining[0] || null
  }

  const onStage = getOnStage()
  const onDeck = getOnDeck()

  const comicsAhead = getComicsAhead()

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

        <div className="card">
          {loading ? (
            <div className="state-center">
              <div className="spinner" />
            </div>
          ) : !activeComic ? (
            <div className="state-center">
              <div className="mic-icon">🎤</div>
              <p className="waiting-text">{waitingMessages[waitingMessage]}</p>
            </div>
          ) : alreadyVoted ? (
            <div className="state-center">
              <div className="check-circle">✓</div>
              <h2 className="state-title">Already Rayted!</h2>
              <p className="state-sub">You already voted for <strong>{activeComic.name}</strong>.</p>
              <p className="state-hint">One vote per comic — no stuffing the ballot!</p>
            </div>
          ) : submitted ? (
            <div className="state-center">
              <div className="check-circle">✓</div>
              <h2 className="state-title">Rayting Submitted!</h2>
              <p className="state-sub">You gave <strong>{activeComic.name}</strong> a <strong>{rating}/10</strong></p>
              <p className="state-hint">Next comic coming up soon...</p>
            </div>
          ) : (
            <div className="voting">
              <p className="now-voting-label">Now Rayting:</p>
              <h2 className="comic-name">{activeComic.name}</h2>

              <div className="rating-grid">
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    className={`rating-btn ${rating === n ? 'selected' : ''}`}
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

        {(onStage || onDeck) && (
          <div className="counter-banner">
            {comicName && comicsAhead !== null && (
              <div className="counter-main">
                {comicsAhead === 0
                  ? "🎤 YOU'RE NEXT!"
                  : `COMICS UNTIL YOU'RE UP: ${comicsAhead}`}
              </div>
            )}
            <div className="counter-details">
              {onStage && <span className="counter-info">🎤 On Stage: <strong>{onStage.name}</strong></span>}
              {onDeck && (!comicName || onDeck.name.toLowerCase() !== comicName.toLowerCase()) && (
                <span className="counter-info">⏭ On Deck: <strong>{onDeck.name}</strong></span>
              )}
            </div>
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
          padding: 1rem 1.25rem;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }
        .logo-wrap { width: 150px; }
        .logo { width: 100%; height: auto; }
        .tagline {
          font-family: 'Bangers', cursive;
          font-size: 0.85rem;
          letter-spacing: 0.15em;
          color: #888;
          text-align: center;
        }
        .card {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 1.25rem;
          padding: 1.5rem 1.25rem;
          min-height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .state-center { text-align: center; width: 100%; }
        .mic-icon { font-size: 2.5rem; margin-bottom: 1rem; }
        .waiting-text { color: #555; font-size: 1rem; }
        .check-circle {
          width: 60px; height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffaa00, #ff7700);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; font-weight: bold; color: #000;
          margin: 0 auto 1rem;
        }
        .state-title {
          font-family: 'Bangers', cursive;
          font-size: 1.8rem;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
          color: #ffaa00;
        }
        .state-sub { color: #ccc; margin-bottom: 0.4rem; }
        .state-hint { font-size: 0.8rem; color: #555; }
        .voting { width: 100%; text-align: center; }
        .now-voting-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #ffaa00;
          margin-bottom: 0.25rem;
        }
        .comic-name {
          font-family: 'Bangers', cursive;
          font-size: 2rem;
          letter-spacing: 0.05em;
          margin-bottom: 1.25rem;
        }
        .rating-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .rating-btn {
          background: #222;
          border: 2px solid #2a2a2a;
          border-radius: 0.75rem;
          color: #fff;
          font-family: 'Bangers', cursive;
          font-size: 1.3rem;
          padding: 0.7rem;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.05em;
        }
        .rating-btn:hover { background: #2a2a2a; border-color: #ffaa00; transform: scale(1.05); }
        .rating-btn.selected { background: linear-gradient(135deg, #ffaa00, #ff7700); border-color: #ffaa00; color: #000; transform: scale(1.08); }
        .rating-label {
          font-size: 1rem;
          margin-bottom: 1.25rem;
          min-height: 1.5rem;
          color: #aaa;
        }
        .submit-btn {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, #ffaa00, #ff7700);
          border: none;
          border-radius: 0.75rem;
          color: #000;
          font-family: 'Bangers', cursive;
          font-size: 1.2rem;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.2s;
        }
        .submit-btn:hover:not(.disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,170,0,0.4); }
        .submit-btn.disabled { background: #2a2a2a; color: #555; cursor: not-allowed; }
        .counter-banner {
          width: 100%;
          background: #1a1a1a;
          border: 2px solid #ffaa00;
          border-radius: 1rem;
          padding: 0.85rem 1rem;
          text-align: center;
        }
        .counter-main {
          font-family: 'Bangers', cursive;
          font-size: 1.3rem;
          letter-spacing: 0.1em;
          color: #ffaa00;
          margin-bottom: 0.5rem;
        }
        .counter-details {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .counter-info {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.03em;
        }
        .counter-info strong {
          color: rgba(255,255,255,0.55);
          font-weight: 600;
        }
        .spinner {
          width: 32px; height: 32px;
          border: 3px solid #222;
          border-top-color: #ffaa00;
          animation: spin 0.8s linear infinite;
          border-radius: 50%;
          margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
