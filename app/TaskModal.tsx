import React, { useState } from 'react';

function TaskModal({ isOpen, onClose, task, onSave }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [isFocused, setIsFocused] = useState(task?.isFocused || false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ 
      ...task, 
      title, 
      description, 
      isFocused 
    });
    onClose();
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        display: 'block', 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        zIndex: 1000 
      }}
      onClick={onClose}
    >
      <div 
        className="modal" 
        style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          backgroundColor: 'white', 
          padding: '30px', 
          borderRadius: '8px', 
          zIndex: 1001,
          minWidth: '400px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '20px' }}>
          {task ? 'Edit Task' : 'New Task'}
        </h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Title:</label>
          <input 
            type="text" 
            placeholder="Enter task title" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Description:</label>
          <textarea 
            placeholder="Enter task description" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isFocused}
              onChange={() => setIsFocused(!isFocused)}
              style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '16px' }}>🎯 Enable Focus Mode (25-min timer)</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={handleSave}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Save Task
          </button>
          <button 
            onClick={onClose}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskModal;
