// React hooks
const { useState, useEffect, useRef } = React;

// Icon component
const Icon = ({ name, size = 24, className = "" }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (window.lucide && ref.current) {
            const iconNode = window.lucide.icons[name];
            if (iconNode) {
                const svgElement = window.lucide.createElement(iconNode);
                svgElement.setAttribute('width', size);
                svgElement.setAttribute('height', size);
                const existingClass = svgElement.getAttribute('class') || '';
                svgElement.setAttribute('class', `${existingClass} ${className}`.trim());
                ref.current.innerHTML = '';
                ref.current.appendChild(svgElement);
            }
        }
    }, [name, size, className]);
    return <span ref={ref} className="inline-flex items-center justify-center" />;
};

// Services
const StorageService = {
    set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    get: (key, defaultValue = null) => {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    },
    remove: (key) => localStorage.removeItem(key)
};

const AuthService = {
    login: (username, password) => {
        if (username === 'admin' && password === 'admin123') {
            const user = { username, role: 'admin', loginTime: new Date().toISOString() };
            StorageService.set('kop_user_session', user);
            return user;
        }
        return null;
    },
    logout: () => StorageService.remove('kop_user_session'),
    getUser: () => StorageService.get('kop_user_session')
};

const MemberService = {
    getAll: () => StorageService.get('kop_members', []),
    save: (members) => StorageService.set('kop_members', members),
    add: (member) => {
        const members = MemberService.getAll();
        member.id = Date.now().toString();
        member.createdAt = new Date().toISOString();
        members.push(member);
        MemberService.save(members);
        return member;
    },
    update: (id, data) => {
        const members = MemberService.getAll();
        const index = members.findIndex(m => m.id === id);
        if (index !== -1) {
            members[index] = { ...members[index], ...data, updatedAt: new Date().toISOString() };
            MemberService.save(members);
        }
    },
    delete: (id) => {
        const members = MemberService.getAll().filter(m => m.id !== id);
        MemberService.save(members);
    }
};

const TransactionService = {
    getAll: () => StorageService.get('kop_transactions', []),
    save: (transactions) => StorageService.set('kop_transactions', transactions),
    add: (transaction) => {
        const transactions = TransactionService.getAll();
        transaction.id = Date.now().toString();
        transaction.createdAt = new Date().toISOString();
        transaction.date = transaction.date || new Date().toISOString().split('T')[0];
        transactions.unshift(transaction);
        TransactionService.save(transactions);
        return transaction;
    }
};

const FundsService = {
    getAll: () => StorageService.get('kop_funds', {}),
    save: (funds) => StorageService.set('kop_funds', funds),
    togglePayment: (memberId, month, year) => {
        const funds = FundsService.getAll();
        const key = `${memberId}_${year}`;
        if (!funds[key]) funds[key] = {};
        const amount = 50000;
        funds[key][month] = funds[key][month] ? null : { paid: true, amount, date: new Date().toISOString() };
        FundsService.save(funds);
    },
    getPayment: (memberId, month, year) => {
        const funds = FundsService.getAll();
        return funds[`${memberId}_${year}`]?.[month] || null;
    }
};

// Utility
const formatRupiah = (amount) => {
    return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const user = AuthService.login(username, password);
        if (user) {
            onLogin(user);
        } else {
            setError('Username atau password salah');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
                        <Icon name="building2" size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">KEUDE</h1>
                    <p className="text-slate-500 text-sm mt-2">PT DAYA KARYA ENERGY</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Masukkan username"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Masukkan password"
                            required
                        />
                    </div>

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
                    >
                        Masuk
                    </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-6">Default: admin / admin123</p>
            </div>
        </div>
    );
};

// Sidebar component (truncated for brevity - will continue in next file segment)
