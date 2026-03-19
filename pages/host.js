import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

export default function Host() {
  const [comics, setComics] = useState([])
  const [votes, setVotes] = useState([])
  const [newComicName, setNewComicName] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeComic, setActiveComic] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  useEffect(() => {
    fetchAll()

    const comicsChannel = supabase
      .channel('host-comics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comics' }, fetchAll)
      .subscribe()

    const votesChannel = supabase
      .channel('host-votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, fetchVotes)
      .subscribe()

    return () => {
      supabase.removeChannel(comicsChannel)
      supabase.removeChannel(votesChannel)
    }
  }, [])

  async function fetchAll() {
    await Promise.all([fetchComics(), fetchVotes()])
    setLoading(false)
  }

  async function fetchComics() {
    const { data } = await supabase.from('comics').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (data) {
      setComics(data)
      const active = data.find(c => c.is_active)
      setActiveComic(active || null)
    }
  }

  function handleDragStart(index) {
    dragItem.current = index
  }

  function handleDragEnter(index) {
    dragOverItem.current = index
    const newComics = [...comics]
    const draggedItem = newComics.splice(dragItem.current, 1)[0]
    newComics.splice(index, 0, draggedItem)
    dragItem.current = index
    setComics(newComics)
  }

  async function handleDragEnd() {
    // Save new order to Supabase
    const updates = comics.map((comic, index) =>
      supabase.from('comics').update({ sort_order: index }).eq('id', comic.id)
    )
    await Promise.all(updates)
    dragItem.current = null
    dragOverItem.current = null
  }

  async function fetchVotes() {
    const { data } = await supabase.from('votes').select('*')
    if (data) setVotes(data)
  }

  async function addComic() {
    const name = newComicName.trim()
    if (!name) return
    await supabase.from('comics').insert({ name, is_active: false })
    setNewComicName('')
  }

  async function activateComic(comic) {
    // Deactivate all first
    await supabase.from('comics').update({ is_active: false }).neq('id', 0)
    // Activate selected
    await supabase.from('comics').update({ is_active: true }).eq('id', comic.id)
  }

  async function deactivateAll() {
    // Mark currently active comic as performed
    await supabase.from('comics').update({ is_active: false, has_performed: true }).eq('is_active', true)
    // Deactivate any others just in case
    await supabase.from('comics').update({ is_active: false }).neq('id', 0)
  }

  async function deleteComic(id) {
    await supabase.from('votes').delete().eq('comic_id', id)
    await supabase.from('comics').delete().eq('id', id)
  }

  async function clearNight() {
    await supabase.from('votes').delete().neq('id', 0)
    await supabase.from('comics').delete().neq('id', 0)
    // Bump session so previous comic sign-ups are invalidated
    const newSession = Date.now().toString()
    await supabase.from('settings').upsert({ key: 'session_id', value: newSession })
    setConfirmClear(false)
  }

  function getComicStats(comicId) {
    const comicVotes = votes.filter(v => v.comic_id === comicId)
    if (comicVotes.length === 0) return { avg: '-', count: 0 }
    const avg = comicVotes.reduce((sum, v) => sum + v.rating, 0) / comicVotes.length
    return { avg: avg.toFixed(1), count: comicVotes.length }
  }

  function getWinner() {
    if (comics.length === 0) return null
    let winner = null
    let highScore = -1
    comics.forEach(c => {
      const { avg, count } = getComicStats(c.id)
      if (count > 0 && parseFloat(avg) > highScore) {
        highScore = parseFloat(avg)
        winner = { ...c, avg, count }
      }
    })
    return winner
  }

  const winner = getWinner()

  return (
    <>
      <Head>
        <title>Be Rayted — Host Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Bangers&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="container">
        <div className="header">
          <img src="/logo.png" alt="Be Rayted" className="logo-img" />
          <div className="tagline">Host Dashboard</div>
        </div>

        {winner && (
          <div className="winner-banner">
            🏆 Current Leader: <strong>{winner.name}</strong> — {winner.avg}/10 ({winner.count} votes)
          </div>
        )}

        {activeComic && (
          <div className="active-banner">
            🎤 Voting OPEN for: <strong>{activeComic.name}</strong>
            <button className="close-btn" onClick={deactivateAll}>Close Voting</button>
          </div>
        )}

        <div className="section">
          <h2 className="section-title">Add Comic to Lineup</h2>
          <div className="add-row">
            <input
              className="input"
              placeholder="Comic's name..."
              value={newComicName}
              onChange={e => setNewComicName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addComic()}
            />
            <button className="btn-primary" onClick={addComic}>Add</button>
          </div>
        </div>

        <div className="section">
          <h2 className="section-title">Remaining Comics</h2>
          {loading ? (
            <div className="empty">Loading...</div>
          ) : comics.filter(c => !c.has_performed).length === 0 ? (
            <div className="empty">No comics remaining.</div>
          ) : (
            <div className="comic-list">
              {comics.filter(c => !c.has_performed).map((comic, index) => {
                const { avg, count } = getComicStats(comic.id)
                const isActive = comic.is_active
                return (
                  <div
                    key={comic.id}
                    className={`comic-row ${isActive ? 'active' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                  >
                    <span className="drag-handle">⠿</span>
                    <div className="comic-info">
                      <span className="comic-number">{index + 1}</span>
                      <span className="comic-name">{comic.name}</span>
                      {isActive && <span className="live-badge">LIVE</span>}
                    </div>
                    <div className="comic-stats">
                      <span className="stat">{avg} avg</span>
                      <span className="stat-count">{count} votes</span>
                    </div>
                    <div className="comic-actions">
                      {!isActive ? (
                        <button className="btn-activate" onClick={() => activateComic(comic)}>
                          Open Voting
                        </button>
                      ) : (
                        <button className="btn-deactivate" onClick={deactivateAll}>
                          Close
                        </button>
                      )}
                      <button className="btn-delete" onClick={() => deleteComic(comic.id)}>✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {comics.filter(c => c.has_performed).length > 0 && (
          <div className="section">
            <h2 className="section-title">🏆 Leaderboard</h2>
            <div className="comic-list">
              {comics
                .filter(c => c.has_performed)
                .map(c => ({ ...c, ...getComicStats(c.id) }))
                .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg))
                .map((comic, index) => (
                  <div key={comic.id} className={`comic-row performed ${index === 0 ? 'leader' : ''}`}>
                    <span className="rank">#{index + 1}</span>
                    <div className="comic-info">
                      <span className="comic-name">{comic.name}</span>
                    </div>
                    <div className="comic-stats">
                      <span className="stat">{comic.avg} avg</span>
                      <span className="stat-count">{comic.count} votes</span>
                    </div>
                    <button className="btn-delete" onClick={() => deleteComic(comic.id)}>✕</button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!confirmClear ? (
          <button className="btn-clear" onClick={() => setConfirmClear(true)}>Clear Night & Start Fresh</button>
        ) : (
          <div className="confirm-row">
            <span className="confirm-text">Are you sure? This clears everything.</span>
            <button className="btn-confirm-yes" onClick={clearNight}>Yes, Clear</button>
            <button className="btn-confirm-no" onClick={() => setConfirmClear(false)}>Cancel</button>
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
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .header { text-align: center; margin-bottom: 0.5rem; }
        .logo-img { width: 140px; height: auto; }
        .tagline { color: #555; font-size: 0.8rem; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 0.5rem; }
        .winner-banner {
          background: linear-gradient(135deg, rgba(255,170,0,0.15), rgba(255,119,0,0.1));
          border: 1px solid rgba(255,170,0,0.3);
          border-radius: 0.75rem;
          padding: 1rem 1.25rem;
          font-size: 0.95rem;
          color: #ffaa00;
        }
        .active-banner {
          background: rgba(255,170,0,0.1);
          border: 1px solid rgba(255,170,0,0.3);
          border-radius: 0.75rem;
          padding: 1rem 1.25rem;
          font-size: 0.95rem;
          color: #ffaa00;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .close-btn {
          background: rgba(255,170,0,0.2);
          border: 1px solid rgba(255,170,0,0.4);
          color: #ffaa00;
          padding: 0.3rem 0.75rem;
          border-radius: 0.4rem;
          cursor: pointer;
          font-size: 0.8rem;
          font-family: 'DM Sans', sans-serif;
        }
        .section {
          background: #141414;
          border: 1px solid #222;
          border-radius: 1rem;
          padding: 1.5rem;
        }
        .section-title {
          font-family: 'Bangers', cursive;
          font-size: 1.1rem;
          letter-spacing: 0.08em;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }
        .add-row { display: flex; gap: 0.75rem; }
        .input {
          flex: 1;
          background: #1e1e1e;
          border: 1px solid #2a2a2a;
          border-radius: 0.6rem;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          padding: 0.65rem 1rem;
          outline: none;
        }
        .input:focus { border-color: #ffaa00; }
        .btn-primary {
          background: linear-gradient(135deg, #ffaa00, #ff7700);
          border: none;
          border-radius: 0.6rem;
          color: #000;
          font-family: 'Bangers', cursive;
          font-size: 1rem;
          padding: 0.65rem 1.25rem;
          cursor: pointer;
          letter-spacing: 0.05em;
        }
        .empty { color: #444; font-size: 0.9rem; text-align: center; padding: 1rem; }
        .comic-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .comic-row {
          background: #1a1a1a;
          border: 1px solid #252525;
          border-radius: 0.75rem;
          padding: 0.85rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: border-color 0.2s;
          cursor: grab;
        }
        .comic-row:active { cursor: grabbing; }
        .comic-row.performed { opacity: 0.8; cursor: default; }
        .comic-row.leader { border-color: #ffaa00; background: rgba(255,170,0,0.08); opacity: 1; }
        .rank { font-family: 'Bangers', cursive; font-size: 1.1rem; color: #ffaa00; min-width: 1.8rem; }
        .comic-row.active { border-color: #ffaa00; background: rgba(255,170,0,0.05); }
        .comic-info { display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0; }
        .comic-number { color: #444; font-size: 0.8rem; min-width: 1.2rem; }
        .comic-name { font-weight: 500; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .live-badge {
          background: #ffaa00;
          color: #000;
          font-size: 0.6rem;
          font-family: 'Bangers', cursive;
          letter-spacing: 0.1em;
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
        }
        .comic-stats { display: flex; flex-direction: column; align-items: flex-end; min-width: 60px; }
        .stat { font-family: 'Bangers', cursive; font-size: 1rem; color: #ffaa00; }
        .stat-count { font-size: 0.7rem; color: #555; }
        .comic-actions { display: flex; gap: 0.4rem; align-items: center; }
        .btn-activate {
          background: rgba(255,170,0,0.15);
          border: 1px solid rgba(255,170,0,0.3);
          color: #ffaa00;
          border-radius: 0.5rem;
          padding: 0.35rem 0.7rem;
          font-size: 0.75rem;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          white-space: nowrap;
        }
        .btn-activate:hover { background: rgba(255,170,0,0.25); }
        .btn-deactivate {
          background: rgba(255,170,0,0.3);
          border: 1px solid #ffaa00;
          color: #ffaa00;
          border-radius: 0.5rem;
          padding: 0.35rem 0.7rem;
          font-size: 0.75rem;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        }
        .btn-delete {
          background: #1e1e1e;
          border: 1px solid #2a2a2a;
          color: #555;
          border-radius: 0.5rem;
          padding: 0.35rem 0.5rem;
          font-size: 0.75rem;
          cursor: pointer;
        }
        .btn-delete:hover { color: #ffaa00; border-color: #ffaa00; }
        .btn-clear {
          background: transparent;
          border: 1px solid #2a2a2a;
          color: #444;
          border-radius: 0.75rem;
          padding: 0.75rem;
          font-size: 0.8rem;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          width: 100%;
          transition: all 0.2s;
        }
        .confirm-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: #141414;
          border: 1px solid #ff3c00;
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
        }
        .confirm-text { flex: 1; font-size: 0.85rem; color: #ff3c00; }
        .btn-confirm-yes {
          background: #ff3c00;
          border: none;
          border-radius: 0.5rem;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem;
          padding: 0.4rem 0.9rem;
          cursor: pointer;
        }
        .btn-confirm-no {
          background: #1e1e1e;
          border: 1px solid #2a2a2a;
          border-radius: 0.5rem;
          color: #aaa;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem;
          padding: 0.4rem 0.9rem;
          cursor: pointer;
        }
      `}</style>
    </>
  )
}
