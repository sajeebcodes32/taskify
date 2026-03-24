// File 4: app/page.tsx
'use client'

import React, { useState } from 'react'
import TaskModal from './TaskModal'
import s from './page.module.css'

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)

  const handleFocusModeToggle = (value: boolean) => {
    setIsFocusMode(value)
  }

  return (
    <div className={s.container}>
      <h1>Taskify</h1>
      <button onClick={() => setIsModalOpen(true)} className={s.newTaskBtn}>
        + New Task
      </button>
      
      {isFocusMode && (
        <div className={s.focusModeBanner}>
          🎯 Focus Mode Active
        </div>
      )}

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={(task) => {
          handleFocusModeToggle(task.isFocused)
          setIsModalOpen(false)
        }} 
      />

      {/* Other components */}
    </div>
  )
}
