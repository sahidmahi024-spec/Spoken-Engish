export const STORAGE_KEY = 'tutor_progress_v1'
export function loadProgress(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') }catch(_){ return [] } }
export function saveProgress(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list||[])) }
export function addAttempt(a){ const all = loadProgress(); all.push(a); saveProgress(all); }
export function clearProgress(){ localStorage.removeItem(STORAGE_KEY) }
export function exportCSV(){
  const rows = loadProgress()
  const header = ['timestamp','tab','level','target','pronunciation','grammar','fluency','overall','wpm']
  const lines = [header.join(',')]
  for(const r of rows){
    // escape double quotes
    const target = (r.target || '').replace(/"/g, '""')
    lines.push([r.timestamp,r.tab||'',r.level||'',`"${target}"`,r.pronunciation,r.grammar,r.fluency,r.overall,r.wpm].join(','))
  }
  const blob = new Blob([lines.join('\n')], {type:'text/csv'})
  const url = URL.createObjectURL(blob)
  const a=document.createElement('a'); a.href=url; a.download='spoken_english_progress.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000)
}
