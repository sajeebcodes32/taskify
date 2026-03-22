'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import s from './page.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'urgent' | 'high' | 'medium' | 'low'
type Status   = 'todo' | 'inprogress' | 'done'
type TimerMode = 'focus' | 'short' | 'long'
type View     = 'list' | 'board'
type NavPage  = 'today' | 'all' | 'completed'

interface Subtask { id: string; name: string; done: boolean }
interface Task {
  _id: string; name: string; description: string; status: Status; priority: Priority
  dueDate: string | null; tags: string[]; estimatedMin: number; subtasks: Subtask[]
  notes: string; createdAt: string; completedAt: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PM: Record<Priority,{label:string;color:string;bg:string;icon:string}> = {
  urgent: {label:'Urgent', color:'#ff5f5f', bg:'rgba(255,95,95,0.12)',   icon:'🔴'},
  high:   {label:'High',   color:'#fbbf24', bg:'rgba(251,191,36,0.12)',  icon:'🟠'},
  medium: {label:'Medium', color:'#a78bfa', bg:'rgba(167,139,250,0.12)', icon:'🟡'},
  low:    {label:'Low',    color:'#6b7280', bg:'rgba(107,114,128,0.12)', icon:'🔵'},
}
const SM: Record<Status,{label:string;color:string}> = {
  todo:       {label:'To Do',       color:'#6b7280'},
  inprogress: {label:'In Progress', color:'#a78bfa'},
  done:       {label:'Done',        color:'#4ade80'},
}
const MODE_MINS: Record<TimerMode,number> = { focus:25, short:5, long:15 }
const NAV = [
  {id:'today'    as NavPage, label:'Today',     icon:'☀️'},
  {id:'all'      as NavPage, label:'All Tasks', icon:'📋'},
  {id:'completed'as NavPage, label:'Completed', icon:'✅'},
]

function mkId() { return crypto.randomUUID() }
function fmtTimer(s:number) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
}
function fmtDate(d:string|null) {
  if(!d) return null
  const now=new Date(); now.setHours(0,0,0,0)
  const diff=Math.round((new Date(d).setHours(0,0,0,0)-now.getTime())/86400000)
  if(diff<0)  return {label:'Overdue',  cls:s.dateOverdue}
  if(diff===0) return {label:'Today',   cls:s.dateToday}
  if(diff===1) return {label:'Tomorrow',cls:s.dateNormal}
  return {label:new Date(d).toLocaleDateString('en',{month:'short',day:'numeric'}), cls:s.dateNormal}
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function playChime() {
  try {
    if(typeof window==='undefined') return
    if(localStorage.getItem('taskify_sound')==='off') return
    const ctx=new AudioContext()
    const note=(freq:number,t:number)=>{
      const o=ctx.createOscillator(),g=ctx.createGain()
      o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=freq
      g.gain.setValueAtTime(0,ctx.currentTime+t)
      g.gain.linearRampToValueAtTime(0.28,ctx.currentTime+t+0.005)
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.28)
      o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+0.3)
    }
    note(523.25,0);note(659.25,0.15)
  } catch{}
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
type ConfettiFn = (opts: Record<string,unknown>) => void
declare global { interface Window { confetti?: ConfettiFn } }
function fireConfetti(x:number,y:number) {
  if(typeof window==='undefined') return
  const run=()=>{
    if(!window.confetti) return
    window.confetti({particleCount:80,spread:360,startVelocity:25,
      origin:{x:x/window.innerWidth,y:y/window.innerHeight},
      colors:['#7c5cfc','#4ade80','#fbbf24','#ff5f5f','#a78bfa'],gravity:0.9,scalar:0.9,ticks:80})
  }
  if(window.confetti){run();return}
  const sc=document.createElement('script')
  sc.src='https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
  sc.onload=run; document.head.appendChild(sc)
}

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastData{id:string;taskName:string;onUndo:()=>void}
function Toast({data,onDismiss}:{data:ToastData;onDismiss:()=>void}) {
  return (
    <div className={s.toast} role="alert">
      <div className={s.toastInner}>
        <span className={s.toastIcon}>✅</span>
        <div className={s.toastText}>
          <p className={s.toastTitle}>Task completed! 🎉</p>
          <p className={s.toastSub}>{data.taskName.slice(0,42)}{data.taskName.length>42?'…':''}</p>
        </div>
        <button className={s.toastUndo} onClick={()=>{data.onUndo();onDismiss()}}>Undo</button>
        <button className={s.toastClose} onClick={onDismiss}>✕</button>
      </div>
      <div className={s.toastBar}/>
    </div>
  )
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({task,onSave,onClose}:{task?:Partial<Task>;onSave:(t:Partial<Task>)=>void;onClose:()=>void}) {
  const [name,setName]         = useState(task?.name||'')
  const [desc,setDesc]         = useState(task?.description||'')
  const [status,setStatus]     = useState<Status>(task?.status||'todo')
  const [priority,setPriority] = useState<Priority>(task?.priority||'medium')
  const [dueDate,setDueDate]   = useState(task?.dueDate?.slice(0,10)||'')
  const [tags,setTags]         = useState<string[]>(task?.tags||[])
  const [tagInput,setTagInput] = useState('')
  const [est,setEst]           = useState(task?.estimatedMin||25)
  const [subtasks,setSubtasks] = useState<Subtask[]>(task?.subtasks||[])
  const [subInput,setSubInput] = useState('')
  const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{ref.current?.focus()},[])
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if(e.key==='Escape') onClose()
      if((e.metaKey||e.ctrlKey)&&e.key==='Enter') save()
    }
    window.addEventListener('keydown',fn)
    return ()=>window.removeEventListener('keydown',fn)
  })
  function save(){
    if(!name.trim()) return
    onSave({name:name.trim(),description:desc,status,priority,dueDate:dueDate||null,tags,estimatedMin:est,subtasks})
    onClose()
  }
  return (
    <div className={s.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={s.modal} role="dialog" aria-modal="true">
        <div className={s.modalTop}>
          <input ref={ref} className={s.modalName} value={name} onChange={e=>setName(e.target.value)} placeholder="Task name…"/>
          <button className={s.modalX} onClick={onClose}>✕</button>
        </div>
        <textarea className={s.modalDesc} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Add a description…" rows={2}/>
        <div className={s.propGrid}>
          {[
            {label:'Status', el:<select className={s.propSel} value={status} onChange={e=>setStatus(e.target.value as Status)}>
              {(Object.keys(SM)as Status[]).map(k=><option key={k} value={k}>{SM[k].label}</option>)}</select>},
            {label:'Priority', el:<select className={s.propSel} value={priority} onChange={e=>setPriority(e.target.value as Priority)}>
              {(Object.keys(PM)as Priority[]).map(k=><option key={k} value={k}>{PM[k].icon} {PM[k].label}</option>)}</select>},
            {label:'Due date', el:<input className={s.propIn} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>},
            {label:'Est. time', el:<div style={{display:'flex',gap:6,alignItems:'center'}}>
              <input className={s.propIn} type="number" min={5} max={480} value={est} onChange={e=>setEst(Number(e.target.value))} style={{width:68}}/>
              <span className={s.propUnit}>min</span></div>},
            {label:'Tags', el:<div className={s.tagWrap}>
              {tags.map(t=><span key={t} className={s.tagChip}>{t}<button onClick={()=>setTags(p=>p.filter(x=>x!==t))}>×</button></span>)}
              <input className={s.tagIn} value={tagInput} onChange={e=>setTagInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){setTags(p=>[...p,tagInput.trim()]);setTagInput('')}}}
                placeholder="Add tag…"/></div>},
          ].map(({label,el})=>(
            <div key={label} className={s.propRow}><span className={s.propLabel}>{label}</span>{el}</div>
          ))}
        </div>
        <div className={s.subSec}>
          <p className={s.subSecLabel}>Sub-tasks</p>
          {subtasks.map(sub=>(
            <div key={sub.id} className={s.subRow}>
              <button className={`${s.subCk} ${sub.done?s.subCkOn:''}`}
                onClick={()=>setSubtasks(p=>p.map(x=>x.id===sub.id?{...x,done:!x.done}:x))}>
                {sub.done&&'✓'}</button>
              <span className={`${s.subTxt} ${sub.done?s.subTxtDone:''}`}>{sub.name}</span>
              <button className={s.subX} onClick={()=>setSubtasks(p=>p.filter(x=>x.id!==sub.id))}>✕</button>
            </div>
          ))}
          <input className={s.subIn} value={subInput} onChange={e=>setSubInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&subInput.trim()){setSubtasks(p=>[...p,{id:mkId(),name:subInput.trim(),done:false}]);setSubInput('')}}}
            placeholder="+ Add sub-task…"/>
        </div>
        <div className={s.modalFoot}>
          <span className={s.hint}>⌘↵ save · Esc close</span>
          <div style={{display:'flex',gap:8}}>
            <button className={s.btnGhost} onClick={onClose}>Cancel</button>
            <button className={s.btnAccent} onClick={save} disabled={!name.trim()}>Save Task</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Task Row (list view) ─────────────────────────────────────────────────────
