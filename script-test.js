// Simple test to verify React is working
const { useState } = React;

const TestApp = () => {
    return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">KEUDE Test</h1>
                <p className="text-slate-400">React is working! ✓</p>
                <p className="text-sm text-slate-500 mt-4">If you see this, React and Tailwind are loaded correctly.</p>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TestApp />);
