// Use the global db instance
const db = window.db;

const SUPABASE_URL = 'https://crwxvkrsqdkzcmrmjefq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3h2a3JzcWRremNtcm1qZWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4NTgyMTEsImV4cCI6MjA1MzQzNDIxMX0.DeEvmP9-ZZYA1hJwY5BvuT5kFV2x8_1s9bEsnlT0yIs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Check auth status
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '../index.html';
        return;
    }
    return session;
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const session = await checkAuth();
        if (!session) return;

        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString();
        const endOfDay = new Date(today.setHours(23,59,59,999)).toISOString();

        // Get today's transactions
        const { data: todayTransactions, error: transactionError } = await supabase
            .from('transactions')
            .select('*')
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            throw transactionError;
        }

        // Calculate today's stats
        const todaySalesCount = todayTransactions?.length || 0;
        const todayRevenue = todayTransactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;

        // Get low stock products
        const { data: lowStockProducts, error: stockError } = await supabase
            .from('products')
            .select('*')
            .lte('stock', 10) // Ubah lt menjadi lte untuk mengambil stok <= 10
            .order('stock');

        if (stockError) {
            console.error('Stock error:', stockError);
            throw stockError;
        }

        console.log('Low stock products:', lowStockProducts); // Logging untuk debug

        // Update stats display
        const todaySalesElement = document.getElementById('todaySales');
        const todayRevenueElement = document.getElementById('todayRevenue');
        const lowStockElement = document.getElementById('lowStock');
        const monthlyGrowthElement = document.getElementById('monthlyGrowth');

        if (todaySalesElement) todaySalesElement.textContent = todaySalesCount;
        if (todayRevenueElement) todayRevenueElement.textContent = `Rp ${todayRevenue.toLocaleString()}`;
        if (lowStockElement) {
            const lowStockCount = Array.isArray(lowStockProducts) ? lowStockProducts.length : 0;
            console.log('Low stock count:', lowStockCount); // Logging untuk debug
            lowStockElement.textContent = lowStockCount;
        }
        if (monthlyGrowthElement) monthlyGrowthElement.textContent = '0%';

        // Update low stock products table
        const lowStockTable = document.getElementById('lowStockProducts');
        if (lowStockTable && Array.isArray(lowStockProducts) && lowStockProducts.length > 0) {
            console.log('Updating low stock table...'); // Logging untuk debug
            lowStockTable.innerHTML = lowStockProducts.map(product => `
                <tr>
                    <td>${product.name || 'N/A'}</td>
                    <td>${product.category || 'N/A'}</td>
                    <td>
                        <span class="badge ${product.stock <= 5 ? 'bg-danger' : 'bg-warning'}">
                            ${product.stock || 0}
                        </span>
                    </td>
                    <td>${product.min_stock || 10}</td>
                </tr>
            `).join('');
        } else {
            console.log('No low stock products found or table element missing');
            if (lowStockTable) {
                lowStockTable.innerHTML = '<tr><td colspan="4" class="text-center">Tidak ada produk dengan stok menipis</td></tr>';
            }
        }

        // Load charts
        await loadCharts();

        // Load recent transactions
        await loadRecentTransactions();

        // Update user info
        const userInfoElement = document.getElementById('userInfo');
        if (userInfoElement) {
            const userEmail = session.user.email;
            const userName = session.user.user_metadata?.full_name || userEmail;
            userInfoElement.textContent = userName;
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
        // Tampilkan pesan error yang lebih detail
        alert(`Error loading dashboard: ${error.message || 'Unknown error occurred'}`);
    }
}

// Load charts
async function loadCharts() {
    try {
        // Get data for sales chart (7 hari terakhir)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 6); // 7 hari ke belakang

        const { data: salesData, error: salesError } = await supabase
            .from('transactions')
            .select('created_at, total_amount')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at');

        if (salesError) throw salesError;

        // Process sales data by day
        const dailySales = {};
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        
        // Initialize daily sales with 0
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dayName = days[date.getDay()];
            dailySales[dayName] = 0;
        }

        // Sum up sales by day
        salesData?.forEach(transaction => {
            const date = new Date(transaction.created_at);
            const dayName = days[date.getDay()];
            dailySales[dayName] += transaction.total_amount;
        });

        // Sales Chart
        const salesCtx = document.getElementById('salesChart').getContext('2d');
        new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: Object.keys(dailySales),
                datasets: [{
                    label: 'Penjualan (Rp)',
                    data: Object.values(dailySales),
                    borderColor: '#667eea',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(102,126,234,0.1)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Rp ' + context.raw.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Rp ' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });

        // Get data for category chart
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('category');

        if (productsError) throw productsError;

        // Count products by category
        const categoryCount = {};
        products.forEach(product => {
            categoryCount[product.category] = (categoryCount[product.category] || 0) + 1;
        });

        // Category Chart
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryCount),
                datasets: [{
                    data: Object.values(categoryCount),
                    backgroundColor: [
                        '#667eea', 
                        '#764ba2', 
                        '#cbd5e0',
                        '#ed64a6',
                        '#48bb78',
                        '#ecc94b'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

// Load recent transactions
async function loadRecentTransactions() {
    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select(`
                id,
                cashier_id,
                total_amount,
                status,
                created_at
            `)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        const tbody = document.getElementById('recentTransactions');
        tbody.innerHTML = transactions.map(t => `
            <tr>
                <td>${t.id.slice(0,8)}</td>
                <td>${new Date(t.created_at).toLocaleString('id-ID')}</td>
                <td>User ${t.cashier_id.slice(0,8)}</td>
                <td>Rp ${t.total_amount.toLocaleString()}</td>
                <td>
                    <span class="badge bg-${t.status === 'completed' ? 'success' : 'warning'}">
                        ${t.status}
                    </span>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = '../index.html';
    } catch (error) {
        console.error('Error signing out:', error);
        alert('Error signing out: ' + error.message);
    }
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', loadDashboardData); 