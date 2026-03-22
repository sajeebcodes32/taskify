'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './page.module.css'

type Tag = 'work' | 'personal' | 'urgent'
type TimerMode = 'focus' | 'short' | 'long'

interface Task {
  _id: string
  name: string
  estimatedMin: number
  tag: Tag
  done: boolean
  createdAt: string
}

const MODE_DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
}

const TAG_LABELS: Record<Tag, string> = {
  work: 'Work',
  personal: 'Personal',
  urgent: 'Urgent',
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newEst, setNewEst] = useState(25)
  const [newTag, setNewTag] = useState<Tag>('work')
  const [timerMode, setTimerMode] = useState<TimerMode>('focus')
  const [timerSeconds, setTimerSeconds] = useState(MODE_DURATIONS.focus)
  const [timerRunning, setTimerRunning] = useState(false)
  const [sessionsToday, setSessionsToday] = useState(0)
  const [focusedMin, setFocusedMin] = useState(0)
  const [focusMode, setFocusMode] = useState(false)
  const [celebration, setCelebration] = useState('')
  const [tab, setTab] = useState<'today' | 'all'>('today')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerTotalRef = useRef(MODE_DURATIONS.focus)

  // Load tasks from MongoDB via API
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      const json = await res.json()
      if (json.success) setTasks(json.data)
    } catch (e) {
      console.error('Failed to load tasks', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load today's sessions for stats
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      const json = await res.json()
      if (json.success) {
        setSessionsToday(json.data.length)
        const totalMin = json.data.reduce(
          (acc: number, s: { durationMin: number; completedFull: boolean }) =>
            s.completedFull ? acc + s.durationMin : acc,
          0
        )
        setFocusedMin(totalMin)
      }
    } catch (e) {
      console.error('Failed to load sessions', e)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchSessions()
  }, [fetchTasks, fetchSessions])

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            setTimerRunning(false)
            setSessionsToday((s) => s + 1)
            setFocusedMin((m) => m + Math.round(timerTotalRef.current / 60))
            // Log session to API
            fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taskId: activeTaskId,
                type: timerMode,
                durationMin: Math.round(timerTotalRef.current / 60),
                completedFull: true,
              }),
            })
            setCelebration('Pomodoro complete! Take a break 🎉')
            setTimeout(() => setCelebration(''), 3000)
            return timerTotalRef.current
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning, activeTaskId, timerMode])

  function switchMode(mode: TimerMode) {
    setTimerMode(mode)
    setTimerRunning(false)
    const secs = MODE_DURATIONS[mode]
    timerTotalRef.current = secs
    setTimerSeconds(secs)
  }

  function resetTimer() {
    setTimerRunning(false)
    setTimerSeconds(timerTotalRef.current)
  }

  async function addTask() {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), estimatedMin: newEst, tag: newTag }),
      })
      const json = await res.json()
      if (json.success) {
        setTasks((prev) => [json.data, ...prev])
        setNewName('')
      }
    } catch (e) {
      console.error('Failed to add task', e)
    }
  }

  async function toggleDone(task: Task) {
    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !task.done }),
      })
      const json = await res.json()
      if (json.success) {
        setTasks((prev) => prev.map((t) => (t._id === task._id ? json.data : t)))
        if (!task.done) {
          setCelebration(`"${task.name}" done! 🎉`)
          setTimeout(() => setCelebration(''), 2500)
          if (activeTaskId === task._id) {
            const next = tasks.find((t) => !t.done && t._id !== task._id)
            setActiveTaskId(next?._id ?? null)
          }
        }
      }
    } catch (e) {
      console.error('Failed to toggle task', e)
    }
  }

  async function deleteTask(id: string) {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      setTasks((prev) => prev.filter((t) => t._id !== id))
      if (activeTaskId === id) setActiveTaskId(null)
    } catch (e) {
      console.error('Failed to delete task', e)
    }
  }

  const displayedTasks = tab === 'today'
    ? tasks.filter((t) => {
        const today = new Date()
        const created = new Date(t.createdAt)
        return created.toDateString() === today.toDateString()
      })
    : tasks

  const remaining = displayedTasks.filter((t) => !t.done).length
  const totalDisp = displayedTasks.length
  const donePct = totalDisp ? Math.round(((totalDisp - remaining) / totalDisp) * 100) : 0
  const progress = timerSeconds / timerTotalRef.current
  const circumference = 238.76
  const ringOffset = circumference * (1 - progress)
  const activeTask = tasks.find((t) => t._id === activeTaskId)

  return (
    <div className={styles.app}>
      {/* TOP BAR */}
      <header className={styles.topbar}>
        <div className={styles.logo}>
          task<span>ify</span>
        </div>
        <div className={styles.tabs}>
          {(['today', 'all'] as const).map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'today' ? 'Today' : 'All Tasks'}
            </button>
          ))}
        </div>
        <div className={styles.dbBadge}>
          <span className={styles.dbDot} />
          MongoDB
        </div>
      </header>

      <div className={styles.main}>
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.timerCard}>
            <p className={styles.timerLabel}>Pomodoro</p>
            <div className={styles.timerRing}>
              <svg viewBox="0 0 90 90" width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="45" cy="45" r="38" fill="none" stroke="var(--surface)" strokeWidth="6" />
                <circle
                  cx="45" cy="45" r="38" fill="none"
                  stroke={timerSeconds < 60 ? 'var(--danger)' : 'var(--accent)'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={ringOffset}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className={styles.timerOverlay}>
                <span className={`${styles.timerDisplay} ${timerSeconds < 60 ? styles.urgent : ''}`}>
                  {fmtTime(timerSeconds)}
                </span>
              </div>
            </div>
            <div className={styles.modePills}>
              {(['focus', 'short', 'long'] as TimerMode[]).map((m) => (
                <button
                  key={m}
                  className={`${styles.modePill} ${timerMode === m ? styles.modePillActive : ''}`}
                  onClick={() => switchMode(m)}
                >
                  {m === 'focus' ? 'Focus' : m === 'short' ? 'Short' : 'Long'}
                </button>
              ))}
            </div>
            <div className={styles.timerControls}>
              <button className={styles.btnIcon} onClick={resetTimer} title="Reset">↺</button>
              <button
                className={`${styles.btnIcon} ${styles.btnPrimary}`}
                onClick={() => setTimerRunning((r) => !r)}
              >
                {timerRunning ? '⏸' : '▶'}
              </button>
              <button className={styles.btnIcon} onClick={() => setFocusMode(true)} title="Focus Mode">⛶</button>
            </div>
          </div>

          <div className={styles.nowBox}>
            <p className={styles.nowLabel}>Now working on</p>
            <p className={`${styles.nowTask} ${!activeTask ? styles.nowEmpty : ''}`}>
              {activeTask ? activeTask.name : 'No task selected'}
            </p>
          </div>

          <div className={styles.stats}>
            <div className={styles.statRow}><span>Sessions today</span><strong>{sessionsToday}</strong></div>
            <div className={styles.statRow}><span>Tasks done</span><strong>{tasks.filter(t=>t.done).length}</strong></div>
            <div className={styles.statRow}><span>Time focused</span><strong>{focusedMin}m</strong></div>
          </div>
        </aside>

        {/* TASK PANEL */}
        <section className={styles.taskPanel}>
          <div className={styles.taskHeader}>
            <h2>{tab === 'today' ? "Today's Tasks" : 'All Tasks'}</h2>
            <span className={styles.taskCount}><strong>{remaining}</strong> remaining</span>
          </div>

          <div className={styles.addBar}>
            <input
              className={styles.addInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Add a task… e.g. Review pull request"
            />
            <select className={styles.addSelect} value={newEst} onChange={(e) => setNewEst(Number(e.target.value))}>
              {[15, 25, 30, 45, 60, 90].map((v) => (
                <option key={v} value={v}>{v < 60 ? `${v}m` : `${v / 60}h`}</option>
              ))}
            </select>
            <select className={styles.addSelect} value={newTag} onChange={(e) => setNewTag(e.target.value as Tag)}>
              {(Object.keys(TAG_LABELS) as Tag[]).map((t) => (
                <option key={t} value={t}>{TAG_LABELS[t]}</option>
              ))}
            </select>
            <button className={styles.btnAdd} onClick={addTask}>+ Add</button>
          </div>

          <div className={styles.taskList}>
            {loading ? (
              <div className={styles.emptyState}>Loading tasks…</div>
            ) : displayedTasks.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No tasks yet</p>
                <small>Add your first task above to get started!</small>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <div
                  key={task._id}
                  className={`${styles.taskItem} ${task.done ? styles.taskDone : ''} ${activeTaskId === task._id ? styles.taskActive : ''}`}
                  onClick={() => !task.done && setActiveTaskId(task._id)}
                >
                  <button
                    className={`${styles.check} ${task.done ? styles.checkDone : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleDone(task) }}
                    aria-label="Toggle done"
                  >
                    {task.done && '✓'}
                  </button>
                  <div className={styles.taskInfo}>
                    <p className={styles.taskName}>{task.name}</p>
                    <div className={styles.taskMeta}>
                      <span className={`${styles.tag} ${styles[`tag_${task.tag}`]}`}>{TAG_LABELS[task.tag]}</span>
                      <span>{task.estimatedMin}m</span>
                    </div>
                  </div>
                  <button
                    className={styles.btnDel}
                    onClick={(e) => { e.stopPropagation(); deleteTask(task._id) }}
                    aria-label="Delete task"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <div className={styles.bottomBar}>
            <button
              className={`${styles.btnBlitz} ${timerRunning ? styles.btnBlitzActive : ''}`}
              onClick={() => {
                if (!timerRunning) {
                  const first = tasks.find((t) => !t.done)
                  if (first) setActiveTaskId(first._id)
                  setTimerRunning(true)
                  setFocusMode(true)
                } else {
                  setTimerRunning(false)
                  setFocusMode(false)
                }
              }}
            >
              {timerRunning ? '⏹ END BLITZ' : '⚡ BLITZ NOW'}
            </button>
            <div className={styles.progressWrap}>
              <div className={styles.progressLabel}>
                <span>Daily Progress</span>
                <span>{donePct}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${donePct}%` }} />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* FOCUS OVERLAY */}
      {focusMode && (
        <div className={styles.focusOverlay}>
          <p className={styles.focusLabel}>Focus Mode</p>
          <p className={styles.focusTask}>{activeTask?.name ?? 'No task selected'}</p>
          <p className={`${styles.focusTimer} ${timerSeconds < 60 ? styles.urgent : ''}`}>
            {fmtTime(timerSeconds)}
          </p>
          <div className={styles.focusControls}>
            <button className={styles.btnFocus} onClick={() => setTimerRunning((r) => !r)}>
              {timerRunning ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button className={`${styles.btnFocus} ${styles.btnFocusExit}`} onClick={() => setFocusMode(false)}>
              Exit Focus
            </button>
          </div>
        </div>
      )}

      {/* CELEBRATION TOAST */}
      {celebration && (
        <div className={styles.toast}>{celebration}</div>
      )}
    </div>
  )
}
