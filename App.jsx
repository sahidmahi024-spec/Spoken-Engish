import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LESSONS } from '../lessons.js'
import { STR } from '../i18n.js'
import { addAttempt, loadProgress, saveProgress, clearProgress, exportCSV } from '../utils.js'
import { MotionConfig } from 'framer-motion'
import { Mic, Square, Volume2, MessageCircle, Wand2, BookOpen, Settings, RefreshCw, Send, Brain, BarChart3 } from 'lucide-react'

const SYSTEM_PROMPT = `You are a friendly Spoken English coach. Keep replies under 80 words.
Assess the learner's last utterance for pronunciation (approx from text), grammar, vocabulary, and fluency.
Give 1-2 corrections, 1 sentence of praise, and a short rewrite in natural English. End with a follow-up question.`

function levenshtein(a, b) { const m=a.length,n=b.length; const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0)); for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j; for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ const cost=a[i-1]===b[j-1]?0:1; dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost) } } return dp[m][n] }
function tokenize(s){ return (s||'').toLowerCase().replace(/[^a-z\s']/g,' ').split(/\s+/).filter(Boolean) }
function similarityScore(target, said){ const t=tokenize(target), s=tokenize(said); if(!t.length||!s.length) return 0; const d=levenshtein(t,s), maxLen=Math.max(t.length,s.length); const wordSim=1-d/maxLen; const setT=new Set(t); const overlap=s.filter(w=>setT.has(w)).length/maxLen; return Math.max(0, Math.min(1, 0.6*wordSim+0.4*overlap)) }
function wpm(text, ms){ const words=tokenize(text).length; const minutes=Math.max(ms/60000,1e-6); return words/minutes }
async function callOpenAI({ apiKey, messages, model = 'gpt-4o-mini' }){
  const res = await fetch('https://api.openai.com/v1/chat/completions', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` }, body: JSON.stringify({ model, messages, temperature:0.4 }) })
  if(!res.ok) throw new Error(await res.text()); const data = await res.json(); return data.choices?.[0]?.message?.content?.trim() || ''
}

function Dashboard({ lang, tabFilter, levelFilter, onFilterTab, onFilterLevel }){
  const STRS = STR[lang]; const rows = loadProgress().slice().reverse()
  const filtered = rows.filter(r => (!tabFilter || r.tab===tabFilter) && (!levelFilter || r.level===levelFilter))
  const avg = (k) => filtered.length ? Math.round(filtered.reduce((s,r)=>s+(r[k]||0),0)/filtered.length) : 0
  return (
    <div className="card">
      <div className="title"><BarChart3 size={18}/> {STRS.dashboardTitle}</div>
      <div className="grid3" style={{marginBottom:10}}>
        <div>
          <div className="muted">{STRS.filter}</div>
          <div className="lang" style={{gap:8}}>
            <select className="pill" value={tabFilter} onChange={e=>onFilterTab(e.target.value)}>
              <option value="">{STRS.lesson}</option>
              <option value="Phrases">{STR.phrases}</option>
              <option value="Situations">{STR.situations}</option>
              <option value="Free Talk">{STR.freeTalk}</option>
              <option value="CEFR">{STR.cefr}</option>
            </select>
            <select className="pill" value={levelFilter} onChange={e=>onFilterLevel(e.target.value)}>
              <option value="">{STRS.level}</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
            </select>
          </div>
        </div>
        <div>
          <div className="muted">{STRS.avg}</div>
          <div className="grid3">
            <div className="score"><Volume2 size={16}/> {STRS.pronunciation} <span className="val" style={{marginLeft:'auto'}}>{avg('pronunciation')}/100</span></div>
            <div className="score"><MessageCircle size={16}/> {STRS.fluency} <span className="val" style={{marginLeft:'auto'}}>{avg('fluency')}/100</span></div>
            <div className="score"><Brain size={16}/> {STRS.overall} <span className="val" style={{marginLeft:'auto'}}>{avg('overall')}/100</span></div>
          </div>
        </div>
        <div className="lang" style={{justifyContent:'flex-end'}}>
          <button className="btn" onClick={exportCSV}>{STRS.exportCsv}</button>
          <button className="btn warn" onClick={()=>{ if(confirm('Clear ALL saved progress?')) { clearProgress(); location.reload() } }}>{STRS.clearAll}</button>
        </div>
      </div>
      <div className="muted" style={{marginBottom:6}}>{STRS.attempts}: {filtered.length}</div>
      <div style={{maxHeight: '340px', overflow: 'auto'}}>
        <table>
          <thead>
            <tr>
              <th>Time</th><th>Tab</th><th>Level</th><th>Target</th><th className="right">{STRS.pronunciation}</th><th className="right">{STRS.grammar}</th><th className="right">{STRS.fluency}</th><th className="right">{STRS.overall}</th><th className="right">{STRS.speed}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r,i)=>(
              <tr key={i}>
                <td>{new Date(r.timestamp).toLocaleString()}</td>
                <td>{r.tab}</td>
                <td>{r.level||''}</td>
                <td style={{maxWidth:280, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={r.target}>{r.target}</td>
                <td className="right">{r.pronunciation}</td>
                <td className="right">{r.grammar}</td>
                <td className="right">{r.fluency}</td>
                <td className="right">{r.overall}</td>
                <td className="right">{r.wpm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function App(){
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'en')
  const STRS = STR[lang]
  useEffect(()=>localStorage.setItem('lang', lang), [lang])

  const [tabApp, setTabApp] = useState('Learn') // Learn | Dashboard
  const [tab, setTab] = useState('Phrases')
  const [level, setLevel] = useState('A1')
  const [index, setIndex] = useState(0)
  const lessonList = tab === 'CEFR' ? LESSONS.cefr[level] : LESSONS[tab === 'Phrases' ? 'phrases' : tab === 'Situations' ? 'situations' : 'freeTalk']
  const [target, setTarget] = useState(lessonList[0])
  useEffect(()=>{ setIndex(0); setTarget(lessonList[0]) }, [tab, level])

  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [history, setHistory] = useState([])
  const [feedback, setFeedback] = useState('')
  const [score, setScore] = useState(null)
  const [apiKey, setApiKey] = useState(localStorage.getItem('ai_key') || '')
  const [model, setModel] = useState(localStorage.getItem('ai_model') || 'gpt-4o-mini')
  const [voiceName, setVoiceName] = useState(localStorage.getItem('ai_voice') || '')
  const [settingsOpen, setSettingsOpen] = useState(false)
  useEffect(()=>localStorage.setItem('ai_key', apiKey),[apiKey])
  useEffect(()=>localStorage.setItem('ai_model', model),[model])
  useEffect(()=>localStorage.setItem('ai_voice', voiceName),[voiceName])

  const recRef = useRef(null); const startTimeRef = useRef(0)

  useEffect(()=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if(!SR) return
    const rec = new SR(); rec.lang='en-US'; rec.interimResults=true; rec.continuous=true
    rec.onresult = (e)=>{ let finalText=''; for(let i=e.resultIndex;i<e.results.length;i++){ const r=e.results[i]; if(r.isFinal) finalText += r[0].transcript + ' ' } if(finalText) setTranscript(prev=> (prev + ' ' + finalText).trim()) }
    rec.onend = ()=>{ setListening(false); if(startTimeRef.current){ const duration=Date.now()-startTimeRef.current; computeScores(duration); startTimeRef.current=0 } }
    recRef.current = rec; return ()=>rec.stop()
  }, [])

  function toggleListen(){ const rec=recRef.current; if(!rec){ alert('Speech Recognition not supported in this browser.'); return } if(listening){ rec.stop(); setListening(false) } else { setTranscript(''); startTimeRef.current=Date.now(); rec.start(); setListening(true) } }
  function speak(text){ const synth=window.speechSynthesis; if(!synth) return; const utter=new SpeechSynthesisUtterance(text); if(voiceName){ const v=synth.getVoices().find(x=>x.name===voiceName); if(v) utter.voice=v } synth.cancel(); synth.speak(utter) }

  function nextPrompt(){ const next=(index+1)%lessonList.length; setIndex(next); setTarget(lessonList[next]); setTranscript(''); setFeedback(''); setScore(null) }
  function computeScores(durationMs){ const pron=similarityScore(target, transcript); const grammarPenalty=/(am|is|are|was|were) not\b|double negative|didn't knew|I am agree|he don't|she don't|I didn't went/i.test(transcript)?0.15:0; const fluencyWpm=wpm(transcript, durationMs); const fluency=Math.max(0, Math.min(1, (Math.min(fluencyWpm, 140)-60)/80)); const grammar=Math.max(0, Math.min(1, pron-grammarPenalty)); const overall=Math.round(((pron*0.45 + grammar*0.25 + fluency*0.30) * 100)); const sc={pronunciation:Math.round(pron*100), grammar:Math.round(grammar*100), fluency:Math.round(fluency*100), overall, wpm:Math.round(fluencyWpm)}; setScore(sc); const attempt={ timestamp: Date.now(), tab, level: tab==='CEFR'?level:'', target, ...sc }; addAttempt(attempt) }

  async function getFeedback(){ const userUtter = transcript || '(no speech captured)'; const base = `Target: ${target}\nLearner: ${userUtter}`; setHistory(h=>[...h, {role:'user', content:userUtter}]); if(apiKey){ try{ const content=await callOpenAI({ apiKey, model, messages:[{role:'system', content:SYSTEM_PROMPT}, ...history, {role:'user', content:base}] }); setFeedback(content); setHistory(h=>[...h, {role:'assistant', content}]); return }catch(e){ setFeedback('(OpenAI error) Falling back to local coach.\n'+String(e)) } } const sim=similarityScore(target, userUtter); const tips=[]; if(sim<0.5) tips.push('Try to match the key words from the target sentence.'); if(/\bain't\b|gonna\b|wanna\b/i.test(userUtter)) tips.push("Use standard forms: 'going to', 'want to'."); if(/\bhe don't\b|she don't\b|I doesn't\b/i.test(userUtter)) tips.push("Use 'doesn't' for he/she/it."); if(userUtter.split(/\s+/).length<5) tips.push('Speak in full sentences.'); const rewrite = sim>0.7 ? 'Great! Your version is close to native.' : `Try: "${target}"`; const fb = ['Local Coach Feedback:', `• Similarity to target: ${(sim*100).toFixed(0)}%`, tips.length?`• Tip: ${tips.join(' ')}`:'• Good job! Keep going.', `• Natural phrasing: ${rewrite}`, 'Question: Can you say it again with a different detail?'].join('\n'); setFeedback(fb) }

  // Dashboard filters
  const [tabFilter, setTabFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')

  // Chat state for Learn tab
  const [draft, setDraft] = useState(''); const [loading, setLoading] = useState(false)
  async function sendChat(){ const content=draft.trim(); if(!content) return; setDraft(''); setHistory(h=>[...h,{role:'user',content}]); if(!apiKey){ const reply=smallTalk(content); setHistory(h=>[...h,{role:'assistant',content:reply}]); return } setLoading(true); try{ const out=await callOpenAI({ apiKey, model, messages:[{role:'system',content:SYSTEM_PROMPT}, ...history, {role:'user',content}] }); setHistory(h=>[...h, {role:'assistant', content: out}]) } catch(e){ setHistory(h=>[...h, {role:'assistant', content: '(OpenAI error) '+String(e)}]) } finally { setLoading(false) } }
  function smallTalk(input){ const s=input.toLowerCase(); if(/(hello|hi|hey)/.test(s)) return "Hello! Let's practice speaking. Tell me about your day in 2-3 sentences."; if(/how are you/.test(s)) return "I'm great and ready to help you learn. How are you feeling today?"; if(/your name/.test(s)) return "I'm your AI English coach. Ask me for pronunciation or grammar tips!"; if(/pronunciation/.test(s)) return "Tip: Compare your recording with the model sentence. Stress content words; weaken function words."; if(/grammar/.test(s)) return "Grammar tip: For habits, use Present Simple: 'I go to school every day.' Not 'I am go.'"; return "Nice! Can you add one more detail using 'because' or 'so'?" }

  return (
    <MotionConfig>
      <div className="container">
        <div className="header">
          <div className="lang" style={{gap:10}}>
            <span className="badge"><Brain size={16}/> {STRS.appTitle}</span>
            <span className="mini">{STRS.browserOnly}</span>
          </div>
          <div className="lang">
            <select className="pill" value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </select>
            <button className="btn" onClick={()=>setSettingsOpen(s=>!s)}><Settings size={16}/> {STRS.settings}</button>
          </div>
        </div>

        <div className="tabs" style={{marginBottom:12}}>
          <div className={'tab ' + (tabApp==='Learn'?'active':'')} onClick={()=>setTabApp('Learn')}>{STRS.tabs_learn}</div>
          <div className={'tab ' + (tabApp==='Dashboard'?'active':'')} onClick={()=>setTabApp('Dashboard')}>{STRS.tabs_dashboard}</div>
        </div>

        {settingsOpen && (
          <div className="card" style={{marginBottom:12}}>
            <div className="grid3">
              <div>
                <div className="mini">{STRS.openaiKey}</div>
                <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-..." />
                <div className="hint">{STRS.storedLocally}</div>
              </div>
              <div>
                <div className="mini">{STRS.model}</div>
                <select value={model} onChange={e=>setModel(e.target.value)}>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4o-realtime-preview">gpt-4o-realtime-preview</option>
                </select>
              </div>
              <div>
                <div className="mini">{STRS.voice}</div>
                <select value={voiceName} onChange={e=>setVoiceName(e.target.value)}>
                  <option value="">{STRS.voice}</option>
                  {(window.speechSynthesis?.getVoices()||[]).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {tabApp==='Learn' ? (
          <div className="grid2">
            <div className="card">
              <div className="title"><BookOpen size={18}/> {STRS.lesson}</div>
              <div className="tabs" style={{marginBottom:8}}>
                <button className={'btn ' + (tab==='Phrases'?'accent':'')} onClick={()=>setTab('Phrases')}>{STRS.phrases}</button>
                <button className={'btn ' + (tab==='Situations'?'accent':'')} onClick={()=>setTab('Situations')}>{STRS.situations}</button>
                <button className={'btn ' + (tab==='Free Talk'?'accent':'')} onClick={()=>setTab('Free Talk')}>{STRS.freeTalk}</button>
                <button className={'btn ' + (tab==='CEFR'?'accent':'')} onClick={()=>setTab('CEFR')}>{STRS.cefr}</button>
                {tab==='CEFR' && (
                  <select className="pill" value={level} onChange={e=>setLevel(e.target.value)}>
                    <option value="A1">A1</option><option value="A2">A2</option><option value="B1">B1</option><option value="B2">B2</option>
                  </select>
                )}
              </div>
              <div className="target">
                <div className="mini">{STRS.practiceTarget}</div>
                <div style={{fontWeight:600}}>{target}</div>
              </div>
              <div className="tabs" style={{marginTop:10}}>
                <button className="btn" onClick={()=>speak(target)}><Volume2 size={16}/> {STRS.hear}</button>
                <button className="btn" onClick={nextPrompt}><RefreshCw size={16}/> {STRS.next}</button>
              </div>

              <div className="title" style={{marginTop:16}}><MessageCircle size={18}/> {STRS.speak}</div>
              <div className="tabs">
                <button className="btn accent" onClick={toggleListen}>{listening ? <><Square size={16}/> {STRS.stop}</> : <><Mic size={16}/> {STRS.start}</>}</button>
                <button className="btn" onClick={()=>{ setTranscript(''); setScore(null); setFeedback(''); }}>{STRS.clear}</button>
              </div>
              <div className="mini" style={{marginTop:8}}>{STRS.yourSpeech}</div>
              <textarea rows="6" value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="Your speech will appear here..." />
              <button className="btn" style={{width:'100%', marginTop:8}} onClick={getFeedback}><Wand2 size={16}/> {STRS.getFeedback}</button>
            </div>

            <div className="card">
              <div className="title"><Wand2 size={18}/> {STRS.feedback}</div>
              <textarea rows="10" value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Press Get Feedback after speaking..." />
              <div className="tabs" style={{justifyContent:'flex-end', marginTop:8}}>
                <button className="btn" onClick={()=>window.speechSynthesis && speak(feedback)}><Volume2 size={16}/> {STRS.readFeedback}</button>
              </div>

              <div className="title" style={{marginTop:8}}><Brain size={18}/> {STRS.scores}</div>
              {score ? (
                <div className="grid3">
                  <div className="score"><Volume2 size={16}/> <span>{STRS.pronunciation}</span> <span className="val" style={{marginLeft:'auto'}}>{score.pronunciation}/100</span></div>
                  <div className="score"><BookOpen size={16}/> <span>{STRS.grammar}</span> <span className="val" style={{marginLeft:'auto'}}>{score.grammar}/100</span></div>
                  <div className="score"><MessageCircle size={16}/> <span>{STRS.fluency}</span> <span className="val" style={{marginLeft:'auto'}}>{score.fluency}/100</span></div>
                  <div className="score"><Brain size={16}/> <span>{STRS.overall}</span> <span className="val" style={{marginLeft:'auto'}}>{score.overall}/100</span></div>
                  <div className="score"><Send size={16}/> <span>{STRS.speed}</span> <span className="val" style={{marginLeft:'auto'}}>{score.wpm} wpm</span></div>
                </div>
              ) : <div className="muted">{STRS.noMessages}</div>}

              <div className="title" style={{marginTop:12}}><MessageCircle size={18}/> {STRS.chat}</div>
              <div className="chatbox">
                {history.length===0 ? <div className="muted">{STRS.noMessages}</div> :
                  history.map((m,i)=>(
                    <div key={i} className={'bubble ' + (m.role==='user'?'you':'ai')}>
                      <div className="mini muted" style={{marginBottom:4}}>{m.role}</div>
                      <div style={{whiteSpace:'pre-wrap'}}>{m.content}</div>
                    </div>
                  ))
                }
              </div>
              <div className="tabs" style={{marginTop:8}}>
                <input style={{flex:1}} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={STR.typeToChat} onKeyDown={e=>{ if(e.key==='Enter') sendChat() }} />
                <button className="btn" onClick={sendChat}><Send size={16}/> {STR.send}</button>
              </div>
            </div>
          </div>
        ) : (
          <Dashboard lang={lang} tabFilter={tabFilter} levelFilter={levelFilter} onFilterTab={setTabFilter} onFilterLevel={setLevelFilter} />
        )}

        <div className="muted" style={{textAlign:'center', marginTop:16}}>{STR.tipMicBn}</div>
      </div>
    </MotionConfig>
  )
}