function TaskRow({task,active,onActivate,onToggle,onEdit,onDelete,onStatus,isNew}:
  {task:Task;active:boolean;onActivate:()=>void;onToggle:(e:React.MouseEvent)=>void;
   onEdit:()=>void;onDelete:()=>void;onStatus:(s:Status)=>void;isNew:boolean}) {
  const [menu,setMenu]=useState(false)
  const menuRef=useRef<HTMLDivElement>(null)
  const dateInfo=fmtDate(task.dueDate); const pm=PM[task.priority]
  useEffect(()=>{
    const fn=(e:MouseEvent)=>{if(!menuRef.current?.contains(e.target as Node))setMenu(false)}
    if(menu)document.addEventListener('mousedown',fn)
    return()=>document.removeEventListener('mousedown',fn)
  },[menu])
  return (
    <div className={`${s.taskRow} ${task.status==='done'?s.taskDone:''} ${active?s.taskActive:''} ${isNew?s.taskNew:''}`}
      onClick={onActivate}>
      <button className={`${s.cb} ${task.status==='done'?s.cbDone:''}`} onClick={e=>{e.stopPropagation();onToggle(e)}}>
        {task.status==='done'&&(
          <svg width="11" height="11" viewBox="0 0 11 11">
            <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="#000" strokeWidth="1.8" fill="none"
              strokeLinecap="round" strokeLinejoin="round" strokeDasharray="20" strokeDashoffset="0" className={s.cbPath}/>
          </svg>
        )}
      </button>
      <span className={s.taskName} onClick={e=>{e.stopPropagation();onEdit()}}>{task.name}</span>
      <div className={s.taskMeta}>
        <span className={`${s.badge} ${task.priority==='urgent'?s.badgePulse:''}`} style={{color:pm.color,background:pm.bg}}>
          {pm.icon} {pm.label}</span>
        {dateInfo&&<span className={`${s.dateBadge} ${dateInfo.cls}`}>{dateInfo.label}</span>}
        {task.tags.slice(0,2).map(t=><span key={t} className={s.tagBadge}>{t}</span>)}
        {task.subtasks.length>0&&<span className={s.subBadge}>{task.subtasks.filter(x=>x.done).length}/{task.subtasks.length}</span>}
        {task.estimatedMin>0&&<span className={s.estBadge}>⏱{task.estimatedMin}m</span>}
      </div>
      <div className={s.rowActions} ref={menuRef}>
        <button className={s.btnDots} onClick={e=>{e.stopPropagation();setMenu(p=>!p)}}>⋯</button>
        {menu&&(
          <div className={s.menu}>
            <button onClick={()=>{onEdit();setMenu(false)}}>✏️ Edit</button>
            <button onClick={()=>{onStatus('inprogress');setMenu(false)}}>▶️ In Progress</button>
            <button onClick={()=>{onStatus('done');setMenu(false)}}>✅ Mark Done</button>
            <div className={s.menuDiv}/>
            <button className={s.menuRed} onClick={()=>{onDelete();setMenu(false)}}>🗑️ Delete</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Board Card ───────────────────────────────────────────────────────────────
function BoardCard({task,onEdit,onDelete,onStatusChange}:
  {task:Task;onEdit:(t:Task)=>void;onDelete:(id:string)=>void;onStatusChange:(id:string,s:Status)=>void}) {
  const pm=PM[task.priority]; const dateInfo=fmtDate(task.dueDate)
  const subsDone=task.subtasks.filter(x=>x.done).length
  return (
    <div className={s.bCard} draggable onDragStart={e=>e.dataTransfer.setData('taskId',task._id)} onClick={()=>onEdit(task)}>
      <div className={s.bCardTop}>
        <span className={`${s.badge} ${task.priority==='urgent'?s.badgePulse:''}`} style={{color:pm.color,background:pm.bg}}>
          {pm.icon} {pm.label}</span>
        <button className={s.bCardX} onClick={e=>{e.stopPropagation();onDelete(task._id)}}>✕</button>
      </div>
      <p className={`${s.bCardTitle} ${task.status==='done'?s.bCardDone:''}`}>{task.name}</p>
      {task.description&&<p className={s.bCardDesc}>{task.description.slice(0,55)}{task.description.length>55?'…':''}</p>}
      <div className={s.bCardMeta}>
        {dateInfo&&<span className={`${s.dateBadge} ${dateInfo.cls}`}>{dateInfo.label}</span>}
        {task.tags.slice(0,2).map(t=><span key={t} className={s.tagBadge}>{t}</span>)}
        {task.estimatedMin>0&&<span className={s.estBadge}>⏱{task.estimatedMin}m</span>}
      </div>
      {task.subtasks.length>0&&(
        <div className={s.bSubBar}><div className={s.bSubFill} style={{width:`${(subsDone/task.subtasks.length)*100}%`}}/></div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return <div className={s.skeleton}>
    {[...Array(4)].map((_,i)=>(
      <div key={i} className={s.skelRow}>
        <div className={s.bone} style={{width:18,height:18,borderRadius:4,flexShrink:0}}/>
        <div className={s.bone} style={{flex:1,height:13,borderRadius:4}}/>
        <div className={s.bone} style={{width:64,height:20,borderRadius:20}}/>
        <div className={s.bone} style={{width:72,height:20,borderRadius:20}}/>
      </div>
    ))}
  </div>
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function Empty({onAdd}:{onAdd:()=>void}) {
  return (
    <div className={s.empty}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <rect x="8" y="16" width="48" height="40" rx="8" fill="rgba(124,92,252,0.08)" stroke="rgba(124,92,252,0.2)" strokeWidth="1.5"/>
        <rect x="16" y="26" width="24" height="2.5" rx="1.25" fill="rgba(255,255,255,0.1)"/>
        <rect x="16" y="32" width="18" height="2.5" rx="1.25" fill="rgba(255,255,255,0.1)"/>
        <rect x="16" y="38" width="21" height="2.5" rx="1.25" fill="rgba(255,255,255,0.1)"/>
        <circle cx="48" cy="18" r="10" fill="#7c5cfc"/>
        <path d="M48 13v10M43 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <h3>No tasks yet</h3>
      <p>Add your first task to start blitzing</p>
      <button className={s.btnAccent} onClick={onAdd}>+ New Task</button>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [tasks,setTasks]         = useState<Task[]>([])
  const [loading,setLoading]     = useState(true)
  const [activeId,setActiveId]   = useState<string|null>(null)
  const [navPage,setNavPage]     = useState<NavPage>('all')
  const [view,setView]           = useState<View>('list')
  const [modal,setModal]         = useState<{open:boolean;task?:Partial<Task>}>({open:false})
  const [toasts,setToasts]       = useState<ToastData[]>([])
  const [collapsed,setCollapsed] = useState<Set<Status>>(new Set())
  const [newIds,setNewIds]       = useState<Set<string>>(new Set())
  const [completingId,setCompletingId] = useState<string|null>(null)
  const [sound,setSound]         = useState(true)
  const [settings,setSettings]   = useState(false)
  const [search,setSearch]       = useState('')
  // Timer state
  const [timerMode,setTimerMode] = useState<TimerMode>('focus')
  const [timerSecs,setTimerSecs] = useState(25*60)
  const [timerTotal,setTimerTotal]= useState(25*60)
  const [running,setRunning]     = useState(false)
  const [blitzing,setBlitzing]   = useState(false)
  const [focusOverlay,setFocusOverlay] = useState(false)
  const [sessionsToday,setSessionsToday] = useState(0)
  const [focusedMin,setFocusedMin]       = useState(0)
  const intervalRef=useRef<ReturnType<typeof setInterval>|null>(null)

  // Load prefs
  useEffect(()=>{
    const snd=localStorage.getItem('taskify_sound'); if(snd==='off')setSound(false)
  },[])
  useEffect(()=>{localStorage.setItem('taskify_sound',sound?'on':'off')},[sound])

  // ⌘K shortcut
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setModal({open:true})}}
    window.addEventListener('keydown',fn); return()=>window.removeEventListener('keydown',fn)
  },[])

  // Timer tick
  useEffect(()=>{
    if(running){
      intervalRef.current=setInterval(()=>{
        setTimerSecs(p=>{
          if(p<=1){
            clearInterval(intervalRef.current!)
            setRunning(false)
            setSessionsToday(n=>n+1)
            setFocusedMin(m=>m+Math.round(timerTotal/60))
            playChime()
            fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({taskId:activeId,type:timerMode,durationMin:Math.round(timerTotal/60),completedFull:true})})
            showToastMsg('🍅 Pomodoro complete! Take a break.')
            return timerTotal
          }
          return p-1
        })
      },1000)
    } else { if(intervalRef.current)clearInterval(intervalRef.current) }
    return()=>{ if(intervalRef.current)clearInterval(intervalRef.current) }
  },[running,activeId,timerMode,timerTotal])

  function showToastMsg(msg:string) {
    const id=mkId()
    setToasts(p=>[...p,{id,taskName:msg,onUndo:()=>{}}])
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),4200)
  }

  function switchMode(m:TimerMode){
    setTimerMode(m); setRunning(false)
    const secs=MODE_MINS[m]*60; setTimerTotal(secs); setTimerSecs(secs)
  }
  function resetTimer(){ setRunning(false); setTimerSecs(timerTotal) }

  function startBlitz(){
    const first=tasks.find(t=>t.status!=='done')
    if(first&&!activeId) setActiveId(first._id)
    setBlitzing(true); setRunning(true); setFocusOverlay(true)
  }
  function endBlitz(){ setBlitzing(false); setRunning(false); setFocusOverlay(false) }

  const fetchTasks=useCallback(async()=>{
    try{const r=await fetch('/api/tasks');const j=await r.json();if(j.success)setTasks(j.data)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{fetchTasks()},[fetchTasks])

  const filtered=tasks.filter(t=>{
    if(search)return t.name.toLowerCase().includes(search.toLowerCase())
    if(navPage==='today')return new Date(t.createdAt).toDateString()===new Date().toDateString()
    if(navPage==='completed')return t.status==='done'
    return true
  })
  const byStatus=(st:Status)=>filtered.filter(t=>t.status===st)

  async function createTask(data:Partial<Task>){
    const r=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:data.name,description:data.description||'',status:data.status||'todo',
        priority:data.priority||'medium',dueDate:data.dueDate||null,tags:data.tags||[],
        estimatedMin:data.estimatedMin||25,subtasks:data.subtasks||[]})})
    const j=await r.json()
    if(j.success){
      setTasks(p=>[j.data,...p])
      setNewIds(p=>new Set([...p,j.data._id]))
      setTimeout(()=>setNewIds(p=>{const n=new Set(p);n.delete(j.data._id);return n}),700)
    }
  }
  async function updateTask(id:string,data:Partial<Task>){
    const r=await fetch(`/api/tasks/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    const j=await r.json(); if(j.success)setTasks(p=>p.map(t=>t._id===id?j.data:t))
  }
  async function deleteTask(id:string){
    await fetch(`/api/tasks/${id}`,{method:'DELETE'})
    setTasks(p=>p.filter(t=>t._id!==id))
    if(activeId===id)setActiveId(null)
  }
  async function toggleTask(id:string,e:React.MouseEvent){
    const task=tasks.find(t=>t._id===id); if(!task) return
    const becomingDone=task.status!=='done'
    if(becomingDone){
      setCompletingId(id); playChime(); fireConfetti(e.clientX,e.clientY)
      setTimeout(()=>setCompletingId(null),600)
      const tid=mkId(); const prev=task.status
      setToasts(p=>[...p,{id:tid,taskName:task.name,onUndo:()=>updateTask(id,{status:prev,completedAt:null})}])
      setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==tid)),4200)
      const remaining=tasks.filter(t=>t.status!=='done'&&t._id!==id)
      if(remaining.length===0) setTimeout(()=>fireConfetti(window.innerWidth/2,window.innerHeight/2),400)
      // Auto-advance active task
      if(activeId===id){ const next=tasks.find(t=>t.status!=='done'&&t._id!==id); setActiveId(next?._id??null) }
    }
    await updateTask(id,{status:becomingDone?'done':'todo',completedAt:becomingDone?new Date().toISOString():null})
  }

  const activeTask=tasks.find(t=>t._id===activeId)
  const progress=timerSecs/timerTotal
  const C=2*Math.PI*52; const ringOffset=C*(1-progress)
  const totalDone=tasks.filter(t=>t.status==='done').length
  const totalAll=tasks.length
  const pct=totalAll?Math.round((totalDone/totalAll)*100):0

  return (
    <div className={s.app}>

      {/* ══ LEFT: BLITZIT TIMER PANEL ══ */}
      <aside className={`${s.left} ${blitzing?s.leftBlitz:''}`}>

        {/* Logo */}
        <div className={s.leftLogo}>
          <span className={s.logoText}>task<strong>ify</strong></span>
          <div className={s.logoBadge}>BETA</div>
        </div>

        {/* Timer */}
        <div className={s.timerBlock}>
          <div className={s.modePills}>
            {(['focus','short','long'] as TimerMode[]).map(m=>(
              <button key={m} className={`${s.pill} ${timerMode===m?s.pillOn:''}`} onClick={()=>switchMode(m)}>
                {m==='focus'?'🍅 Focus':m==='short'?'Short':'Long'}
              </button>
            ))}
          </div>

          {/* Ring clock */}
          <div className={s.clock}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
              <circle cx="60" cy="60" r="52" fill="none"
                stroke={timerSecs<60?'#ff5f5f':blitzing?'#f97316':'#7c5cfc'}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={ringOffset}
                transform="rotate(-90 60 60)"
                style={{transition:'stroke-dashoffset 1s linear,stroke 0.3s'}}/>
            </svg>
            <div className={s.clockFace}>
              <span className={`${s.clockTime} ${timerSecs<60?s.clockUrgent:''} ${running?s.clockTick:''}`}>
                {fmtTimer(timerSecs)}
              </span>
              <span className={s.clockMode}>
                {timerMode==='focus'?'focus session':timerMode==='short'?'short break':'long break'}
              </span>
            </div>
          </div>

          <div className={s.timerBtns}>
            <button className={s.btnIcon} onClick={resetTimer} title="Reset">↺</button>
            <button className={`${s.btnPlay} ${running?s.btnPause:''}`} onClick={()=>setRunning(r=>!r)}>
              {running?'⏸':'▶'}
            </button>
            <button className={s.btnIcon} onClick={()=>setFocusOverlay(true)} title="Full focus">⛶</button>
          </div>
        </div>

        {/* Now working on */}
        <div className={s.nowBlock}>
          <p className={s.nowLabel}>NOW WORKING ON</p>
          {activeTask?(
            <div className={s.nowCard}>
              <div className={s.nowCardTop}>
                <span className={s.nowName}>{activeTask.name}</span>
                <span className={s.badge} style={{color:PM[activeTask.priority].color,background:PM[activeTask.priority].bg}}>
                  {PM[activeTask.priority].icon}
                </span>
              </div>
              {activeTask.estimatedMin>0&&<p className={s.nowEst}>⏱ {activeTask.estimatedMin}m estimated</p>}
              {(activeTask.subtasks||[]).length>0&&(
                <div className={s.nowSubs}>
                  {activeTask.subtasks.slice(0,3).map(sub=>(
                    <div key={sub.id} className={`${s.nowSub} ${sub.done?s.nowSubDone:''}`}>
                      <span className={s.nowSubDot}/>
                      {sub.name}
                    </div>
                  ))}
                </div>
              )}
              <button className={s.btnDoneNow} onClick={async(e)=>{await toggleTask(activeTask._id,e)}}>
                ✓ Mark Done
              </button>
            </div>
          ):(
            <div className={s.nowEmpty}>
              <p>No task selected</p>
              <small>Click a task to focus on it</small>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className={s.stats}>
          <div className={s.stat}><span>{sessionsToday}</span><small>sessions</small></div>
          <div className={s.statDiv}/>
          <div className={s.stat}><span>{totalDone}</span><small>done</small></div>
          <div className={s.statDiv}/>
          <div className={s.stat}><span>{focusedMin}m</span><small>focused</small></div>
        </div>

        {/* Progress */}
        <div className={s.leftProgress}>
          <div className={s.leftProgressLabel}><span>Daily progress</span><span>{pct}%</span></div>
          <div className={s.leftProgressTrack}><div className={s.leftProgressFill} style={{width:`${pct}%`}}/></div>
        </div>

        {/* BLITZ NOW */}
        {!blitzing?(
          <button className={s.blitzBtn} onClick={startBlitz}>
            <span>⚡</span> BLITZ NOW
          </button>
        ):(
          <button className={`${s.blitzBtn} ${s.blitzEnd}`} onClick={endBlitz}>
            <span>⏹</span> END SESSION
          </button>
        )}

        {/* Bottom settings */}
        <div className={s.leftBottom}>
          <button className={s.leftBtn} onClick={()=>setSettings(p=>!p)}>⚙️ Settings</button>
          <button className={s.leftBtn} onClick={()=>setSound(p=>!p)}>
            {sound?'🔔':'🔕'} {sound?'Sound on':'Muted'}
          </button>
        </div>
      </aside>

      {/* ══ RIGHT: TASK PANEL ══ */}
      <div className={s.right}>

        {/* Header */}
        <header className={s.header}>
          <div className={s.headerLeft}>
            <nav className={s.nav}>
              {NAV.map(item=>(
                <button key={item.id} className={`${s.navBtn} ${navPage===item.id?s.navOn:''}`}
                  onClick={()=>setNavPage(item.id)}>
                  {item.icon} {item.label}
                  <span className={s.navCnt}>
                    {item.id==='today'?tasks.filter(t=>new Date(t.createdAt).toDateString()===new Date().toDateString()&&t.status!=='done').length
                    :item.id==='completed'?totalDone
                    :tasks.filter(t=>t.status!=='done').length}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          <div className={s.headerRight}>
            <div className={s.searchWrap}>
              <input className={s.searchIn} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search…"/>
            </div>
            <div className={s.viewToggle}>
              <button className={`${s.viewBtn} ${view==='list'?s.viewOn:''}`} onClick={()=>setView('list')}>☰</button>
              <button className={`${s.viewBtn} ${view==='board'?s.viewOn:''}`} onClick={()=>setView('board')}>⊞</button>
            </div>
            <button className={s.btnAccent} onClick={()=>setModal({open:true})}>+ New Task</button>
          </div>
        </header>

        {/* Content */}
        <div className={s.content}>
          {loading?<Skeleton/>:filtered.length===0&&!search?(
            <Empty onAdd={()=>setModal({open:true})}/>
          ):view==='list'?(

            /* LIST VIEW */
            <div className={s.listView}>
              {(['todo','inprogress','done'] as Status[]).map(st=>{
                const stTasks=byStatus(st); const col=collapsed.has(st); const meta=SM[st]
                return (
                  <div key={st} className={s.section}>
                    <button className={s.secHead}
                      onClick={()=>setCollapsed(p=>{const n=new Set(p);n.has(st)?n.delete(st):n.add(st);return n})}>
                      <span className={s.secDot} style={{background:meta.color}}/>
                      <span className={s.secTitle}>{meta.label}</span>
                      <span className={s.secBadge} style={{background:meta.color+'20',color:meta.color}}>{stTasks.length}</span>
                      <span className={s.secChev}>{col?'▶':'▼'}</span>
                    </button>
                    {!col&&(
                      <>
                        {stTasks.map(task=>(
                          <div key={task._id} className={`${s.taskWrap} ${completingId===task._id?s.completing:''}`}>
                            <TaskRow task={task} active={activeId===task._id}
                              onActivate={()=>!task.done&&setActiveId(task._id===activeId?null:task._id)}
                              onToggle={e=>toggleTask(task._id,e)}
                              onEdit={()=>setModal({open:true,task:task})}
                              onDelete={()=>deleteTask(task._id)}
                              onStatus={st=>updateTask(task._id,{status:st})}
                              isNew={newIds.has(task._id)}/>
                          </div>
                        ))}
                        {stTasks.length===0&&<p className={s.secEmpty}>No tasks here</p>}
                        <button className={s.ghostAdd} onClick={()=>setModal({open:true,task:{status:st}})}>
                          + Add a task
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

          ):(
            /* BOARD VIEW */
            <div className={s.board}>
              {(['todo','inprogress','done'] as Status[]).map(st=>{
                const stTasks=byStatus(st); const meta=SM[st]
                return (
                  <div key={st} className={s.bCol}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{const id=e.dataTransfer.getData('taskId');if(id)updateTask(id,{status:st})}}>
                    <div className={s.bColHead}>
                      <span className={s.bColDot} style={{background:meta.color}}/>
                      <span className={s.bColTitle}>{meta.label}</span>
                      <span className={s.bColCnt} style={{color:meta.color}}>{stTasks.length}</span>
                      <button className={s.bColAdd} onClick={()=>setModal({open:true,task:{status:st}})}>+</button>
                    </div>
                    <div className={s.bCards}>
                      {stTasks.map(task=>(
                        <BoardCard key={task._id} task={task} onEdit={t=>setModal({open:true,task:t})}
                          onDelete={deleteTask} onStatusChange={(id,status)=>updateTask(id,{status})}/>
                      ))}
                      {stTasks.length===0&&<div className={s.bEmpty}>Drop tasks here</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ FOCUS OVERLAY ══ */}
      {focusOverlay&&(
        <div className={s.focusOverlay}>
          <div className={s.focusInner}>
            <p className={s.focusLabel}>FOCUS MODE</p>
            <p className={s.focusTask}>{activeTask?.name??'No task selected'}</p>
            <div className={s.focusClock}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
                <circle cx="80" cy="80" r="68" fill="none"
                  stroke={timerSecs<60?'#ff5f5f':blitzing?'#f97316':'#7c5cfc'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={2*Math.PI*68} strokeDashoffset={2*Math.PI*68*(1-progress)}
                  transform="rotate(-90 80 80)"
                  style={{transition:'stroke-dashoffset 1s linear,stroke 0.3s'}}/>
              </svg>
              <div className={s.focusClockFace}>
                <span className={`${s.focusTime} ${timerSecs<60?s.clockUrgent:''}`}>{fmtTimer(timerSecs)}</span>
                <span className={s.focusMode}>{timerMode==='focus'?'focus':timerMode==='short'?'short break':'long break'}</span>
              </div>
            </div>
            <div className={s.focusBtns}>
              <button className={s.focusBtn} onClick={()=>setRunning(r=>!r)}>
                {running?'⏸ Pause':'▶ Resume'}
              </button>
              <button className={`${s.focusBtn} ${s.focusBtnExit}`} onClick={()=>{setFocusOverlay(false);endBlitz()}}>
                Exit Focus
              </button>
            </div>
            {activeTask&&(
              <button className={s.focusDoneBtn} onClick={async e=>{
                await toggleTask(activeTask._id,e as unknown as React.MouseEvent)
              }}>✓ Task Done</button>
            )}
          </div>
        </div>
      )}

      {/* MODAL */}
      {modal.open&&(
        <TaskModal task={modal.task} onClose={()=>setModal({open:false})}
          onSave={data=>{modal.task?._id?updateTask(modal.task._id,data):createTask(data)}}/>
      )}

      {/* TOASTS */}
      <div className={s.toastStack}>
        {toasts.map(t=><Toast key={t.id} data={t} onDismiss={()=>setToasts(p=>p.filter(x=>x.id!==t.id))}/>)}
      </div>

      {/* SETTINGS */}
      {settings&&(
        <div className={s.overlay} onClick={e=>e.target===e.currentTarget&&setSettings(false)}>
          <div className={s.modal} style={{maxWidth:400}}>
            <div className={s.modalTop}><span style={{fontSize:16,fontWeight:600}}>Settings</span>
              <button className={s.modalX} onClick={()=>setSettings(false)}>✕</button></div>
            <div style={{padding:'0 20px 8px'}}>
              {[
                {label:'Sound effects',desc:'Chime on task completion',val:sound,set:()=>setSound(p=>!p)},
              ].map(({label,desc,val,set})=>(
                <div key={label} className={s.settRow}>
                  <div><p className={s.settLabel}>{label}</p><p className={s.settDesc}>{desc}</p></div>
                  <button className={`${s.toggle} ${val?s.toggleOn:''}`} onClick={set}><span className={s.toggleThumb}/></button>
                </div>
              ))}
              <div className={s.settSection}>
                <p className={s.settLabel}>Keyboard shortcuts</p>
                <div className={s.shortcuts}>
                  {[['⌘ K','New task'],['⌘ ↵','Save task'],['Esc','Close modal']].map(([k,v])=>(
                    <div key={k} className={s.scRow}><kbd>{k}</kbd><span>{v}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
