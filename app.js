// React hooks
const { useState, useEffect, useRef } = React;

// Icon component
// Icon component
const Icon = ({ name, size = 24, className = "" }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (window.lucide && ref.current) {
            // Convert kebab-case to PascalCase (e.g., 'arrow-right-left' -> 'ArrowRightLeft')
            const pascalName = name
                .split('-')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join('');

            const iconNode = window.lucide.icons[pascalName] || window.lucide.icons[name];

            if (iconNode) {
                const svgElement = window.lucide.createElement(iconNode);
                svgElement.setAttribute('width', size);
                svgElement.setAttribute('height', size);
                const existingClass = svgElement.getAttribute('class') || '';
                svgElement.setAttribute('class', `${existingClass} ${className}`.trim());
                ref.current.innerHTML = '';
                ref.current.appendChild(svgElement);
            } else {
                console.warn(`Icon not found: ${name} (tried ${pascalName})`);
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

const ActivityLogService = {
    getAll: () => StorageService.get('kop_activity_log', []),
    add: (action, description, details = null) => {
        const logs = ActivityLogService.getAll();
        const user = StorageService.get('kop_user_session');
        const newLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            action,
            description,
            details,
            user: user ? user.username : 'system'
        };
        logs.unshift(newLog);
        if (logs.length > 100) logs.pop();
        StorageService.set('kop_activity_log', logs);
        return newLog;
    },
    clear: () => StorageService.remove('kop_activity_log')
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
        ActivityLogService.add('MEMBER_ADD', `Menambahkan anggota baru: ${member.name}`, { memberId: member.id });
        return member;
    },
    update: (id, data) => {
        const members = MemberService.getAll();
        const index = members.findIndex(m => m.id === id);
        if (index !== -1) {
            members[index] = { ...members[index], ...data, updatedAt: new Date().toISOString() };
            MemberService.save(members);
            ActivityLogService.add('MEMBER_UPDATE', `Mengubah data anggota: ${members[index].name}`, { memberId: id });
        }
    },
    delete: (id) => {
        const members = MemberService.getAll();
        const member = members.find(m => m.id === id);
        if (member) {
            const newMembers = members.filter(m => m.id !== id);
            MemberService.save(newMembers);
            ActivityLogService.add('MEMBER_DELETE', `Menghapus anggota: ${member.name}`, { memberId: id });
        }
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
        ActivityLogService.add('TRANSACTION_ADD', `Menambahkan transaksi ${transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} sebesar ${formatRupiah(transaction.amount)}`, { transactionId: transaction.id });
        return transaction;
    },
    update: (id, data) => {
        const transactions = TransactionService.getAll();
        const index = transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            transactions[index] = { ...transactions[index], ...data };
            TransactionService.save(transactions);
            ActivityLogService.add('TRANSACTION_UPDATE', `Mengubah transaksi ${id}`, { transactionId: id });
        }
    },
    delete: (id) => {
        const transactions = TransactionService.getAll().filter(t => t.id !== id);
        TransactionService.save(transactions);
        ActivityLogService.add('TRANSACTION_DELETE', `Menghapus transaksi ${id}`, { transactionId: id });
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
        ActivityLogService.add('FUNDS_UPDATE', `Update status pembayaran ${month}/${year} untuk member ${memberId}`, { memberId, month, year });
    },
    getPayment: (memberId, month, year) => {
        const funds = FundsService.getAll();
        return funds[`${memberId}_${year}`]?.[month] || null;
    }
};

const DividendService = {
    getSettings: () => StorageService.get('kop_dividend_settings', {
        retainedEarnings: 40,
        dividends: 25,
        directors: 10,
        commissioners: 5,
        employees: 10,
        csr: 10
    }),
    saveSettings: (settings) => {
        StorageService.set('kop_dividend_settings', settings);
        ActivityLogService.add('DIVIDEND_SETTINGS_UPDATE', 'Mengubah pengaturan dividen');
    },
    getCapital: () => StorageService.get('kop_initial_capital', 100000000),
    saveCapital: (amount) => {
        StorageService.set('kop_initial_capital', amount);
        ActivityLogService.add('CAPITAL_UPDATE', `Mengubah modal awal perusahaan menjadi ${formatRupiah(amount)}`);
    }
};

