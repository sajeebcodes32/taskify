'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import s from './page.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'urgent' | 'high' | 'medium' | 'low'
type Status   = 'todo' | 'inprogress' | 'done'
type View     = 'list' | 'board'
type NavPage  = 'today' | 'upcoming' | 'all' | 'completed'

interface Subtask { id: string; name: string; done: boolean }
interface Task {
  _id: string; name: string; description: string; status: Status; priority: Priority
  dueDate: string | null; tags: string[]; estimatedMin: number; subtasks: Subtask[]
  notes: string; createdAt: string; completedAt: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PM: Record<Priority,{label:string;color:string;bg:string;icon:string}> = {
  urgent: {label:'Urgent', color:'#E03E3E', bg:'rgba(224,62,62,0.1)',   icon:'🔴'},
  high:   {label:'High',   color:'#DFAB01', bg:'rgba(223,171,1,0.1)',   icon:'🟠'},
  medium: {label:'Medium', color:'#2383E2', bg:'rgba(35,131,226,0.1)',  icon:'🟡'},
  low:    {label:'Low',    color:'#9B9A97', bg:'rgba(155,154,151,0.1)', icon:'🔵'},
}
const SM: Record<Status,{label:string;color:string}> = {
  todo:       {label:'To Do',       color:'#9B9A97'},
  inprogress: {label:'In Progress', color:'#2383E2'},
  done:       {label:'Done',        color:'#0F7B6C'},
}
const NAV = [
  {id:'today'    as NavPage, label:'Today',     icon:'☀️'},
  {id:'upcoming' as NavPage, label:'Upcoming',  icon:'📅'},
  {id:'all'      as NavPage, label:'All Tasks', icon:'📋'},
  {id:'completed'as NavPage, label:'Completed', icon:'✅'},
]

function mkId() { return crypto.randomUUID() }
function fmtDate(d:string|null) {
  if(!d) return null
  const date=new Date(d), now=new Date(); now.setHours(0,0,0,0)
  const diff=Math.round((new Date(d).setHours(0,0,0,0)-now.getTime())/86400000)
  if(diff<0)  return {label:'Overdue',  cls:s.dateOverdue}
  if(diff===0) return {label:'Today',   cls:s.dateToday}
  if(diff===1) return {label:'Tomorrow',cls:s.dateNormal}
  return {label:date.toLocaleDateString('en',{month:'short',day:'numeric'}), cls:s.dateNormal}
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
function fireConfetti(x:number,y:number) {
  if(typeof window==='undefined') return
  const run=()=>{
    const c=(window as unknown as Record<string,unknown>).confetti as ((o:Record<string,unknown>)=>void)|undefined
    if(!c) return
    c({particleCount:80,spread:360,startVelocity:25,origin:{x:x/window.innerWidth,y:y/window.innerHeight},
      colors:['#2383E2','#0F7B6C','#DFAB01','#E03E3E','#8B5CF6'],gravity:0.9,scalar:0.9,ticks:80})
  }
  if((window as unknown as Record<string,unknown>).confetti){run();return}
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
        <div className={s.toastIcon}>
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="7" fill="#0F7B6C"/>
            <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className={s.toastText}>
          <p className={s.toastTitle}>Task completed! 🎉</p>
          <p className={s.toastSub}>{data.taskName.slice(0,45)}{data.taskName.length>45?'…':''}</p>
        </div>
        <button className={s.toastUndo} onClick={()=>{data.onUndo();onDismiss()}}>Undo</button>
        <button className={s.toastClose} onClick={onDismiss}>✕</button>
      </div>
      <div className={s.toastProgress}/>
    </div>
  )
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({task,onSave,onClose}:{task?:Partial<Task>;onSave:(t:Partial<Task>)=>void;onClose:()=>void}) {
  const [name,setName]         = useState(task?.name||'')
  const [desc,setDesc]         = useState(task?.description||'')
  const [status,setStatus]     = useState<Status>(task?.status||'todo')
  const [priority,setPriority] = useState<Priority>(task?.priority||'medium')
  const [dueDate,setDueDate]   = useState(task?.dueDate||'')
  const [tags,setTags]         = useState<string[]>(task?.tags||[])
  const [tagInput,setTagInput] = useState('')
  const [est,setEst]           = useState(task?.estimatedMin||25)
  const [subtasks,setSubtasks] = useState<Subtask[]>(task?.subtasks||[])
  const [subInput,setSubInput] = useState('')
  const nameRef=useRef<HTMLInputElement>(null)

  useEffect(()=>{nameRef.current?.focus()},[])
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){onClose()}
      if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){handleSave()}
    }
    window.addEventListener('keydown',fn)
    return ()=>window.removeEventListener('keydown',fn)
  })

  function handleSave(){
    if(!name.trim()) return
    onSave({name:name.trim(),description:desc,status,priority,dueDate:dueDate||null,tags,estimatedMin:est,subtasks})
    onClose()
  }
  function addTag(e:React.KeyboardEvent){
    if(e.key==='Enter'&&tagInput.trim()){
      if(!tags.includes(tagInput.trim()))setTags(p=>[...p,tagInput.trim()])
      setTagInput('')
    }
  }
  function addSub(e:React.KeyboardEvent){
    if(e.key==='Enter'&&subInput.trim()){
      setSubtasks(p=>[...p,{id:mkId(),name:subInput.trim(),done:false}])
      setSubInput('')
    }
  }

  return (
    <div className={s.modalOverlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={s.modal} role="dialog" aria-modal="true">
        <div className={s.modalHeader}>
          <input ref={nameRef} className={s.modalTitle} value={name} onChange={e=>setName(e.target.value)} placeholder="Task name…"/>
          <button className={s.modalClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <textarea className={s.modalDesc} value={desc} onChange={e=>setDesc(e.target.value)}
          placeholder="Add a description…" rows={3}/>

        <div className={s.propGrid}>
          {[
            {label:'Status', el:<select className={s.propSelect} value={status} onChange={e=>setStatus(e.target.value as Status)}>
              {(Object.keys(SM) as Status[]).map(k=><option key={k} value={k}>{SM[k].label}</option>)}
            </select>},
            {label:'Priority', el:<select className={s.propSelect} value={priority} onChange={e=>setPriority(e.target.value as Priority)}>
              {(Object.keys(PM) as Priority[]).map(k=><option key={k} value={k}>{PM[k].icon} {PM[k].label}</option>)}
            </select>},
            {label:'Due date', el:<input className={s.propInput} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>},
            {label:'Est. time', el:<div style={{display:'flex',gap:6,alignItems:'center'}}>
              <input className={s.propInput} type="number" min={5} max={480} value={est}
                onChange={e=>setEst(Number(e.target.value))} style={{width:70}}/>
              <span className={s.propUnit}>min</span>
            </div>},
            {label:'Tags', el:<div className={s.tagInputWrap}>
              {tags.map(t=><span key={t} className={s.tagChip}>{t}<button onClick={()=>setTags(p=>p.filter(x=>x!==t))}>×</button></span>)}
              <input className={s.tagTypeInput} value={tagInput} onChange={e=>setTagInput(e.target.value)}
                onKeyDown={addTag} placeholder="Add tag…"/>
            </div>},
          ].map(({label,el})=>(
            <div key={label} className={s.propRow}>
              <span className={s.propLabel}>{label}</span>
              {el}
            </div>
          ))}
        </div>

        <div className={s.subSection}>
          <p className={s.subSectionLabel}>Sub-tasks</p>
          {subtasks.map(sub=>(
            <div key={sub.id} className={s.subRow}>
              <button className={`${s.subCheck} ${sub.done?s.subChecked:''}`}
                onClick={()=>setSubtasks(p=>p.map(x=>x.id===sub.id?{...x,done:!x.done}:x))}>
                {sub.done&&'✓'}
              </button>
              <span className={`${s.subName} ${sub.done?s.subDoneText:''}`}>{sub.name}</span>
              <button className={s.subDel} onClick={()=>setSubtasks(p=>p.filter(x=>x.id!==sub.id))}>✕</button>
            </div>
          ))}
          <input className={s.subInput} value={subInput} onChange={e=>setSubInput(e.target.value)}
            onKeyDown={addSub} placeholder="+ Add sub-task…"/>
        </div>

        <div className={s.modalFooter}>
          <span className={s.shortcutHint}>⌘↵ save · Esc close</span>
          <div style={{display:'flex',gap:8}}>
            <button className={s.btnCancel} onClick={onClose}>Cancel</button>
            <button className={s.btnSave} onClick={handleSave} disabled={!name.trim()}>Save Task</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({task,onToggle,onEdit,onDelete,onStatusChange,isNew}:
  {task:Task;onToggle:(id:string,e:React.MouseEvent)=>void;onEdit:(t:Task)=>void;
   onDelete:(id:string)=>void;onStatusChange:(id:string,s:Status)=>void;isNew?:boolean}) {
  const [menu,setMenu]=useState(false)
  const menuRef=useRef<HTMLDivElement>(null)
  const dateInfo=fmtDate(task.dueDate)
  const pm=PM[task.priority]

  useEffect(()=>{
    const fn=(e:MouseEvent)=>{if(!menuRef.current?.contains(e.target as Node))setMenu(false)}
    if(menu)document.addEventListener('mousedown',fn)
    return ()=>document.removeEventListener('mousedown',fn)
  },[menu])

  return (
    <div className={`${s.taskRow} ${task.status==='done'?s.taskRowDone:''} ${isNew?s.taskRowNew:''}`}>
      <button className={`${s.checkbox} ${task.status==='done'?s.checkboxDone:''}`}
        onClick={e=>onToggle(task._id,e)} aria-label={`Toggle ${task.name}`}>
        {task.status==='done'&&(
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" fill="none"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="20" strokeDashoffset="0" className={s.checkPath}/>
          </svg>
        )}
      </button>

      <span className={s.taskTitle} onClick={()=>onEdit(task)}>{task.name}</span>

      <div className={s.taskMeta}>
        <span className={`${s.priorityBadge} ${task.priority==='urgent'?s.urgentPulse:''}`}
          style={{color:pm.color,background:pm.bg}}>{pm.icon} {pm.label}</span>
        {dateInfo&&<span className={`${s.dateBadge} ${dateInfo.cls}`}>{dateInfo.label}</span>}
        {task.tags.slice(0,2).map(t=><span key={t} className={s.tagBadge}>{t}</span>)}
        {task.subtasks.length>0&&(
          <span className={s.subCount}>{task.subtasks.filter(x=>x.done).length}/{task.subtasks.length}</span>
        )}
        {task.estimatedMin>0&&<span className={s.estChip}>⏱ {task.estimatedMin}m</span>}
      </div>

      <div className={s.rowActions} ref={menuRef}>
        <button className={s.btnOverflow} onClick={()=>setMenu(p=>!p)} aria-label="Options">⋯</button>
        {menu&&(
          <div className={s.overflowMenu}>
            <button onClick={()=>{onEdit(task);setMenu(false)}}>✏️ Edit</button>
            <button onClick={()=>{onStatusChange(task._id,'inprogress');setMenu(false)}}>▶️ In Progress</button>
            <button onClick={()=>{onStatusChange(task._id,'done');setMenu(false)}}>✅ Mark Done</button>
            <div className={s.menuDivider}/>
            <button className={s.menuDanger} onClick={()=>{onDelete(task._id);setMenu(false)}}>🗑️ Delete</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Board Card ───────────────────────────────────────────────────────────────
function BoardCard({task,onEdit,onDelete}:{task:Task;onEdit:(t:Task)=>void;onDelete:(id:string)=>void}) {
  const pm=PM[task.priority]; const dateInfo=fmtDate(task.dueDate)
  const subsDone=task.subtasks.filter(x=>x.done).length
  return (
    <div className={s.boardCard} draggable onDragStart={e=>e.dataTransfer.setData('taskId',task._id)}
      onClick={()=>onEdit(task)}>
      <div className={s.boardCardTop}>
        <span className={`${s.priorityBadge} ${task.priority==='urgent'?s.urgentPulse:''}`}
          style={{color:pm.color,background:pm.bg}}>{pm.icon} {pm.label}</span>
        <button className={s.boardCardDel} onClick={e=>{e.stopPropagation();onDelete(task._id)}}>✕</button>
      </div>
      <p className={`${s.boardCardTitle} ${task.status==='done'?s.boardCardDone:''}`}>{task.name}</p>
      {task.description&&<p className={s.boardCardDesc}>{task.description.slice(0,60)}{task.description.length>60?'…':''}</p>}
      <div className={s.boardCardMeta}>
        {dateInfo&&<span className={`${s.dateBadge} ${dateInfo.cls}`}>{dateInfo.label}</span>}
        {task.tags.slice(0,2).map(t=><span key={t} className={s.tagBadge}>{t}</span>)}
        {task.estimatedMin>0&&<span className={s.estChip}>⏱ {task.estimatedMin}m</span>}
      </div>
      {task.subtasks.length>0&&(
        <>
          <div className={s.boardSubBar}><div className={s.boardSubFill} style={{width:`${(subsDone/task.subtasks.length)*100}%`}}/></div>
          <span className={s.boardSubCount}>{subsDone}/{task.subtasks.length} subtasks</span>
        </>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className={s.skeleton}>
      {[...Array(5)].map((_,i)=>(
        <div key={i} className={s.skeletonRow}>
          <div className={s.skBone} style={{width:18,height:18,borderRadius:4,flexShrink:0}}/>
          <div className={s.skBone} style={{flex:1,height:14,borderRadius:4}}/>
          <div className={s.skBone} style={{width:64,height:20,borderRadius:20}}/>
          <div className={s.skBone} style={{width:72,height:20,borderRadius:20}}/>
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({onAdd}:{onAdd:()=>void}) {
  return (
    <div className={s.emptyState}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        <rect x="10" y="18" width="52" height="44" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="2"/>
        <rect x="18" y="30" width="28" height="3" rx="1.5" fill="var(--border)"/>
        <rect x="18" y="38" width="20" height="3" rx="1.5" fill="var(--border)"/>
        <rect x="18" y="46" width="24" height="3" rx="1.5" fill="var(--border)"/>
        <circle cx="54" cy="20" r="11" fill="#2383E2"/>
        <path d="M54 15v10M49 20h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <h3>No tasks here</h3>
      <p>Create your first task to get started</p>
      <button className={s.btnPrimary} onClick={onAdd}>+ New Task</button>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [tasks,setTasks]       = useState<Task[]>([])
  const [loading,setLoading]   = useState(true)
  const [navPage,setNavPage]   = useState<NavPage>('all')
  const [view,setView]         = useState<View>('list')
  const [dark,setDark]         = useState(false)
  const [sidebar,setSidebar]   = useState(true)
  const [modal,setModal]       = useState<{open:boolean;task?:Partial<Task>}>({open:false})
  const [toasts,setToasts]     = useState<ToastData[]>([])
  const [collapsed,setCollapsed]= useState<Set<Status>>(new Set())
  const [completingId,setCompletingId]=useState<string|null>(null)
  const [newIds,setNewIds]     = useState<Set<string>>(new Set())
  const [sound,setSound]       = useState(true)
  const [settings,setSettings] = useState(false)
  const [search,setSearch]     = useState('')

  useEffect(()=>{
    const t=localStorage.getItem('taskify_theme'); if(t==='dark')setDark(true)
    const snd=localStorage.getItem('taskify_sound'); if(snd==='off')setSound(false)
  },[])
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme',dark?'dark':'light')
    localStorage.setItem('taskify_theme',dark?'dark':'light')
  },[dark])
  useEffect(()=>{localStorage.setItem('taskify_sound',sound?'on':'off')},[sound])

  // Keyboard shortcut ⌘K
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setModal({open:true})}
      if(e.key==='d'&&!e.metaKey&&(e.target as HTMLElement).tagName==='BODY') setDark(p=>!p)
    }
    window.addEventListener('keydown',fn)
    return ()=>window.removeEventListener('keydown',fn)
  },[])

  const fetchTasks=useCallback(async()=>{
    try{const r=await fetch('/api/tasks');const j=await r.json();if(j.success)setTasks(j.data)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{fetchTasks()},[fetchTasks])

  const filtered=tasks.filter(t=>{
    if(search)return t.name.toLowerCase().includes(search.toLowerCase())
    if(navPage==='today') return new Date(t.createdAt).toDateString()===new Date().toDateString()
    if(navPage==='completed') return t.status==='done'
    if(navPage==='upcoming') return t.status!=='done'&&!!t.dueDate&&new Date(t.dueDate)>new Date()
    return true
  })
  const byStatus=(st:Status)=>filtered.filter(t=>t.status===st)

  async function createTask(data:Partial<Task>) {
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

  async function updateTask(id:string,data:Partial<Task>) {
    const r=await fetch(`/api/tasks/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    const j=await r.json(); if(j.success)setTasks(p=>p.map(t=>t._id===id?j.data:t))
  }

  async function deleteTask(id:string) {
    await fetch(`/api/tasks/${id}`,{method:'DELETE'})
    setTasks(p=>p.filter(t=>t._id!==id))
  }

  async function toggleTask(id:string,e:React.MouseEvent) {
    const task=tasks.find(t=>t._id===id); if(!task) return
    const becomingDone=task.status!=='done'
    if(becomingDone){
      setCompletingId(id); playChime(); fireConfetti(e.clientX,e.clientY)
      setTimeout(()=>setCompletingId(null),600)
      const tid=mkId(); const prevStatus=task.status
      setToasts(p=>[...p,{id:tid,taskName:task.name,onUndo:()=>updateTask(id,{status:prevStatus,completedAt:null})}])
      setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==tid)),4200)
      const remaining=tasks.filter(t=>t.status!=='done'&&t._id!==id)
      if(remaining.length===0) setTimeout(()=>fireConfetti(window.innerWidth/2,window.innerHeight/2),400)
    }
    await updateTask(id,{status:becomingDone?'done':'todo',completedAt:becomingDone?new Date().toISOString():null})
  }

  function toggleSection(st:Status){
    setCollapsed(p=>{const n=new Set(p);n.has(st)?n.delete(st):n.add(st);return n})
  }

  const totalDone=tasks.filter(t=>t.status==='done').length
  const overallPct=tasks.length?Math.round((totalDone/tasks.length)*100):0

  return (
    <div className={`${s.app} ${sidebar?'':s.sidebarCollapsed}`}>

      {/* SIDEBAR */}
      <aside className={`${s.sidebar} ${sidebar?'':s.sidebarMin}`}>
        <div className={s.sideTop}>
          <div className={s.logoWrap}>
            {sidebar&&<span className={s.logoText}>task<strong>ify</strong></span>}
            <button className={s.sidebarToggle} onClick={()=>setSidebar(p=>!p)} aria-label="Toggle sidebar">
              {sidebar?'◀':'▶'}
            </button>
          </div>
          {sidebar&&(
            <div className={s.searchWrap}>
              <span className={s.searchIcon}>🔍</span>
              <input className={s.searchInput} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks…"/>
            </div>
          )}
          <nav className={s.sideNav}>
            {NAV.map(item=>(
              <button key={item.id} className={`${s.navItem} ${navPage===item.id?s.navActive:''}`}
                onClick={()=>setNavPage(item.id)} aria-current={navPage===item.id?'page':undefined}
                title={!sidebar?item.label:undefined}>
                <span className={s.navIcon}>{item.icon}</span>
                {sidebar&&<span className={s.navLabel}>{item.label}</span>}
                {sidebar&&item.id!=='completed'&&(
                  <span className={s.navCount}>
                    {item.id==='today'?tasks.filter(t=>new Date(t.createdAt).toDateString()===new Date().toDateString()).length
                    :item.id==='upcoming'?tasks.filter(t=>t.status!=='done'&&!!t.dueDate&&new Date(t.dueDate)>new Date()).length
                    :tasks.filter(t=>t.status!=='done').length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {sidebar&&(
          <div className={s.sideProgress}>
            <div className={s.sideProgressLabel}><span>Progress</span><span>{overallPct}%</span></div>
            <div className={s.sideProgressTrack}><div className={s.sideProgressFill} style={{width:`${overallPct}%`}}/></div>
          </div>
        )}

        <div className={s.sideBottom}>
          <button className={s.sideBtn} onClick={()=>setSettings(p=>!p)} title="Settings">
            <span>⚙️</span>{sidebar&&<span>Settings</span>}
          </button>
          <button className={s.sideBtn} onClick={()=>setDark(p=>!p)} title="Toggle theme">
            <span>{dark?'☀️':'🌙'}</span>{sidebar&&<span>{dark?'Light':'Dark'} mode</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className={s.main}>
        <header className={s.header}>
          <div className={s.headerLeft}>
            <h1 className={s.pageTitle}>{NAV.find(n=>n.id===navPage)?.icon} {NAV.find(n=>n.id===navPage)?.label}</h1>
            <span className={s.countBadge}>{filtered.filter(t=>t.status!=='done').length} open</span>
          </div>
          <div className={s.headerRight}>
            <div className={s.viewToggle}>
              <button className={`${s.viewBtn} ${view==='list'?s.viewActive:''}`} onClick={()=>setView('list')}>☰ List</button>
              <button className={`${s.viewBtn} ${view==='board'?s.viewActive:''}`} onClick={()=>setView('board')}>⊞ Board</button>
            </div>
            <button className={s.btnPrimary} onClick={()=>setModal({open:true})}>+ New Task</button>
          </div>
        </header>

        <div className={s.content}>
          {loading?<Skeleton/>:filtered.length===0&&!search?(
            <EmptyState onAdd={()=>setModal({open:true})}/>
          ):view==='list'?(
            <div className={s.listView}>
              {(['todo','inprogress','done'] as Status[]).map(st=>{
                const stTasks=byStatus(st); const col=collapsed.has(st); const meta=SM[st]
                return (
                  <div key={st} className={s.section}>
                    <button className={s.sectionHeader} onClick={()=>toggleSection(st)}>
                      <span className={s.sectionDot} style={{background:meta.color}}/>
                      <span className={s.sectionTitle}>{meta.label}</span>
                      <span className={s.sectionBadge} style={{background:meta.color+'1a',color:meta.color}}>{stTasks.length}</span>
                      <span className={s.sectionChevron}>{col?'▶':'▼'}</span>
                    </button>
                    {!col&&(
                      <>
                        {stTasks.map(task=>(
                          <div key={task._id} className={`${s.taskRowWrap} ${completingId===task._id?s.completing:''}`}>
                            <TaskRow task={task} onToggle={toggleTask} onEdit={t=>setModal({open:true,task:t})}
                              onDelete={deleteTask} onStatusChange={(id,status)=>updateTask(id,{status})}
                              isNew={newIds.has(task._id)}/>
                          </div>
                        ))}
                        {stTasks.length===0&&<div className={s.sectionEmpty}>No tasks in this section</div>}
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
            <div className={s.boardView}>
              {(['todo','inprogress','done'] as Status[]).map(st=>{
                const stTasks=byStatus(st); const meta=SM[st]
                return (
                  <div key={st} className={s.boardCol}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{const id=e.dataTransfer.getData('taskId');if(id)updateTask(id,{status:st})}}>
                    <div className={s.boardColHeader}>
                      <span className={s.boardColDot} style={{background:meta.color}}/>
                      <span className={s.boardColTitle}>{meta.label}</span>
                      <span className={s.boardColCount} style={{color:meta.color}}>{stTasks.length}</span>
                      <button className={s.boardColAdd} onClick={()=>setModal({open:true,task:{status:st}})}>+</button>
                    </div>
                    <div className={s.boardCards}>
                      {stTasks.map(task=>(
                        <BoardCard key={task._id} task={task} onEdit={t=>setModal({open:true,task:t})}
                          onDelete={deleteTask} onStatusChange={(id,status)=>updateTask(id,{status})}/>
                      ))}
                      {stTasks.length===0&&<div className={s.boardEmpty}>Drop tasks here</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

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
        <div className={s.settingsOverlay} onClick={e=>e.target===e.currentTarget&&setSettings(false)}>
          <div className={s.settingsPanel}>
            <div className={s.settingsHeader}><h2>Settings</h2><button onClick={()=>setSettings(false)}>✕</button></div>
            <div className={s.settingRow}>
              <div><p className={s.settingLabel}>Dark mode</p><p className={s.settingDesc}>Switch to dark theme</p></div>
              <button className={`${s.toggleBtn} ${dark?s.toggleOn:''}`} onClick={()=>setDark(p=>!p)}><span className={s.toggleThumb}/></button>
            </div>
            <div className={s.settingRow}>
              <div><p className={s.settingLabel}>Sound effects</p><p className={s.settingDesc}>Completion chime on task done</p></div>
              <button className={`${s.toggleBtn} ${sound?s.toggleOn:''}`} onClick={()=>setSound(p=>!p)}><span className={s.toggleThumb}/></button>
            </div>
            <div className={s.settingSection}>
              <p className={s.settingLabel}>Keyboard shortcuts</p>
              <div className={s.shortcuts}>
                {[['⌘ K','New task'],['⌘ ↵','Save task'],['Esc','Close modal'],['D','Toggle dark mode']].map(([k,v])=>(
                  <div key={k} className={s.shortcutRow}><kbd>{k}</kbd><span>{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
