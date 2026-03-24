import React, { useState } from 'react';
import Modal from 'react-modal';

const TaskModal = ({ isOpen, onRequestClose, onSave, task }) => {
    const [title, setTitle] = useState(task ? task.title : '');
    const [description, setDescription] = useState(task ? task.description : '');
    const [isFocused, setIsFocused] = useState(task ? task.isFocused : false);

    const handleSave = () => {
        const newTask = { title, description, isFocused };
        onSave(newTask);
        onRequestClose();
    };

    return (
        <Modal isOpen={isOpen} onRequestClose={onRequestClose}>
            <h2>{task ? 'Edit Task' : 'Create Task'}</h2>
            <form>
                <div>
                    <label>Title:</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div>
                    <label>Description:</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} required></textarea>
                </div>
                <div>
                    <label>
                        <input type="checkbox" checked={isFocused} onChange={() => setIsFocused(!isFocused)} />
                        Focus Mode
                    </label>
                </div>
                <button type="button" onClick={handleSave}>Save</button>
                <button type="button" onClick={onRequestClose}>Cancel</button>
            </form>
        </Modal>
    );
};

export default TaskModal;