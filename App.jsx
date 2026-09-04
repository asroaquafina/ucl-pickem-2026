import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
const PLAYERS = ['Emi', 'Darius', 'Fane', 'Andrei', 'Narcis']
const CLUBS = [
  'AEK Athens','LASK','Club Brugge','Aston Villa','Borussia Dortmund','Villarreal',
  'Porto','Manchester City','Lille','Real Betis','Real Madrid','Inter','Barcelona',
  'Feyenoord','Stuttgart','Viking','Liverpool','Atlético de Madrid','Paris Saint-Germain',
  'Slovan Bratislava','Sporting CP','Galatasaray','Napoli','Arsenal','Fenerbahçe','Roma',
  'PSV Eindhoven','Shakhtar Donetsk','Como','Leipzig','Bayern München','Bodø/Glimt',
  'Manchester United','Sabah','Slavia Praha','Lens'
]

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [fixtures, setFixtures] = useState([])
  const [predictions, setPredictions] = useState([])
  const [seasonPick, setSeasonPick] = useState({ ucl_winner: '', league_winner: '' })
  const [profiles, setProfiles] = useState([])
  const [tab, setTab] = useState('home')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) setProfile(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadApp()
  }, [session])

  async function loadApp() {
    setStatus('')
    const [{ data: s }, { data: fs }, { data: ps }, { data: sp }, { data: allProfiles }] =
      await Promise.all([
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('fixtures').select('*').order('matchday').order('date').order('kickoff'),
        supabase.from('predictions').select('*').eq('user_id', session.user.id),
        supabase.from('season_picks').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('profiles').select('*').order('name')
      ])
    setSettings(s || null)
    setFixtures(fs || [])
    setPredictions(ps || [])
    if (sp) setSeasonPick({ ucl_winner: sp.ucl_winner || '', league_winner: sp.league_winner || '' })
    setProfiles(allProfiles || [])
    const { data: me } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    setProfile(me || null)
  }

  async function sendMagicLink(e) {
    e.preventDefault()
    setStatus('Sending login link...')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    setStatus(error ? error.message : 'Check your email for the login link.')
  }

  async function claimName(e) {
    e.preventDefault()
    setStatus('Claiming player name...')
    const { data, error } = await supabase.rpc('claim_player_name', { p_name: name })
    if (error) setStatus(error.message)
    else { setProfile(data); setStatus('Player name saved.'); await loadApp() }
  }

  async function saveSeason() {
    setStatus('Saving...')
    const { error } = await supabase.from('season_picks').upsert({
      user_id: session.user.id,
      ucl_winner: seasonPick.ucl_winner || null,
      league_winner: seasonPick.league_winner || null,
      updated_at: new Date().toISOString()
    })
    setStatus(error ? error.message : 'Season picks saved.')
  }

  async function pick(fixtureId, value) {
    setStatus('')
    const { error } = await supabase.rpc('submit_prediction', {
      p_fixture_id: fixtureId,
      p_pick: value
    })
    if (error) setStatus(error.message)
    else {
      setPredictions(prev => {
        const without = prev.filter(p => p.fixture_id !== fixtureId)
        return [...without, { user_id: session.user.id, fixture_id: fixtureId, pick: value }]
      })
    }
  }

  async function updateSettings(patch) {
    const { error } = await supabase.from('settings').update(patch).eq('id', 1)
    if (error) setStatus(error.message)
    else await loadApp()
  }

  const currentFixtures = useMemo(
    () => fixtures.filter(f => f.matchday === settings?.current_matchday),
    [fixtures, settings]
  )

  const myPick = id => predictions.find(p => p.fixture_id === id)?.pick

  if (loading) return <div className="center"><div className="card">Loading…</div></div>

  if (!session) return (
    <div className="center">
      <div className="login card">
        <div className="logo">⚽</div>
        <h1>UCL Pick'em</h1>
        <p>Champions League 2026/27</p>
        <form onSubmit={sendMagicLink}>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Your email" required />
          <button>Send login link</button>
        </form>
        {status && <div className="notice">{status}</div>}
      </div>
    </div>
  )

  if (!profile) return (
    <div className="center">
      <div className="login card">
        <h1>Choose your player</h1>
        <p>Select one of the five names for your account.</p>
        <form onSubmit={claimName}>
          <select value={name} onChange={e => setName(e.target.value)} required>
            <option value="">Select player…</option>
            {PLAYERS.map(p => <option key={p}>{p}</option>)}
          </select>
          <button>Join Pick'em</button>
        </form>
        {status && <div className="notice">{status}</div>}
      </div>
    </div>
  )

  return (
    <div className="app">
      <header>
        <div>
          <div className="eyebrow">UEFA Champions League</div>
          <h1>Pick'em <span>2026/27</span></h1>
        </div>
        <div className="userbox">
          <b>{profile.name}</b>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <nav>
        {[
          ['home','Home'],['season','Season'],['picks','Matchday'],['leaderboard','Leaderboard'],
          ...(profile.is_admin ? [['admin','Admin']] : [])
        ].map(([key,label]) =>
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        )}
      </nav>

      {status && <div className="toast">{status}</div>}

      <main>
        {tab === 'home' && <Home settings={settings} profile={profile} fixtures={fixtures} setTab={setTab} />}
        {tab === 'season' && (
          <section className="card">
            <h2>Season picks</h2>
            <p className="muted">Choose your Champions League winner and League Phase winner.</p>
            <label>UCL winner<select value={seasonPick.ucl_winner} onChange={e => setSeasonPick({...seasonPick,ucl_winner:e.target.value})}>
              <option value="">Choose a club…</option>{CLUBS.map(c => <option key={c}>{c}</option>)}
            </select></label>
            <label>League Phase winner<select value={seasonPick.league_winner} onChange={e => setSeasonPick({...seasonPick,league_winner:e.target.value})}>
              <option value="">Choose a club…</option>{CLUBS.map(c => <option key={c}>{c}</option>)}
            </select></label>
            <button onClick={saveSeason}>Save season picks</button>
          </section>
        )}
        {tab === 'picks' && (
          <section>
            <div className="sectionhead">
              <div><h2>Matchday {settings?.current_matchday}</h2><p className="muted">{settings?.picks_open ? 'Picks are OPEN' : 'Picks are CLOSED'}</p></div>
              <span className={settings?.picks_open ? 'pill open' : 'pill'}>{settings?.picks_open ? 'OPEN' : 'LOCKED'}</span>
            </div>
            {!currentFixtures.length && <div className="card">No fixtures loaded for this matchday yet.</div>}
            <div className="fixtures">
              {currentFixtures.map(f => <Fixture key={f.id} fixture={f} value={myPick(f.id)} disabled={!settings?.picks_open} onPick={pick} />)}
            </div>
          </section>
        )}
        {tab === 'leaderboard' && <Leaderboard profiles={profiles} predictions={predictions} fixtures={fixtures} />}
        {tab === 'admin' && profile.is_admin && (
          <Admin settings={settings} updateSettings={updateSettings} fixtures={fixtures} />
        )}
      </main>
    </div>
  )
}

