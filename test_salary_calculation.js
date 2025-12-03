
// Mock Service
const transactions = [
    {
        id: "1",
        type: "expense",
        category: "Gaji Karyawan",
        amount: 5000000,
        status: "Lunas"
    },
    {
        id: "2",
        type: "expense",
        category: "gaji karyawan",
        amount: 3000000,
        status: "Lunas"
    },
    {
        id: "3",
        type: "expense",
        category: "Pajak",
        amount: 100000,
        status: "Lunas"
    }
];

// Calculation Logic from Dashboard
const salaryExpense = transactions
    .filter(t => t.type === 'expense' && (t.category === 'Gaji Karyawan' || (t.category && t.category.toLowerCase().includes('gaji'))))
    .reduce((sum, t) => sum + t.amount, 0);

console.log("Total Salary Expense:", salaryExpense);

if (salaryExpense === 8000000) {
    console.log("SUCCESS: Calculation logic is correct.");
} else {
    console.log("FAILURE: Calculation logic is incorrect.");
}
