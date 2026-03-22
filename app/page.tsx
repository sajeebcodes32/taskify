'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import s from './page.module.css'

type Tag = 'work' | 'personal' | 'urgent'
type TimerMode = 'focus' | 'short' | 'long'
type View = 'today' | 'upcoming' | 'all'

interface Subtask {
  id: string
  name: string
  done: boolean
}

interface Task {
  _id: string
  name: string
  estimatedMin: number
  tag: Tag
  done: boolean
  notes: string
  subtasks: Subtask[]
  createdAt: string
}

const MODE_MINS: Record<TimerMode, number> = { focus: 25, short: 5, long: 15 }

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function TagBadge({ tag }: { tag: Tag }) {
  return <span className={`${s.tag} ${s[`tag_${tag}`]}`}>{tag}</span>
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [view, setView] = useState<View>('today')
  const [timerMode, setTimerMode] = useState<TimerMode>('focus')
  const [secs, setSecs] = useState(25 * 60)
  const [totalSecs, setTotalSecs] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [blitzing, setBlitzing] = useState(false)
  const [sessionsDone, setSessionsDone] = useState(0)
  const [focusedMin, setFocusedMin] = useState(0)
  const [celebration, setCelebration] = useState<{ msg: string; emoji: string } | null>(null)
  // add task form
  const [newName, setNewName] = useState('')
  const [newEst, setNewEst] = useState(25)
  const [newTag, setNewTag] = useState<Tag>('work')
  const [newNotes, setNewNotes] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  // subtask input per task
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({})

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const r = await fetch('/api/tasks')
      const j = await r.json()
      if (j.success) setTasks(j.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecs(p => {
          if (p <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            setSessionsDone(n => n + 1)
            setFocusedMin(m => m + Math.round(totalSecs / 60))
            fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: activeId, type: timerMode, durationMin: Math.round(totalSecs / 60), completedFull: true }),
            })
            celebrate('Session complete!', '🎯')
            return totalSecs
          }
          return p - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, activeId, timerMode, totalSecs])

  function celebrate(msg: string, emoji: string) {
    setCelebration({ msg, emoji })
    setTimeout(() => setCelebration(null), 2800)
  }

  function switchMode(m: TimerMode) {
    setTimerMode(m)
    setRunning(false)
    const s = MODE_MINS[m] * 60
    setTotalSecs(s)
    setSecs(s)
  }

  async function addTask() {
    if (!newName.trim()) return
    const r = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), estimatedMin: newEst, tag: newTag, notes: newNotes }),
    })
    const j = await r.json()
    if (j.success) {
      setTasks(p => [j.data, ...p])
      setNewName(''); setNewNotes(''); setShowAddForm(false)
    }
  }

  async function toggleDone(task: Task) {
    const r = await fetch(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !task.done }),
    })
    const j = await r.json()
    if (j.success) {
      setTasks(p => p.map(t => t._id === task._id ? j.data : t))
      if (!task.done) {
        celebrate(`"${task.name.slice(0, 28)}" done!`, '✅')
        const next = tasks.find(t => !t.done && t._id !== task._id)
        if (activeId === task._id) setActiveId(next?._id ?? null)
      }
    }
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(p => p.filter(t => t._id !== id))
    if (activeId === id) setActiveId(null)
  }

  async function addSubtask(taskId: string) {
    const name = (subtaskInputs[taskId] || '').trim()
    if (!name) return
    const task = tasks.find(t => t._id === taskId)
    if (!task) return
    const newSub: Subtask = { id: crypto.randomUUID(), name, done: false }
    const updated = [...(task.subtasks || []), newSub]
    const r = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: updated }),
    })
    const j = await r.json()
    if (j.success) {
      setTasks(p => p.map(t => t._id === taskId ? j.data : t))
      setSubtaskInputs(p => ({ ...p, [taskId]: '' }))
    }
  }

  async function toggleSubtask(task: Task, subId: string) {
    const updated = task.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s)
    const r = await fetch(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: updated }),
    })
    const j = await r.json()
    if (j.success) setTasks(p => p.map(t => t._id === task._id ? j.data : t))
  }

  function startBlitz() {
    const first = tasks.find(t => !t.done)
    if (first) setActiveId(first._id)
    setBlitzing(true)
    setRunning(true)
  }

  function endBlitz() {
    setBlitzing(false)
    setRunning(false)
  }

  const activeTask = tasks.find(t => t._id === activeId)
  const progress = secs / totalSecs
  const C = 2 * Math.PI * 54
  const offset = C * progress

  const displayed = view === 'today'
    ? tasks.filter(t => new Date(t.createdAt).toDateString() === new Date().toDateString())
    : tasks
  const remaining = displayed.filter(t => !t.done).length
  const donePct = displayed.length ? Math.round(((displayed.length - remaining) / displayed.length) * 100) : 0

  return (
    <div className={s.app}>
      {/* ── TOPBAR ── */}
      <header className={s.top}>
        <div className={s.logo}>task<span>ify</span></div>
        <nav className={s.nav}>
          {(['today', 'upcoming', 'all'] as View[]).map(v => (
            <button key={v} className={`${s.navBtn} ${view === v ? s.navActive : ''}`} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
        <div className={s.topRight}>
          <div className={s.streak}>🔥 3</div>
        </div>
      </header>

      <div className={s.body}>
        {/* ── LEFT: FOCUS PANEL ── */}
        <aside className={`${s.left} ${blitzing ? s.leftBlitzing : ''}`}>
          <div className={s.timerSection}>
            <div className={s.modePills}>
              {(['focus', 'short', 'long'] as TimerMode[]).map(m => (
                <button key={m} className={`${s.pill} ${timerMode === m ? s.pillActive : ''}`} onClick={() => switchMode(m)}>
                  {m === 'focus' ? '🍅 Focus' : m === 'short' ? 'Short Break' : 'Long Break'}
                </button>
              ))}
            </div>

            <div className={s.clockWrap}>
              <svg width="128" height="128" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle
                  cx="64" cy="64" r="54" fill="none"
                  stroke={secs < 60 ? '#ff5f5f' : blitzing ? '#f97316' : '#7c5cfc'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C - offset}
                  transform="rotate(-90 64 64)"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                />
              </svg>
              <div className={s.clockInner}>
                <span className={`${s.clockTime} ${secs < 60 ? s.urgent : ''}`}>{fmt(secs)}</span>
                <span className={s.clockLabel}>{timerMode === 'focus' ? 'focus' : timerMode === 'short' ? 'short break' : 'long break'}</span>
              </div>
            </div>

            <div className={s.timerBtns}>
              <button className={s.btnReset} onClick={() => { setRunning(false); setSecs(totalSecs) }}>↺</button>
              <button className={`${s.btnPlay} ${running ? s.btnPause : ''}`} onClick={() => setRunning(r => !r)}>
                {running ? '⏸' : '▶'}
              </button>
              <button className={s.btnReset} onClick={() => { setSecs(p => Math.min(p + 60, totalSecs)) }}>+1m</button>
            </div>
          </div>

          {/* Active task */}
          <div className={s.activeSection}>
            <p className={s.activeLabel}>NOW WORKING ON</p>
            {activeTask ? (
              <div className={s.activeCard}>
                <div className={s.activeTop}>
                  <span className={s.activeName}>{activeTask.name}</span>
                  <TagBadge tag={activeTask.tag} />
                </div>
                <div className={s.activeEst}>⏱ {activeTask.estimatedMin}m estimated</div>
                {activeTask.subtasks?.length > 0 && (
                  <div className={s.activeSubs}>
                    {activeTask.subtasks.map(sub => (
                      <div key={sub.id} className={`${s.activeSub} ${sub.done ? s.activeSubDone : ''}`}>
                        <span className={s.subDot} />
                        {sub.name}
                      </div>
                    ))}
                  </div>
                )}
                <button className={s.btnDoneActive} onClick={() => toggleDone(activeTask)}>
                  Mark Done ✓
                </button>
              </div>
            ) : (
              <div className={s.activeEmpty}>
                <p>No task selected</p>
                <small>Click a task to focus on it</small>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className={s.statsRow}>
            <div className={s.stat}><span>{sessionsDone}</span><small>sessions</small></div>
            <div className={s.statDivider} />
            <div className={s.stat}><span>{tasks.filter(t => t.done).length}</span><small>done</small></div>
            <div className={s.statDivider} />
            <div className={s.stat}><span>{focusedMin}m</span><small>focused</small></div>
          </div>

          {/* Blitz button */}
          {!blitzing ? (
            <button className={s.blitzBtn} onClick={startBlitz}>
              <span>⚡</span> BLITZ NOW
            </button>
          ) : (
            <button className={`${s.blitzBtn} ${s.blitzEnd}`} onClick={endBlitz}>
              <span>⏹</span> END SESSION
            </button>
          )}
        </aside>

        {/* ── RIGHT: TASK LIST ── */}
        <main className={s.right}>
          <div className={s.listHeader}>
            <div>
              <h2 className={s.listTitle}>
                {view === 'today' ? "Today's Tasks" : view === 'upcoming' ? 'Upcoming' : 'All Tasks'}
              </h2>
              <p className={s.listSub}>{remaining} remaining · {donePct}% complete</p>
            </div>
            <button className={s.btnAddNew} onClick={() => { setShowAddForm(p => !p); setTimeout(() => inputRef.current?.focus(), 50) }}>
              {showAddForm ? '✕ Cancel' : '+ Add Task'}
            </button>
          </div>

          {/* Progress bar */}
          <div className={s.progressTrack}>
            <div className={s.progressFill} style={{ width: `${donePct}%` }} />
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className={s.addForm}>
              <input ref={inputRef} className={s.addInput} value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Task name…" />
              <div className={s.addRow}>
                <select className={s.addSelect} value={newEst} onChange={e => setNewEst(Number(e.target.value))}>
                  {[5,10,15,20,25,30,45,60,90,120].map(v => <option key={v} value={v}>{v < 60 ? `${v}m` : `${v/60}h`}</option>)}
                </select>
                <select className={s.addSelect} value={newTag} onChange={e => setNewTag(e.target.value as Tag)}>
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="urgent">Urgent</option>
                </select>
                <input className={s.addInput} style={{ flex: 1 }} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notes / link (optional)…" />
                <button className={s.btnAdd} onClick={addTask}>Add</button>
              </div>
            </div>
          )}

          {/* Task list */}
          <div className={s.taskList}>
            {loading ? (
              <div className={s.empty}>Loading…</div>
            ) : displayed.length === 0 ? (
              <div className={s.empty}>
                <p>No tasks yet</p>
                <small>Hit "+ Add Task" to get started</small>
              </div>
            ) : (
              displayed.map(task => {
                const isActive = task._id === activeId
                const isExpanded = task._id === expandedId
                const subsDone = (task.subtasks || []).filter(s => s.done).length
                const subsTotal = (task.subtasks || []).length

                return (
                  <div key={task._id} className={`${s.taskCard} ${task.done ? s.taskDone : ''} ${isActive ? s.taskActive : ''}`}>
                    <div className={s.taskMain} onClick={() => !task.done && setActiveId(task._id)}>
                      {/* Check */}
                      <button className={`${s.check} ${task.done ? s.checked : ''}`}
                        onClick={e => { e.stopPropagation(); toggleDone(task) }}>
                        {task.done && <span className={s.checkMark}>✓</span>}
                      </button>

                      <div className={s.taskBody}>
                        <div className={s.taskTop}>
                          <span className={s.taskName}>{task.name}</span>
                          <div className={s.taskMeta}>
                            <TagBadge tag={task.tag} />
                            <span className={s.taskEst}>⏱ {task.estimatedMin}m</span>
                            {subsTotal > 0 && <span className={s.taskSubs}>{subsDone}/{subsTotal}</span>}
                          </div>
                        </div>
                        {task.notes && <p className={s.taskNotes}>{task.notes}</p>}
                        {subsTotal > 0 && (
                          <div className={s.subProgress}>
                            <div className={s.subProgressFill} style={{ width: `${subsTotal ? (subsDone/subsTotal)*100 : 0}%` }} />
                          </div>
                        )}
                      </div>

                      <div className={s.taskActions}>
                        <button className={s.btnExpand} onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : task._id) }}>
                          {isExpanded ? '▲' : '▼'}
                        </button>
                        <button className={s.btnDel} onClick={e => { e.stopPropagation(); deleteTask(task._id) }}>✕</button>
                      </div>
                    </div>

                    {/* Expanded: subtasks */}
                    {isExpanded && (
                      <div className={s.taskExpanded}>
                        {(task.subtasks || []).map(sub => (
                          <div key={sub.id} className={`${s.subItem} ${sub.done ? s.subDone : ''}`}
                            onClick={() => toggleSubtask(task, sub.id)}>
                            <div className={`${s.subCheck} ${sub.done ? s.subChecked : ''}`}>{sub.done && '✓'}</div>
                            <span>{sub.name}</span>
                          </div>
                        ))}
                        <div className={s.subAddRow}>
                          <input className={s.subInput} value={subtaskInputs[task._id] || ''} placeholder="Add subtask…"
                            onChange={e => setSubtaskInputs(p => ({ ...p, [task._id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && addSubtask(task._id)} />
                          <button className={s.btnSubAdd} onClick={() => addSubtask(task._id)}>+</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </main>
      </div>

      {/* ── CELEBRATION TOAST ── */}
      {celebration && (
        <div className={s.toast}>
          <span className={s.toastEmoji}>{celebration.emoji}</span>
          <span>{celebration.msg}</span>
        </div>
      )}
    </div>
  )
}