function Home({settings, profile, fixtures, setTab}) {
  const total = fixtures.filter(f => f.matchday === settings?.current_matchday).length
  return <section className="grid">
    <div className="hero card">
      <div className="eyebrow">WELCOME BACK</div>
      <h2>Good luck, {profile.name}.</h2>
      <p>Make your predictions, climb the leaderboard and win the Pick'em.</p>
      <button onClick={() => setTab('picks')}>Open Matchday {settings?.current_matchday}</button>
    </div>
    <div className="card stat"><span>Current matchday</span><strong>{settings?.current_matchday || '—'}</strong><small>{total} fixtures loaded</small></div>
    <div className="card stat"><span>Status</span><strong>{settings?.picks_open ? 'OPEN' : 'LOCKED'}</strong><small>Controlled by admin</small></div>
  </section>
}

function Fixture({fixture, value, disabled, onPick}) {
  return <div className="fixture card">
    <div className="fixturetop"><span>{new Date(fixture.date+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span><span>{fixture.kickoff.slice(0,5)}</span></div>
    <div className="teams"><b>{fixture.home}</b><span>vs</span><b>{fixture.away}</b></div>
    <div className="picks">
      {[['H','1'],['D','X'],['A','2']].map(([v,label]) =>
        <button disabled={disabled} key={v} className={value === v ? 'selected' : ''} onClick={() => onPick(fixture.id,v)}>{label}</button>
      )}
    </div>
  </div>
}

function Leaderboard({profiles, predictions, fixtures}) {
  const rows = profiles.map(p => {
    const count = predictions.filter(x => x.user_id === p.id).length
    return {...p,count}
  }).sort((a,b)=>b.count-a.count)
  return <section className="card"><h2>Leaderboard</h2><p className="muted">Live prediction totals. Scoring rules can be added once finalized.</p>
    <div className="table">{rows.map((r,i)=><div className="row" key={r.id}><span>#{i+1}</span><b>{r.name}</b><span>{r.count} picks</span></div>)}</div>
  </section>
}

function Admin({settings, updateSettings, fixtures}) {
  return <section className="grid">
    <div className="card">
      <h2>Admin controls</h2>
      <label>Current matchday
        <select value={settings?.current_matchday || 1} onChange={e=>updateSettings({current_matchday:Number(e.target.value)})}>
          {[1,2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}
        </select>
      </label>
      <button onClick={()=>updateSettings({picks_open:!settings.picks_open)}>
        {settings.picks_open ? 'Close picks' : 'Open picks'}
      </button>
    </div>
    <div className="card stat"><span>Fixtures in database</span><strong>{fixtures.length}</strong><small>144 expected for the full league phase</small></div>
  </section>
}

export default App