import React, { useState } from 'react';
import TaskModal from './TaskModal';
import TaskRow from './TaskRow';

const App = () => {
    const [isFocusMode, setIsFocusMode] = useState(false);
    
    const handleFocusModeToggle = (value) => {
        setIsFocusMode(value);
    };

    return (
        <div className="app">
            <TaskModal onFocusModeToggle={handleFocusModeToggle} />
            {/* Other components */}
            <TaskRow isFocusMode={isFocusMode} />
            {isFocusMode && <div>🎯 Focus Mode Active</div>}
        </div>
    );
};

export default App;