// Utilities
const formatRupiah = (amount) => {
    return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const numberToWords = (number) => {
    const units = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

    if (number < 12) return ' ' + units[number];
    if (number < 20) return numberToWords(number - 10) + ' Belas';
    if (number < 100) return numberToWords(Math.floor(number / 10)) + ' Puluh' + numberToWords(number % 10);
    if (number < 200) return ' Seratus' + numberToWords(number - 100);
    if (number < 1000) return numberToWords(Math.floor(number / 100)) + ' Ratus' + numberToWords(number % 100);
    if (number < 2000) return ' Seribu' + numberToWords(number - 1000);
    if (number < 1000000) return numberToWords(Math.floor(number / 1000)) + ' Ribu' + numberToWords(number % 1000);
    if (number < 1000000000) return numberToWords(Math.floor(number / 1000000)) + ' Juta' + numberToWords(number % 1000000);
    return '';
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

    const handleDemoLogin = (role) => {
        if (role === 'admin') {
            setUsername('admin');
            setPassword('admin123');
        } else {
            setUsername('pengurus');
            setPassword('user123');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 lg:p-0">
            <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[600px]">
                {/* Left Side - Branding */}
                <div className="w-full lg:w-1/2 p-12 flex flex-col justify-between relative bg-white">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl opacity-50"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-12">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                <Icon name="zap" size={24} />
                            </div>
                            <div>
                                <h1 className="font-bold text-xl text-slate-900 tracking-tight leading-none">DAYA KARYA</h1>
                                <p className="text-[10px] text-blue-600 font-bold tracking-widest uppercase">ENERGY</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center flex-1 py-12">
                            <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
                                {/* Abstract Circles */}
                                <div className="absolute inset-0 border border-slate-100 rounded-full animate-[spin_10s_linear_infinite]"></div>
                                <div className="absolute inset-4 border border-slate-100 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                                <div className="absolute inset-8 border border-slate-100 rounded-full"></div>

                                {/* Center Card */}
                                <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 w-32 h-32 rounded-3xl shadow-2xl shadow-blue-600/40 flex items-center justify-center transform rotate-[-10deg] hover:rotate-0 transition-transform duration-500">
                                    <h2 className="text-3xl font-black text-white tracking-tighter">KEUDE</h2>
                                </div>

                                {/* Floating Elements */}
                                <div className="absolute top-10 right-0 bg-white p-3 rounded-xl shadow-lg border border-slate-100 flex items-center gap-2 animate-bounce delay-700">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-xs font-bold text-slate-600">Analisis Keuangan</span>
                                </div>
                                <div className="absolute bottom-10 left-0 bg-white p-3 rounded-xl shadow-lg border border-slate-100 flex items-center gap-2 animate-bounce delay-1000">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span className="text-xs font-bold text-slate-600">Data Terintegrasi</span>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">Sistem Keuangan Terintegrasi</h2>
                            <p className="text-slate-500 text-center text-sm leading-relaxed max-w-xs">
                                Platform manajemen keuangan PT Daya Karya Energy untuk efisiensi operasional dan transparansi arus kas perusahaan.
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 text-center lg:text-left">
                        <p className="text-xs text-slate-400">© 2025 PT Daya Karya Energy. Internal Use Only.</p>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="w-full lg:w-1/2 bg-slate-900 p-12 flex flex-col justify-center text-white relative overflow-hidden">
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
                        <div className="absolute top-[-20%] right-[-20%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[100px]"></div>
                    </div>

                    <div className="relative z-10 max-w-md mx-auto w-full">
                        <div className="mb-10">
                            <h2 className="text-3xl font-bold mb-2">Selamat Datang</h2>
                            <p className="text-slate-400">Silakan login untuk mengakses dashboard KEUDE.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">ID Pengguna</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Icon name="user" size={18} className="text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent block w-full pl-11 p-3.5 placeholder-slate-500 transition-all"
                                        placeholder="Masukkan username"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Kata Sandi</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Icon name="lock" size={18} className="text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent block w-full pl-11 p-3.5 placeholder-slate-500 transition-all"
                                        placeholder="Masukkan password"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Lupa Password?</button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                                    <Icon name="alert-circle" size={16} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                            >
                                Masuk Sistem <Icon name="arrow-right" size={18} />
                            </button>
                        </form>

                        <div className="mt-10 pt-8 border-t border-slate-800">
                            <p className="text-xs text-slate-500 mb-4 text-center">Akun Demo (Klik untuk isi):</p>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleDemoLogin('admin')}
                                    className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-left transition-all group"
                                >
                                    <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">Admin</div>
                                    <div className="text-[10px] text-slate-500">admin / admin123</div>
                                </button>
                                <button
                                    onClick={() => handleDemoLogin('staf')}
                                    className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-left transition-all group"
                                >
                                    <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">Staf</div>
                                    <div className="text-[10px] text-slate-500">pengurus / user123</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};



const ActivityLogPanel = () => {
    const [logs, setLogs] = useState([]);
    const [isOpen, setIsOpen] = useState(true);

    const fetchLogs = () => {
        setLogs(ActivityLogService.getAll());
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleClear = () => {
        if (confirm('Bersihkan semua log aktivitas?')) {
            ActivityLogService.clear();
            fetchLogs();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="mb-6 bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all w-full"
            >
                <Icon name="activity" size={18} className="text-blue-600" />
                Tampilkan Log Aktivitas
            </button>
        );
    }

    return (
        <div className="mb-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                    <Icon name="activity" size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-800 text-sm">Log Aktivitas Sistem</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleClear} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded">
                        Bersihkan
                    </button>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <Icon name="chevron-up" size={18} />
                    </button>
                </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {logs.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-4">Belum ada aktivitas tercatat.</p>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="flex gap-3 text-xs items-start">
                            <span className="text-slate-400 font-mono whitespace-nowrap text-[10px] mt-0.5">
                                {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                            </span>
                            <div className="flex-1">
                                <p className="text-slate-700 font-medium">
                                    <span className="text-blue-600 font-bold mr-1">[{log.user}]</span>
                                    {log.description}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [stats, setStats] = useState({
        income: 0,
        expense: 0,
        balance: 0,
        receivable: 25000000, // Mocked based on reference
        debt: 0,
        salaryExpense: 0,
        transactions: []
    });
    const [activeTooltip, setActiveTooltip] = useState(null);

    const tooltips = {
        balance: "Total uang tunai real-time yang tersedia di kas perusahaan.",
        profit: "Selisih total pemasukan dikurangi pengeluaran (Laba Bersih).",
        receivable: "Total tagihan/invoice yang belum dibayar oleh klien (Pending).",
        debt: "Kewajiban/tagihan yang belum dibayar oleh perusahaan.",
        tax: "Akumulasi pengeluaran khusus kategori Pajak.",
        salary: "Total pengeluaran untuk gaji karyawan."
    };

    useEffect(() => {
        const transactions = TransactionService.getAll();
        console.log("Dashboard Transactions:", transactions);

        // Real Cash Flow (Only Paid)
        const income = transactions
            .filter(t => t.type === 'income' && t.status === 'Lunas')
            .reduce((sum, t) => sum + t.amount, 0);

        const expense = transactions
            .filter(t => t.type === 'expense' && t.status === 'Lunas')
            .reduce((sum, t) => sum + t.amount, 0);

        // Pending (Receivable/Debt)
        const receivable = transactions
            .filter(t => t.type === 'income' && (t.status === 'Belum Dibayar' || t.status === 'Menunggu'))
            .reduce((sum, t) => sum + t.amount, 0);

        const debt = transactions
            .filter(t => t.type === 'expense' && (t.status === 'Belum Dibayar' || t.status === 'Menunggu'))
            .reduce((sum, t) => sum + t.amount, 0);

        // Tax Expense (Total of 'Pajak' category expenses)
        const taxExpense = transactions
            .filter(t => t.type === 'expense' && (t.category === 'Pajak' || (t.category && t.category.toLowerCase().includes('pajak'))))
            .reduce((sum, t) => sum + t.amount, 0);

        // Salary Expense
        const salaryExpense = transactions
            .filter(t => t.type === 'expense' && (t.category === 'Gaji Karyawan' || (t.category && t.category.toLowerCase().includes('gaji'))))
            .reduce((sum, t) => sum + t.amount, 0);

        console.log("Calculated Salary Expense:", salaryExpense);

        setStats({
            income,
            expense,
            balance: income - expense,
            receivable,
            debt,
            taxExpense,
            salaryExpense,
            transactions: transactions.slice(0, 5)
        });
    }, []);

    const formatDate = (dateString) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString || new Date()).toLocaleDateString('id-ID', options);
    };

    return (
        <div className="space-y-8 relative">
            <ActivityLogPanel />
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Dashboard Keuangan PT DKE</h2>
                    <p className="text-slate-500">Ringkasan arus kas, piutang, dan performa proyek</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 shadow-sm">
                    {formatDate(new Date())}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                    onMouseEnter={() => setActiveTooltip('balance')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-help"
                >
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                        <Icon name="wallet" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Saldo Kas Real</p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatRupiah(stats.balance)}</h3>
                </div>
                <div
                    onMouseEnter={() => setActiveTooltip('profit')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-help"
                >
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-4">
                        <Icon name="trending-up" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Laba Bersih Real</p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatRupiah(stats.balance)}</h3>
                </div>
                <div
                    onMouseEnter={() => setActiveTooltip('receivable')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-help"
                >
                    <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center text-yellow-600 mb-4">
                        <Icon name="clock" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Piutang (Pending)</p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatRupiah(stats.receivable)}</h3>
                </div>
                <div
                    onMouseEnter={() => setActiveTooltip('debt')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-help"
                >
                    <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center text-red-600 mb-4">
                        <Icon name="alert-circle" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Hutang (Unpaid)</p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatRupiah(stats.debt)}</h3>
                </div>
                <div
                    onMouseEnter={() => setActiveTooltip('tax')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-help"
                >
                    <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600 mb-4">
                        <Icon name="file-text" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Beban Pajak</p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatRupiah(stats.taxExpense || 0)}</h3>
                </div>
                <div
                    onMouseEnter={() => setActiveTooltip('salary')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-help"
                >
                    <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600 mb-4">
                        <Icon name="users" size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Beban Gaji Karyawan</p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatRupiah(stats.salaryExpense || 0)}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Transactions Table */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Transaksi Terakhir</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="pb-4">TANGGAL</th>
                                    <th className="pb-4">DESKRIPSI / KATEGORI</th>
                                    <th className="pb-4">STATUS</th>
                                    <th className="pb-4 text-right">NOMINAL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stats.transactions.map((trx, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50">
                                        <td className="py-4 text-sm text-slate-500">{trx.date}</td>
                                        <td className="py-4">
                                            <p className="text-sm font-medium text-slate-900">{trx.description}</p>
                                            <p className="text-xs text-slate-500 capitalize">{trx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</p>
                                        </td>
                                        <td className="py-4">
                                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">Lunas</span>
                                        </td>
                                        <td className={`py-4 text-right text-sm font-bold ${trx.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
                                            {trx.type === 'income' ? '+' : '-'}{formatRupiah(trx.amount)}
                                        </td>
                                    </tr>
                                ))}
                                {stats.transactions.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="py-8 text-center text-slate-400">Belum ada transaksi</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Statistics Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Statistik Keuangan</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Icon name="arrow-up-right" size={18} /></div>
                                    <span className="text-sm text-slate-600">Total Pemasukan Real</span>
                                </div>
                                <span className="font-bold text-slate-900">{formatRupiah(stats.income)}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Icon name="arrow-down-right" size={18} /></div>
                                    <span className="text-sm text-slate-600">Total Pengeluaran Real</span>
                                </div>
                                <span className="font-bold text-slate-900">{formatRupiah(stats.expense)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Icon name="file-text" size={20} className="text-blue-600" />
                            <h3 className="text-lg font-bold text-slate-900">Ringkasan Proyek & Jasa</h3>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Omzet Jasa (Lunas)</p>
                                <p className="text-xl font-bold text-slate-900">{formatRupiah(stats.income)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Tagihan Belum Dibayar Klien</p>
                                <p className="text-xl font-bold text-yellow-600">{formatRupiah(stats.receivable)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Tooltip Toast */}
            {
                activeTooltip && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-[bounce-in_0.3s_ease-out] flex items-center gap-3 border border-slate-700">
                        <Icon name="info" size={18} className="text-blue-400" />
                        <span className="text-sm font-medium">{tooltips[activeTooltip]}</span>
                    </div>
                )
            }
        </div >
    );
};

const Members = () => {
    const [members, setMembers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        type: 'karyawan',
        name: '',
        company: '',
        nik: '',
        bankName: '',
        accountNumber: '',
        joinDate: new Date().toISOString().split('T')[0],
        initialFund: '',
        initialFundStatus: 'LUNAS',
        status: 'Aktif'
    });

    useEffect(() => {
        setMembers(MemberService.getAll());
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = {
            ...formData,
            initialFund: parseFloat(formData.initialFund) || 0
        };

        if (editingId) {
            const updatedMembers = members.map(m => m.id === editingId ? { ...dataToSave, id: editingId } : m);
            MemberService.save(updatedMembers);
            setMembers(updatedMembers);
        } else {
            MemberService.add(dataToSave);
            setMembers(MemberService.getAll());
        }
        setShowModal(false);
        resetForm();
    };

    const handleEdit = (member) => {
        setFormData(member);
        setEditingId(member.id);
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            type: 'karyawan',
            name: '',
            company: '',
            nik: '',
            bankName: '',
            accountNumber: '',
            joinDate: new Date().toISOString().split('T')[0],
            initialFund: '',
            initialFundStatus: 'LUNAS',
            status: 'Aktif'
        });
    };

    const handleDelete = (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
            const updated = members.filter(m => m.id !== id);
            MemberService.save(updated);
            setMembers(updated);
        }
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.company && m.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Manajemen Karyawan & Klien</h2>
                    <p className="text-slate-500">Daftar lengkap karyawan internal dan klien eksternal</p>
                </div>
                <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all hover:shadow-md">
                    <Icon name="plus" size={20} /> Tambah Data
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Cari nama, ID Karyawan, atau perusahaan..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4 w-16">NO</th>
                                <th className="px-6 py-4">ID / NIK</th>
                                <th className="px-6 py-4">NAMA / PERUSAHAAN</th>
                                <th className="px-6 py-4">INFO BANK</th>
                                <th className="px-6 py-4">TANGGAL</th>
                                <th className="px-6 py-4">DANA AWAL</th>
                                <th className="px-6 py-4 text-center">STATUS</th>
                                <th className="px-6 py-4 text-center">AKSI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredMembers.map((member, index) => (
                                <tr key={member.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 text-sm text-slate-400">{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{member.nik || '-'}</div>
                                        <div className="text-xs font-bold text-blue-500 uppercase mt-0.5">{member.type}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{member.name}</div>
                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                            {member.type === 'karyawan' && <Icon name="building-2" size={12} />}
                                            {member.company || 'PT Daya Karya Energy'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-slate-700">{member.bankName || '-'}</div>
                                        <div className="text-xs text-slate-500 font-mono">{member.accountNumber || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded w-fit">
                                            In: {member.joinDate}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{member.initialFund ? formatRupiah(member.initialFund) : '-'}</div>
                                        {member.initialFund > 0 && (
                                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-0.5">{member.initialFundStatus}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${member.status === 'Aktif' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {member.status || 'Aktif'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(member)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Icon name="edit-2" size={16} /></button>
                                            <button onClick={() => handleDelete(member.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icon name="trash-2" size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Icon name="search-x" size={32} className="text-slate-200" />
                                            <p>Data tidak ditemukan</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Data' : 'Tambah Data Baru'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><Icon name="x" size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Tipe Data</label>
                                    <select
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="karyawan">Karyawan Internal</option>
                                        <option value="klien">Klien Eksternal</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">ID / NIK</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder={formData.type === 'karyawan' ? 'EMP-001' : 'KLIEN-001'}
                                        value={formData.nik}
                                        onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Perusahaan / Departemen</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="PT Daya Karya Energy"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Nama Bank</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="BCA / Mandiri"
                                        value={formData.bankName}
                                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Nomor Rekening</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.accountNumber}
                                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Dana Awal (Rp)</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.initialFund}
                                        onChange={(e) => setFormData({ ...formData, initialFund: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Tanggal Bergabung</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={formData.joinDate}
                                        onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">Batal</button>
                                <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg shadow-blue-600/20 transition-all">Simpan Data</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
const Transactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [members, setMembers] = useState([]);
    const [type, setType] = useState('income'); // income, expense
    const [editingId, setEditingId] = useState(null);
    const fileInputRef = useRef(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        status: 'Lunas', // Lunas, Belum Dibayar, Menunggu, Dibatalkan
        relatedMemberId: '',
        category: '',
        customCategory: '',
        description: '',
        amount: '',
        attachment: null
    });

    useEffect(() => {
        setTransactions(TransactionService.getAll());
        setMembers(MemberService.getAll());
    }, []);

    const handleCategorySelect = (cat) => {
        setFormData({ ...formData, category: cat, customCategory: '' });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData({ ...formData, attachment: file });
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const finalCategory = formData.category === 'Pajak' ? (formData.customCategory || 'Pajak') : formData.category;

        const dataToSave = {
            ...formData,
            type,
            category: finalCategory,
            amount: parseFloat(formData.amount) || 0
        };

        if (editingId) {
            TransactionService.update(editingId, dataToSave);
            setEditingId(null);
            alert('Transaksi berhasil diperbarui!');
        } else {
            TransactionService.add(dataToSave);
            alert('Transaksi berhasil disimpan!');
        }

        setTransactions(TransactionService.getAll());
        // Reset form but keep date
        setFormData({
            date: formData.date,
            status: 'Lunas',
            relatedMemberId: '',
            category: '',
            customCategory: '',
            description: '',
            amount: '',
            attachment: null
        });
    };

    const handleEdit = (trx) => {
        setEditingId(trx.id);
        setType(trx.type);
        setFormData({
            date: trx.date,
            status: trx.status,
            relatedMemberId: trx.relatedMemberId || '',
            category: categories.includes(trx.category) ? trx.category : 'Pajak',
            customCategory: categories.includes(trx.category) ? '' : trx.category,
            description: trx.description,
            amount: trx.amount,
            attachment: trx.attachment
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            status: 'Lunas',
            relatedMemberId: '',
            category: '',
            customCategory: '',
            description: '',
            amount: '',
            attachment: null
        });
    };

    const handleDelete = (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
            TransactionService.delete(id);
            setTransactions(TransactionService.getAll());
        }
    };

    const categories = ['Jasa Pekerjaan', 'Jasa Konsultasi', 'Gaji Karyawan', 'Investasi', 'Pajak'];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                    <Icon name="arrow-right-left" size={24} className="text-blue-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{editingId ? 'Edit Transaksi' : 'Input Transaksi'}</h2>
                    <p className="text-slate-500">{editingId ? 'Perbarui data transaksi yang dipilih' : 'Catat arus kas masuk dan keluar perusahaan'}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-3xl">
                {/* Type Toggle */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => setType('income')}
                        className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${type === 'income' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        <Icon name="plus" size={20} /> PEMASUKAN
                    </button>
                    <button
                        onClick={() => setType('expense')}
                        className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${type === 'expense' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        <Icon name="minus" size={20} /> PENGELUARAN
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Transaksi</label>
                            <input
                                type="date"
                                required
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Status Pembayaran</label>
                            <select
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="Lunas">Lunas (Paid)</option>
                                <option value="Belum Dibayar">Belum Dibayar (Unpaid)</option>
                                <option value="Menunggu">Menunggu (Pending)</option>
                                <option value="Dibatalkan">Dibatalkan (Cancelled)</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Terkait Karyawan/Klien (Opsional)</label>
                        <select
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            value={formData.relatedMemberId}
                            onChange={(e) => setFormData({ ...formData, relatedMemberId: e.target.value })}
                        >
                            <option value="">-- Umum / Tidak Ada --</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name} - {m.company || 'Internal'}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase">Kategori (Fleksibel)</label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => handleCategorySelect(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${formData.category === cat ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="Ketik kategori baru atau pilih di atas..."
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            value={formData.category === 'Pajak' ? formData.customCategory : (categories.includes(formData.category) ? '' : formData.category)}
                            onChange={(e) => setFormData({ ...formData, category: 'Pajak', customCategory: e.target.value })}
                            disabled={categories.includes(formData.category) && formData.category !== 'Pajak'}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Deskripsi Pekerjaan / Transaksi</label>
                        <textarea
                            rows="3"
                            placeholder="Contoh: Pembayaran Termin 1 Proyek Instalasi Listrik..."
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nominal (Rp)</label>
                        <input
                            type="number"
                            required
                            placeholder="Rp 0"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-lg"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Lampiran Bukti (Opsional)</label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                            accept="image/*,.pdf"
                        />
                        <div
                            onClick={() => fileInputRef.current.click()}
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer group ${formData.attachment ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                            {formData.attachment ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 text-blue-600">
                                        <Icon name="file-check" size={24} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">{formData.attachment.name}</p>
                                    <p className="text-xs text-slate-500 mt-1">Klik untuk ganti file</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                        <Icon name="upload" size={24} className="text-slate-400" />
                                    </div>
                                    <p className="text-sm text-slate-500">Klik untuk upload bukti struk/invoice/nota</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                            >
                                Batal Edit
                            </button>
                        )}
                        <button
                            type="submit"
                            className={`flex-[2] py-4 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-1 ${type === 'income' ? 'bg-blue-600 shadow-blue-600/30 hover:bg-blue-700' : 'bg-red-600 shadow-red-600/30 hover:bg-red-700'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Icon name={editingId ? "save" : "check-circle"} size={20} />
                                {editingId ? 'Update Transaksi' : (type === 'income' ? 'Simpan Pemasukan' : 'Simpan Pengeluaran')}
                            </div>
                        </button>
                    </div>
                </form>
            </div>

            {/* Transaction History Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Riwayat Transaksi</h3>
                    <div className="text-sm text-slate-500">Total: {transactions.length} Transaksi</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Tanggal</th>
                                <th className="px-6 py-4">Kategori / Deskripsi</th>
                                <th className="px-6 py-4">Terkait</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Nominal</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {transactions.map((trx) => (
                                <tr key={trx.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{trx.date}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{trx.category}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{trx.description}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {trx.relatedMemberId ? (
                                            members.find(m => m.id === trx.relatedMemberId)?.name || '-'
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${trx.status === 'Lunas' ? 'bg-green-50 text-green-700' :
                                            trx.status === 'Belum Dibayar' ? 'bg-red-50 text-red-700' :
                                                'bg-yellow-50 text-yellow-700'
                                            }`}>
                                            {trx.status}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${trx.type === 'income' ? 'text-blue-600' : 'text-red-600'}`}>
                                        {trx.type === 'income' ? '+' : '-'}{formatRupiah(trx.amount)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleEdit(trx)}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                title="Edit Transaksi"
                                            >
                                                <Icon name="edit-2" size={14} /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(trx.id)}
                                                className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                title="Hapus Transaksi"
                                            >
                                                <Icon name="trash-2" size={14} /> Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Icon name="clipboard-list" size={32} className="text-slate-200" />
                                            <p>Belum ada riwayat transaksi</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const Funds = () => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [members, setMembers] = useState([]);
    const [fundsData, setFundsData] = useState({});
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
    const monthlyObligation = 50000;

    useEffect(() => {
        setMembers(MemberService.getAll().filter(m => m.type === 'karyawan'));
        setFundsData(FundsService.getAll());
    }, [year]);

    const handleToggle = (memberId, monthIndex) => {
        FundsService.togglePayment(memberId, monthIndex, year);
        setFundsData(FundsService.getAll());
    };

    const isPaid = (memberId, monthIndex) => {
        return fundsData[`${memberId}_${year}`]?.[monthIndex]?.paid;
    };

    // Calculate Totals
    const totalDanaPokok = members.reduce((sum, m) => sum + (parseFloat(m.initialFund) || 0), 0);

    const totalTabunganWajib = Object.keys(fundsData).reduce((sum, key) => {
        if (key.endsWith(`_${year}`)) {
            const monthlyPayments = fundsData[key];
            const monthlySum = Object.values(monthlyPayments).reduce((mSum, payment) => {
                return mSum + (payment?.paid ? (payment.amount || monthlyObligation) : 0);
            }, 0);
            return sum + monthlySum;
        }
        return sum;
    }, 0);

    return (
        <div className="space-y-8">
            {/* Header & Year Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Monitoring Dana Karyawan</h2>
                    <p className="text-slate-500">Kelola Dana Partisipasi dan Tabungan Wajib Karyawan</p>
                </div>
                <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <button onClick={() => setYear(year - 1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors"><Icon name="chevron-left" size={20} /></button>
                    <span className="font-bold text-slate-800 text-lg min-w-[60px] text-center">{year}</span>
                    <button onClick={() => setYear(year + 1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors"><Icon name="chevron-right" size={20} /></button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Dana Pokok */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-600/20 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Icon name="wallet" size={24} className="text-white" />
                            </div>
                            <span className="font-medium text-blue-100">Total Dana Pokok</span>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">{formatRupiah(totalDanaPokok)}</h3>
                        <p className="text-sm text-blue-200">@ Rp 1.500.000 / karyawan</p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                </div>

                {/* Total Tabungan Wajib */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Icon name="piggy-bank" size={24} className="text-blue-600" />
                            </div>
                            <span className="font-medium text-slate-600">Total Tabungan Wajib</span>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900 mb-1">{formatRupiah(totalTabunganWajib)}</h3>
                        <p className="text-sm text-slate-400">Akumulasi seluruh setoran</p>
                    </div>
                </div>

                {/* Kewajiban Bulanan */}
                <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Icon name="alert-circle" size={24} className="text-orange-600" />
                            </div>
                            <span className="font-medium text-orange-800">Kewajiban Bulanan</span>
                        </div>
                        <h3 className="text-3xl font-bold text-orange-900 mb-1">{formatRupiah(monthlyObligation)}</h3>
                        <p className="text-sm text-orange-700/80">Per karyawan / bulan</p>
                    </div>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Icon name="refresh-cw" size={18} className="text-slate-400" />
                        <h3 className="font-bold text-slate-800">Tabel Kontrol Pembayaran ({year})</h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium">
                        <div className="flex items-center gap-2">
                            <Icon name="check-circle-2" size={16} className="text-blue-500" />
                            <span className="text-slate-600">Lunas (Klik untuk batal)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200"></div>
                            <span className="text-slate-600">Belum (Klik untuk bayar)</span>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-white z-10 w-64">KARYAWAN</th>
                                <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-32 bg-slate-50/50">DANA AWAL</th>
                                {months.map(m => (
                                    <th key={m} className="px-2 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center min-w-[60px]">{m}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {members.map(member => (
                                <tr key={member.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10">
                                        <div className="font-bold text-slate-800">{member.name}</div>
                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{member.nik || '-'}</div>
                                    </td>
                                    <td className="px-4 py-4 text-center bg-slate-50/30">
                                        <div className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold w-full ${member.initialFundStatus === 'LUNAS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {member.initialFundStatus || 'BELUM'}
                                        </div>
                                    </td>
                                    {months.map((_, idx) => {
                                        const paid = isPaid(member.id, idx);
                                        return (
                                            <td key={idx} className="px-2 py-4 text-center">
                                                <button
                                                    onClick={() => handleToggle(member.id, idx)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 mx-auto ${paid ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30 scale-100' : 'bg-slate-100 text-slate-300 hover:bg-slate-200 hover:scale-110'}`}
                                                    title={paid ? 'Tandai Belum Bayar' : 'Tandai Lunas'}
                                                >
                                                    {paid ? <Icon name="check" size={16} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {members.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Icon name="users" size={32} className="text-slate-200" />
                                            <p>Belum ada data karyawan. Silakan tambahkan di menu Karyawan & Klien.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
const Documents = () => {
    const [activeTab, setActiveTab] = useState('penawaran');
    const [companyInfo, setCompanyInfo] = useState({
        name: 'PT DAYA KARYA ENERGY',
        address: 'Jl. Soekarno Hatta No. 55-57, Jakarta Selatan',
        phone: '(021) 555-1000',
        email: 'info@dayakarya.co.com',
        signatureTitle: 'Manajer Keuangan'
    });
    const [customerInfo, setCustomerInfo] = useState({ name: '', address: '' });
    const [docNumber, setDocNumber] = useState('DOC-2025-020');
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState([{ description: '', evidence: '', qty: 1, unit: 'Pcs', price: 0 }]);
    const [notes, setNotes] = useState('');
    const [recipientName, setRecipientName] = useState('[Nama Klien]');
    const [logoImage, setLogoImage] = useState(null);
    const [ppnRate, setPpnRate] = useState(11);
    const [kwitansiData, setKwitansiData] = useState({
        receivedFrom: '',
        address: '',
        amount: 0,
        amountWords: '',
        paymentFor: ''
    });

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setLogoImage(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const addItem = () => setItems([...items, { description: '', evidence: '', qty: 1, unit: 'Pcs', price: 0 }]);
    const removeItem = (index) => setItems(items.filter((_, i) => i !== index));
    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const calculateSubtotal = () => items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const calculatePPN = () => calculateSubtotal() * (ppnRate / 100);
    const calculateGrandTotal = () => calculateSubtotal() + calculatePPN();

    const handlePrint = () => window.print();
    const handleSave = () => alert('Dokumen disimpan ke Riwayat (Simulasi)');

    // Helper for amount input with dots
    const handleAmountChange = (e) => {
        const value = e.target.value.replace(/\./g, '');
        if (!isNaN(value)) {
            setKwitansiData({ ...kwitansiData, amount: parseFloat(value) || 0 });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Buat Dokumen Resmi</h2>
                    <p className="text-slate-500">Surat penawaran harga, invoice, dan berbagai lampiran</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg flex items-center gap-2">
                        <Icon name="file" size={16} /> Print PDF
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2">
                        <Icon name="save" size={16} /> Simpan
                    </button>
                </div>
            </div>

            <div className="flex gap-2 print:hidden border-b">
                {['penawaran', 'invoice', 'kwitansi', 'riwayat'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 font-medium capitalize transition-colors relative ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-800'}`}>
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'riwayat' ? (
                <div className="bg-white rounded-xl shadow-sm border p-6 text-center text-slate-400 py-12">
                    <p>Fitur riwayat akan segera tersedia</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border p-8 print:shadow-none print:border-0">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_auto] gap-8 mb-6">
                        <div className="flex items-start gap-4">
                            <div className="relative group">
                                <input type="file" id="logoUpload" accept="image/*" onChange={handleLogoUpload} className="hidden print:hidden" />
                                <label htmlFor="logoUpload" className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all bg-slate-50 print:border-0 print:cursor-default">
                                    {logoImage ? <img src={logoImage} alt="Logo" className="w-full h-full object-contain rounded-lg" /> : <div className="text-center p-2"><span className="text-xs text-slate-500">Logo (Klik)</span></div>}
                                </label>
                            </div>
                            <div>
                                <h1 contentEditable suppressContentEditableWarning onBlur={(e) => setCompanyInfo({ ...companyInfo, name: e.target.textContent })} className="text-xl font-bold text-slate-800 mb-1 outline-none focus:bg-blue-50 px-2 py-1 rounded">{companyInfo.name}</h1>
                                <p contentEditable suppressContentEditableWarning onBlur={(e) => setCompanyInfo({ ...companyInfo, address: e.target.textContent })} className="text-xs text-slate-600 outline-none focus:bg-slate-50 px-2 py-1 rounded">{companyInfo.address}</p>
                                <p className="text-xs text-slate-600 px-2">{companyInfo.phone} | {companyInfo.email}</p>
                            </div>
                        </div>
                        <div className="text-right bg-blue-600 text-white px-6 py-3 rounded-lg">
                            <h2 className="text-2xl font-bold uppercase tracking-wide">{activeTab === 'invoice' ? 'Invoice' : activeTab === 'penawaran' ? 'Penawaran Harga' : 'Kwitansi'}</h2>
                            <input
                                type="text"
                                value={docNumber}
                                onChange={(e) => setDocNumber(e.target.value)}
                                className="text-sm mt-1 bg-transparent text-white border-b border-white/20 focus:outline-none focus:border-white text-right w-32 placeholder-white/50"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-slate-200 my-6"></div>

                    {activeTab === 'kwitansi' ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kepada Yth.</label>
                                    <input type="text" value={kwitansiData.receivedFrom} onChange={(e) => setKwitansiData({ ...kwitansiData, receivedFrom: e.target.value })} className="w-full border-b border-slate-300 px-2 py-2 focus:outline-none focus:border-blue-500 print:border-0 font-medium" placeholder="Nama Klien / Perusahaan" />
                                    <input type="text" value={kwitansiData.address} onChange={(e) => setKwitansiData({ ...kwitansiData, address: e.target.value })} className="w-full border-b border-slate-200 px-2 py-1 focus:outline-none focus:border-blue-500 print:border-0 text-xs text-slate-400 mt-1" placeholder="Alamat Lengkap" />
                                </div>
                                <div className="text-right">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tanggal Dokumen</label>
                                    <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="border-b border-slate-300 px-2 py-2 focus:outline-none focus:border-blue-500 print:border-0 text-right" />
                                </div>
                            </div>

                            <div className="border-2 border-slate-900 p-8 rounded-none mt-8">
                                <div className="space-y-6">
                                    <div className="flex items-baseline">
                                        <span className="w-56 font-bold text-sm flex-shrink-0">SUDAH TERIMA DARI</span>
                                        <span className="flex-1 flex items-baseline"><span className="mx-2">:</span><input type="text" value={kwitansiData.receivedFrom} onChange={(e) => setKwitansiData({ ...kwitansiData, receivedFrom: e.target.value })} className="flex-1 border-0 border-b border-dotted border-slate-400 px-2 py-1 focus:outline-none focus:border-blue-600" placeholder="-" /></span>
                                    </div>
                                    <div className="flex items-baseline">
                                        <span className="w-56 font-bold text-sm flex-shrink-0">BANYAKNYA UANG</span>
                                        <span className="flex-1 flex items-baseline"><span className="mx-2">:</span><input type="text" value={kwitansiData.amountWords || (kwitansiData.amount > 0 ? numberToWords(Math.floor(kwitansiData.amount)) + ' Rupiah' : '')} onChange={(e) => setKwitansiData({ ...kwitansiData, amountWords: e.target.value })} className="flex-1 border-0 border-b border-dotted border-slate-400 px-2 py-1 focus:outline-none focus:border-blue-600 italic bg-blue-50" placeholder="Terbilang" /></span>
                                    </div>
                                    <div className="flex items-baseline">
                                        <span className="w-56 font-bold text-sm flex-shrink-0">UNTUK PEMBAYARAN</span>
                                        <span className="flex-1 flex items-baseline"><span className="mx-2">:</span><input type="text" value={kwitansiData.paymentFor} onChange={(e) => setKwitansiData({ ...kwitansiData, paymentFor: e.target.value })} className="flex-1 border-0 border-b border-dotted border-slate-400 px-2 py-1 focus:outline-none focus:border-blue-600" placeholder="- -" /></span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-8">
                                <div className="border-2 border-slate-900 px-12 py-6 min-w-[250px]">
                                    <div className="text-right">
                                        <input
                                            type="text"
                                            value={kwitansiData.amount ? formatRupiah(kwitansiData.amount).replace('Rp ', '') : ''}
                                            onChange={handleAmountChange}
                                            className="text-4xl font-bold text-right border-0 focus:outline-none w-full mb-2"
                                            placeholder="0"
                                        />
                                        <p className="text-sm text-slate-500">Rupiah</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {/* Penawaran/Invoice Content */}
                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kepada Yth.</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} className="border-b border-slate-200 px-2 py-2 focus:outline-none focus:border-blue-500 print:border-0" placeholder="Nama Klien / Perusahaan" />
                                    <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="border-b border-slate-200 px-2 py-2 focus:outline-none focus:border-blue-500 print:border-0 text-sm" />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Alamat Lengkap</p>
                            </div>

                            <div className="mb-6">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="text-left px-3 py-3 border border-slate-200 font-semibold text-slate-700 w-12">No</th>
                                            <th className="text-left px-3 py-3 border border-slate-200 font-semibold text-slate-700">Deskripsi</th>
                                            <th className="text-center px-3 py-3 border border-slate-200 font-semibold text-slate-700 w-16">Qty</th>
                                            <th className="text-right px-3 py-3 border border-slate-200 font-semibold text-slate-700 w-28">Harga</th>
                                            <th className="text-right px-3 py-3 border border-slate-200 font-semibold text-slate-700 w-32">Total</th>
                                            <th className="px-3 py-3 border border-slate-200 w-12 print:hidden"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, index) => (
                                            <tr key={index} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 border border-slate-200 text-center text-slate-500">{index + 1}</td>
                                                <td className="px-3 py-2 border border-slate-200"><input type="text" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} className="w-full px-2 py-1 focus:outline-none focus:bg-blue-50 rounded" placeholder="Nama Barang" /></td>
                                                <td className="px-3 py-2 border border-slate-200 text-center"><input type="number" value={item.qty} onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 0)} className="w-full text-center px-2 py-1 focus:outline-none focus:bg-blue-50 rounded" /></td>
                                                <td className="px-3 py-2 border border-slate-200 text-right"><input type="number" value={item.price} onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)} className="w-full text-right px-2 py-1 focus:outline-none focus:bg-blue-50 rounded" /></td>
                                                <td className="px-3 py-2 border border-slate-200 text-right font-medium text-slate-800">{formatRupiah(item.qty * item.price)}</td>
                                                <td className="px-3 py-2 border border-slate-200 text-center print:hidden"><button onClick={() => removeItem(index)} className="text-red-600 hover:text-red-800 text-xs px-2 py-1 hover:bg-red-50 rounded" disabled={items.length === 1}>✕</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button onClick={addItem} className="mt-3 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-medium print:hidden flex items-center gap-2">+ Tambah Baris</button>
                            </div>

                            <div className="flex justify-end mb-6">
                                <div className="w-80 space-y-2">
                                    <div className="flex justify-between items-center py-2 border-b border-slate-200"><span className="font-bold text-sm text-slate-700 uppercase">TOTAL JUMLAH</span><span className="text-lg font-bold text-slate-800">{formatRupiah(calculateSubtotal())}</span></div>
                                    <div className="flex justify-between items-center py-2 print:hidden"><div className="flex items-center gap-2"><span className="text-sm text-slate-600">PPN</span><input type="number" value={ppnRate} onChange={(e) => setPpnRate(parseFloat(e.target.value) || 0)} className="w-16 text-center px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500" /><span className="text-xs text-slate-500">%</span></div><span className="text-sm font-semibold text-slate-700">{formatRupiah(calculatePPN())}</span></div>
                                    <div className="flex justify-between items-center py-3 border-t-2 border-slate-800 bg-slate-50 px-3 -mx-3 print:bg-white"><span className="font-bold text-slate-800 uppercase">Grand Total</span><span className="text-xl font-bold text-blue-600">{formatRupiah(calculateGrandTotal())}</span></div>
                                </div>
                            </div>
                            <div className="mb-6"><p className="text-sm text-slate-600"><span className="font-semibold">Terbilang:</span> <span className="italic">{numberToWords(Math.floor(calculateGrandTotal()))} Rupiah</span></p></div>
                            <div className="mb-8 bg-slate-50 rounded-lg p-4"><label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Catatan</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" rows="3" placeholder="Catatan..." /></div>
                        </div>
                    )}

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 mt-12">
                        <div className="text-center"><p className="text-sm text-slate-600 mb-20">Penerima,</p><div className="border-t border-slate-300 pt-2 inline-block min-w-[200px]"><p contentEditable suppressContentEditableWarning onBlur={(e) => setRecipientName(e.target.textContent)} className="text-sm font-medium outline-none focus:bg-blue-50 px-2 py-1 rounded cursor-text">{recipientName}</p></div></div>
                        <div className="text-center"><p className="text-sm text-slate-600 mb-20">Hormat Kami,</p><div className="border-t border-slate-300 pt-2 inline-block min-w-[200px]"><p contentEditable suppressContentEditableWarning onBlur={(e) => setCompanyInfo({ ...companyInfo, name: e.target.textContent })} className="text-sm font-bold outline-none focus:bg-blue-50 px-2 py-1 rounded cursor-text">{companyInfo.name}</p><p contentEditable suppressContentEditableWarning onBlur={(e) => setCompanyInfo({ ...companyInfo, signatureTitle: e.target.textContent })} className="text-xs text-slate-500 mt-1 outline-none focus:bg-blue-50 px-2 py-1 rounded cursor-text">{companyInfo.signatureTitle}</p></div></div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Dividends = () => {
    const [settings, setSettings] = useState(DividendService.getSettings());
    const [capital, setCapital] = useState(DividendService.getCapital());
    const [netProfit, setNetProfit] = useState(0);
    const [additionalCapital, setAdditionalCapital] = useState(0);
    const [isEditingCapital, setIsEditingCapital] = useState(false);

    useEffect(() => {
        // Calculate Net Profit
        const transactions = TransactionService.getAll();
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        setNetProfit(income - expense);

        // Calculate Additional Capital (Member Funds)
        const members = MemberService.getAll();
        const totalFunds = members.reduce((sum, m) => sum + (parseFloat(m.initialFund) || 0), 0);
        setAdditionalCapital(totalFunds);
    }, []);

    const handleSettingChange = (key, value) => {
        const newSettings = { ...settings, [key]: parseFloat(value) || 0 };
        setSettings(newSettings);
    };

    const handleSaveSettings = () => {
        const total = Object.values(settings).reduce((a, b) => a + b, 0);
        if (total !== 100) {
            alert(`Total persentase harus 100%. Saat ini: ${total}%`);
            return;
        }
        DividendService.saveSettings(settings);
        alert('Pengaturan berhasil disimpan!');
    };

    const handleSaveCapital = () => {
        DividendService.saveCapital(parseFloat(capital) || 0);
        setIsEditingCapital(false);
    };

    const totalEquity = capital + additionalCapital + (netProfit * (settings.retainedEarnings / 100));
    const totalPercentage = Object.values(settings).reduce((a, b) => a + b, 0);

    const allocations = [
        { id: 'retainedEarnings', label: 'Laba Ditahan (Retained Earnings)', color: 'bg-blue-500' },
        { id: 'dividends', label: 'Dividen Pemegang Saham', color: 'bg-green-500' },
        { id: 'directors', label: 'Bonus Direksi', color: 'bg-purple-500' },
        { id: 'commissioners', label: 'Bonus Komisaris', color: 'bg-orange-500' },
        { id: 'employees', label: 'Bonus Karyawan', color: 'bg-pink-500' },
        { id: 'csr', label: 'CSR (Dana Sosial)', color: 'bg-teal-500' }
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                    <Icon name="pie-chart" size={24} className="text-blue-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Alokasi Laba & Dividen</h2>
                    <p className="text-slate-500">Atur pembagian keuntungan bersih (Net Profit) perusahaan</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* Net Profit Card */}
                    <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg shadow-blue-600/20 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2 text-blue-100">
                                <Icon name="trending-up" size={20} />
                                <span className="font-medium">Laba Bersih Tahun Berjalan</span>
                            </div>
                            <h3 className="text-4xl font-bold mb-2">{formatRupiah(netProfit)}</h3>
                            <p className="text-blue-200 text-sm">Profit murni setelah dikurangi biaya operasional.</p>
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                            <Icon name="dollar-sign" size={200} />
                        </div>
                    </div>

                    {/* Capital Position */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Icon name="briefcase" size={20} className="text-blue-600" />
                            <h3 className="text-lg font-bold text-slate-800">Posisi Modal Perusahaan</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="pb-6 border-b border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-slate-500 text-sm">Modal Disetor Awal</span>
                                    {!isEditingCapital ? (
                                        <button onClick={() => setIsEditingCapital(true)} className="text-blue-600 text-xs font-bold hover:underline">Edit</button>
                                    ) : (
                                        <button onClick={handleSaveCapital} className="text-green-600 text-xs font-bold hover:underline">Simpan</button>
                                    )}
                                </div>
                                {isEditingCapital ? (
                                    <input
                                        type="number"
                                        value={capital}
                                        onChange={(e) => setCapital(e.target.value)}
                                        className="w-full p-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <p className="text-xl font-bold text-slate-900">{formatRupiah(capital)}</p>
                                )}
                            </div>

                            <div className="pb-6 border-b border-slate-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon name="plus-circle" size={16} className="text-green-500" />
                                    <span className="text-slate-500 text-sm">Tambahan Modal</span>
                                </div>
                                <p className="text-xl font-bold text-green-600">{formatRupiah(additionalCapital)}</p>
                                <p className="text-xs text-slate-400 mt-1">Dari Tabungan & Suntikan Dana</p>
                            </div>

                            <div>
                                <span className="text-slate-500 text-sm font-bold">Total Ekuitas</span>
                                <div className="flex justify-between items-end mt-1">
                                    <p className="text-2xl font-bold text-slate-800">{formatRupiah(totalEquity)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Projection */}
                    <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                        <h4 className="font-bold text-blue-800 mb-4">Proyeksi Tahun Depan</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-blue-600">Ekuitas Saat Ini:</span>
                                <span className="font-medium text-slate-700">{formatRupiah(totalEquity)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-blue-600">(+) Laba Ditahan:</span>
                                <span className="font-medium text-slate-700">{formatRupiah(netProfit * (settings.retainedEarnings / 100))}</span>
                            </div>
                            <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-bold">
                                <span className="text-blue-800">Estimasi Ekuitas:</span>
                                <span className="text-blue-900">{formatRupiah(totalEquity + (netProfit * (settings.retainedEarnings / 100)))}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    {/* Configuration */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <Icon name="sliders" size={20} className="text-slate-400" />
                                <h3 className="text-lg font-bold text-slate-800">Konfigurasi Persentase</h3>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${totalPercentage === 100 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                Total: {totalPercentage}%
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {allocations.map((item, idx) => (
                                <div key={item.id} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</span>
                                        <label className="text-xs font-bold text-slate-500 uppercase">{item.label}</label>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={settings[item.id]}
                                            onChange={(e) => handleSettingChange(item.id, e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-700"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleSaveSettings}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all hover:scale-105"
                            >
                                <Icon name="save" size={20} /> Simpan & Hitung Ulang
                            </button>
                        </div>
                    </div>

                    {/* Distribution Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">Rincian Pembagian (Rp)</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Pos Alokasi</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Persentase</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Nilai Rupiah</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {allocations.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                                                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-block px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">
                                                    {settings[item.id]}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900">
                                                {formatRupiah(netProfit * (settings[item.id] / 100))}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50/50">
                                        <td className="px-6 py-4 font-bold text-slate-800 uppercase text-sm">Total Laba Dibagi</td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-800">{totalPercentage}%</td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900 text-lg">{formatRupiah(netProfit * (totalPercentage / 100))}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Reports = () => {
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [stats, setStats] = useState({
        income: 0,
        expense: 0,
        netProfit: 0,
        receivable: 0,
        savings: 0
    });

    useEffect(() => {
        const allTransactions = TransactionService.getAll();
        setTransactions(allTransactions);
    }, []);

    useEffect(() => {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        const filtered = transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= start && tDate <= end;
        });

        setFilteredTransactions(filtered);

        const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const savings = filtered.filter(t => t.category === 'Tabungan Karyawan' || t.category === 'Simpanan Wajib').reduce((sum, t) => sum + t.amount, 0);
        const receivable = 0;

        // Chart Data (Group by Month)
        const monthlyData = {};
        filtered.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });

            if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0, month: label };
            if (t.type === 'income') monthlyData[key].income += t.amount;
            if (t.type === 'expense') monthlyData[key].expense += t.amount;
        });

        const chartData = Object.keys(monthlyData).sort().map(key => monthlyData[key]);

        setStats({
            income,
            expense,
            netProfit: income - expense,
            receivable,
            savings,
            chartData
        });
    }, [transactions, dateRange]);

    const handleExportExcel = () => {
        const headers = ['Tanggal', 'Kategori', 'Deskripsi', 'Status', 'Nominal', 'Tipe'];
        const csvContent = [
            headers.join(','),
            ...filteredTransactions.map(t => [
                t.date,
                `"${t.category}"`,
                `"${t.description}"`,
                t.status,
                t.amount,
                t.type
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Laporan_Keuangan_${dateRange.start}_sd_${dateRange.end}.csv`;
        link.click();
    };

    const handleDelete = (id) => {
        if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
            TransactionService.delete(id);
            setTransactions(TransactionService.getAll());
        }
    };

    const maxVal = Math.max(stats.income, stats.expense, 1);
    const incomeHeight = (stats.income / maxVal) * 100;
    const expenseHeight = (stats.expense / maxVal) * 100;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Laporan Keuangan PT DKE</h2>
                    <p className="text-slate-500">Analisis Laba Rugi dan Arus Kas Periode Ini</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all">
                        <Icon name="file-spreadsheet" size={18} /> Export Excel
                    </button>
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all">
                        <Icon name="printer" size={18} /> Print PDF
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <Icon name="filter" size={20} className="text-blue-600" />
                    <span>Filter Periode:</span>
                </div>
                <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="text-slate-400">-</span>
                <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <div className="ml-auto text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                    Menampilkan {filteredTransactions.length} transaksi
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-bold text-slate-800">Grafik Arus Kas (Realized)</h3>
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">Periode Terpilih</span>
                    </div>

                    <div className="relative h-64 w-full mt-4">
                        {stats.chartData && stats.chartData.length > 0 ? (
                            <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                {/* Grid Lines */}
                                {[0, 100, 200, 300, 400].map(y => (
                                    <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5" />
                                ))}

                                {/* Income Area & Line */}
                                <path
                                    d={`M0,400 ${stats.chartData.map((d, i) => `L${(i / (stats.chartData.length - 1 || 1)) * 1000},${400 - (d.income / (Math.max(...stats.chartData.map(c => Math.max(c.income, c.expense))) * 1.2 || 1)) * 400}`).join(' ')} L1000,400 Z`}
                                    fill="url(#reportIncomeGradient)"
                                    opacity="0.2"
                                />
                                <polyline
                                    points={stats.chartData.map((d, i) => `${(i / (stats.chartData.length - 1 || 1)) * 1000},${400 - (d.income / (Math.max(...stats.chartData.map(c => Math.max(c.income, c.expense))) * 1.2 || 1)) * 400}`).join(' ')}
                                    fill="none"
                                    stroke="#2563eb"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {/* Expense Area & Line */}
                                <path
                                    d={`M0,400 ${stats.chartData.map((d, i) => `L${(i / (stats.chartData.length - 1 || 1)) * 1000},${400 - (d.expense / (Math.max(...stats.chartData.map(c => Math.max(c.income, c.expense))) * 1.2 || 1)) * 400}`).join(' ')} L1000,400 Z`}
                                    fill="url(#reportExpenseGradient)"
                                    opacity="0.2"
                                />
                                <polyline
                                    points={stats.chartData.map((d, i) => `${(i / (stats.chartData.length - 1 || 1)) * 1000},${400 - (d.expense / (Math.max(...stats.chartData.map(c => Math.max(c.income, c.expense))) * 1.2 || 1)) * 400}`).join(' ')}
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {/* Gradients */}
                                <defs>
                                    <linearGradient id="reportIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                                    </linearGradient>
                                    <linearGradient id="reportExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                                    </linearGradient>
                                </defs>

                                {/* Points & Tooltips */}
                                {stats.chartData.map((d, i) => {
                                    const maxVal = Math.max(...stats.chartData.map(c => Math.max(c.income, c.expense))) * 1.2 || 1;
                                    const x = (i / (stats.chartData.length - 1 || 1)) * 1000;
                                    const yIncome = 400 - (d.income / maxVal) * 400;
                                    const yExpense = 400 - (d.expense / maxVal) * 400;

                                    return (
                                        <g key={i} className="group">
                                            <circle cx={x} cy={yIncome} r="6" className="fill-blue-600 transition-all duration-300 group-hover:r-8" />
                                            <circle cx={x} cy={yExpense} r="6" className="fill-red-500 transition-all duration-300 group-hover:r-8" />

                                            {/* Tooltip */}
                                            <foreignObject x={x - 75} y={Math.min(yIncome, yExpense) - 100} width="150" height="90" className="opacity-0 group-hover:opacity-100 transition-opacity overflow-visible z-50 pointer-events-none">
                                                <div className="bg-slate-900/90 backdrop-blur text-white p-3 rounded-xl shadow-xl text-center border border-slate-700 transform scale-100">
                                                    <div className="font-bold text-blue-300 text-xs mb-1">+{formatRupiah(d.income)}</div>
                                                    <div className="font-bold text-red-300 text-xs mb-1">-{formatRupiah(d.expense)}</div>
                                                    <div className="text-slate-400 text-[10px] border-t border-slate-700 pt-1 mt-1">{d.month}</div>
                                                </div>
                                            </foreignObject>
                                        </g>
                                    );
                                })}
                            </svg>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                Tidak ada data untuk periode ini
                            </div>
                        )}

                        {/* X Axis Labels */}
                        {stats.chartData && (
                            <div className="flex justify-between mt-4 text-xs font-medium text-slate-400">
                                {stats.chartData.map((d, i) => (
                                    <div key={i} className="text-center">{d.month}</div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-center gap-6 mt-8">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <span className="w-3 h-3 rounded-full bg-blue-600"></span> Pemasukan
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span> Pengeluaran
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-6">Neraca Periode Ini</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Total Pendapatan Jasa</span>
                                    <span className="font-bold text-blue-600">+{formatRupiah(stats.income)}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Total Biaya & Beban</span>
                                    <span className="font-bold text-red-500">-{formatRupiah(stats.expense)}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                    <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${expenseHeight}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                            <p className="text-sm font-bold text-blue-800 mb-1">Laba / Rugi Bersih</p>
                            <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {formatRupiah(stats.netProfit)}
                            </p>
                            <p className="text-[10px] text-blue-400 mt-1">Performa bersih dalam periode yang dipilih</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                                <p className="text-[10px] font-bold text-yellow-700 uppercase mb-1">Piutang (Invoice Unpaid)</p>
                                <p className="text-sm font-bold text-yellow-800">{formatRupiah(stats.receivable)}</p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Tabungan Masuk (Periode Ini)</p>
                                <p className="text-sm font-bold text-blue-800">{formatRupiah(stats.savings)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Riwayat Transaksi ({dateRange.start} s/d {dateRange.end})</h3>
                    <span className="text-xs font-bold text-slate-400">{filteredTransactions.length} Data</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">TANGGAL</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">KATEGORI</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">DESKRIPSI</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">STATUS</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">LAMPIRAN</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">NOMINAL</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">AKSI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredTransactions.map((trx) => (
                                <tr key={trx.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">{trx.date}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">{trx.category}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-slate-800">{trx.description}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Ref: {trx.id.slice(-6)}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${trx.status === 'Lunas' ? 'bg-blue-50 text-blue-600' :
                                            trx.status === 'Belum Dibayar' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                                            }`}>
                                            {trx.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {trx.attachment ? (
                                            <button className="text-blue-600 hover:underline text-xs flex items-center justify-center gap-1 mx-auto">
                                                <Icon name="paperclip" size={14} /> Lihat
                                            </button>
                                        ) : (
                                            <span className="text-xs text-slate-300 italic">Tidak ada</span>
                                        )}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold text-sm ${trx.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
                                        {trx.type === 'income' ? '+' : '-'} {formatRupiah(trx.amount)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleDelete(trx.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Hapus Transaksi"
                                        >
                                            <Icon name="trash-2" size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Icon name="calendar-x" size={32} className="text-slate-200" />
                                            <p>Tidak ada transaksi pada periode ini</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AIAnalysis = () => {
    const [historicalData, setHistoricalData] = useState([]);
    const [predictedData, setPredictedData] = useState([]);
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate AI Processing Delay
        const timer = setTimeout(() => {
            const transactions = TransactionService.getAll();
            const today = new Date();
            const last6Months = [];

            // 1. Data Prep: Get last 6 months data
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
                const monthName = d.toLocaleString('default', { month: 'short' });

                const monthlyTrx = transactions.filter(t => t.date.startsWith(monthKey));
                const income = monthlyTrx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
                const expense = monthlyTrx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

                last6Months.push({
                    month: monthName,
                    fullDate: monthKey,
                    balance: income - expense,
                    income,
                    expense
                });
            }

            // 2. Prediction Logic: Simple Linear Projection
            // Calculate average growth
            let totalGrowth = 0;
            let growthCount = 0;
            for (let i = 1; i < last6Months.length; i++) {
                const prev = last6Months[i - 1].balance;
                const curr = last6Months[i].balance;
                if (prev !== 0) {
                    totalGrowth += (curr - prev);
                    growthCount++;
                }
            }
            const avgGrowth = growthCount > 0 ? totalGrowth / growthCount : 0;

            const next3Months = [];
            let lastBalance = last6Months[last6Months.length - 1].balance;

            for (let i = 1; i <= 3; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
                const monthName = d.toLocaleString('default', { month: 'short' });
                lastBalance += avgGrowth;
                next3Months.push({
                    month: monthName,
                    balance: lastBalance,
                    isPrediction: true
                });
            }

            // 3. Generate Insights
            const newInsights = [];
            const currentMonthBalance = last6Months[last6Months.length - 1].balance;
            const prevMonthBalance = last6Months[last6Months.length - 2]?.balance || 0;

            if (currentMonthBalance > prevMonthBalance) {
                newInsights.push({ type: 'positive', text: 'Tren arus kas positif! Saldo bulan ini meningkat dibandingkan bulan lalu.' });
            } else {
                newInsights.push({ type: 'negative', text: 'Perhatian: Arus kas menurun. Cek pengeluaran operasional.' });
            }

            if (avgGrowth > 0) {
                newInsights.push({ type: 'neutral', text: `Diproyeksikan tumbuh rata-rata ${formatRupiah(avgGrowth)} per bulan.` });
            }

            setHistoricalData(last6Months);
            setPredictedData(next3Months);
            setInsights(newInsights);
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl">
                        <Icon name="sparkles" size={24} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">AI Financial Analyst</h2>
                        <p className="text-slate-500">Prediksi cerdas arus kas dan kesehatan finansial</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
                    <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Sedang menganalisis data transaksi...</p>
                </div>
            </div>
        );
    }

    // SVG Chart Helpers
    const allData = [...historicalData, ...predictedData];
    const maxVal = Math.max(...allData.map(d => Math.abs(d.balance)), 1000000) * 1.2;
    const minVal = Math.min(...allData.map(d => d.balance), 0) * 1.2;
    const range = maxVal - minVal;

    const getX = (index) => (index / (allData.length - 1)) * 100;
    const getY = (val) => 100 - ((val - minVal) / range) * 100;

    const points = allData.map((d, i) => `${getX(i)},${getY(d.balance)}`).join(' ');
    const historicalPoints = historicalData.map((d, i) => `${getX(i)},${getY(d.balance)}`).join(' ');

    // Prediction line starts from last historical point
    const lastHistIndex = historicalData.length - 1;
    const predictionStartPoint = `${getX(lastHistIndex)},${getY(historicalData[lastHistIndex].balance)}`;
    const predictionPoints = predictedData.map((d, i) => `${getX(lastHistIndex + 1 + i)},${getY(d.balance)}`).join(' ');

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-xl">
                    <Icon name="sparkles" size={24} className="text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">AI Financial Analyst</h2>
                    <p className="text-slate-500">Prediksi cerdas arus kas dan kesehatan finansial</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-bold text-slate-800">Proyeksi Arus Kas (3 Bulan Kedepan)</h3>
                        <div className="flex gap-4 text-xs font-bold">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500"></span> Realisasi
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-indigo-400 border border-dashed border-white"></span> Prediksi AI
                            </div>
                        </div>
                    </div>

                    <div className="relative h-80 w-full">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                            {/* Grid Lines */}
                            {[0, 25, 50, 75, 100].map(y => (
                                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" />
                            ))}

                            {/* Zero Line */}
                            {minVal < 0 && <line x1="0" y1={getY(0)} x2="100" y2={getY(0)} stroke="#94a3b8" strokeWidth="0.5" />}

                            {/* Historical Line */}
                            <polyline
                                points={historicalPoints}
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* Prediction Line */}
                            <polyline
                                points={`${predictionStartPoint} ${predictionPoints}`}
                                fill="none"
                                stroke="#818cf8"
                                strokeWidth="2"
                                strokeDasharray="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* Points */}
                            {allData.map((d, i) => (
                                <g key={i} className="group">
                                    <circle
                                        cx={getX(i)}
                                        cy={getY(d.balance)}
                                        r="1.5"
                                        className={`${d.isPrediction ? 'fill-indigo-500' : 'fill-blue-600'} transition-all duration-300 group-hover:r-3`}
                                    />
                                    {/* Tooltip */}
                                    <foreignObject x={getX(i) - 15} y={getY(d.balance) - 20} width="30" height="20" className="opacity-0 group-hover:opacity-100 transition-opacity overflow-visible">
                                        <div className="bg-slate-800 text-white text-[6px] p-1 rounded text-center whitespace-nowrap transform -translate-x-1/2">
                                            {formatRupiah(d.balance)}
                                        </div>
                                    </foreignObject>
                                </g>
                            ))}
                        </svg>

                        {/* X Axis Labels */}
                        <div className="flex justify-between mt-4 text-xs font-medium text-slate-400">
                            {allData.map((d, i) => (
                                <div key={i} className="w-8 text-center">{d.month}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Insights Panel */}
                <div className="space-y-6">
                    <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <Icon name="lightbulb" size={20} className="text-yellow-300" />
                                <span className="font-bold text-indigo-100">AI Insights</span>
                            </div>
                            <div className="space-y-4">
                                {insights.map((insight, idx) => (
                                    <div key={idx} className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 text-sm leading-relaxed">
                                        {insight.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-4">Rekomendasi Tindakan</h4>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-sm text-slate-600">
                                <Icon name="check-circle" size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-600">Tingkatkan penagihan piutang untuk menjaga likuiditas bulan depan.</span>
                            </li>
                            <li className="flex gap-3 text-sm text-slate-600">
                                <Icon name="check-circle" size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-600">Evaluasi pengeluaran operasional jika tren prediksi menurun.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [user, setUser] = useState(null);
    const [activeModule, setActiveModule] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const session = AuthService.getUser();
        if (session) setUser(session);
    }, []);

    const handleLogin = (userData) => setUser(userData);
    const handleLogout = () => { AuthService.logout(); setUser(null); };

    if (!user) return <Login onLogin={handleLogin} />;

    const renderContent = () => {
        switch (activeModule) {
            case 'dashboard': return <Dashboard />;
            case 'members': return <Members />;
            case 'funds': return <Funds />;
            case 'documents': return <Documents />;
            case 'transactions': return <Transactions />;
            case 'dividends': return <Dividends />;
            case 'reports': return <Reports />;
            case 'ai_analysis': return <AIAnalysis />;
            default: return <Dashboard />;
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 flex flex-col`}>
                {/* Logo Section */}
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl text-white">
                            <Icon name="zap" size={24} />
                        </div>
                        <div>
                            <h1 className="font-bold text-xl tracking-tight leading-none">KEUDE</h1>
                            <p className="text-[10px] text-slate-400 mt-1 tracking-wider uppercase">PT DAYA KARYA ENERGY</p>
                        </div>
                    </div>
                </div>

                {/* Profile Section */}
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-slate-300">
                            <Icon name="user" size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Admin System</p>
                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">ADMIN</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {[
                        { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
                        { id: 'members', icon: 'users', label: 'Karyawan & Klien' },
                        { id: 'funds', icon: 'wallet', label: 'Dana Karyawan' },
                        { id: 'documents', icon: 'file-text', label: 'Buat Dokumen' },
                        { id: 'transactions', icon: 'dollar-sign', label: 'Transaksi' },
                        { id: 'dividends', icon: 'pie-chart', label: 'Dividen & Laba' },
                        { id: 'reports', icon: 'bar-chart-2', label: 'Laporan' },
                        { id: 'ai_analysis', icon: 'bot', label: 'AI Analis' }
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveModule(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${activeModule === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        >
                            <Icon name={item.icon} size={20} className={activeModule === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
                            <span className="font-medium text-sm">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-slate-800">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-slate-800 rounded-xl transition-colors group">
                        <Icon name="log-out" size={20} className="group-hover:text-red-300" />
                        <span className="font-medium text-sm">Keluar</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 h-screen overflow-auto bg-slate-50">
                {/* Mobile Header */}
                <header className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">K</div>
                        <span className="font-bold text-slate-900">KEUDE</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                        <Icon name="menu" size={24} />
                    </button>
                </header>

                <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
