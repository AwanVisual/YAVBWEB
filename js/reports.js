// Gunakan instance global db
const db = window.db;

// URL dan kunci Supabase (tidak perlu jika sudah ada instance db)
const SUPABASE_URL = 'https://crwxvkrsqdkzcmrmjefq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3h2a3JzcWRremNtcm1qZWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4NTgyMTEsImV4cCI6MjA1MzQzNDIxMX0.DeEvmP9-ZZYA1hJwY5BvuT5kFV2x8_1s9bEsnlT0yIs'; // Ganti dengan kunci anon yang baru

// Inisialisasi saat dokumen dimuat
document.addEventListener('DOMContentLoaded', () => {
    // Set tanggal default
    setDefaultDates();
    
    // Event listeners
    document.getElementById('filterBtn').addEventListener('click', loadReport);
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
    document.getElementById('reportType').addEventListener('change', loadReport);
    
    // Load laporan pertama kali
    loadReport();
});

// Set tanggal default (1 bulan terakhir)
function setDefaultDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
}

// Update fungsi getUserEmails
async function getUserEmails(userIds) {
    try {
        // Dapatkan session user saat ini
        const { data: { session }, error: sessionError } = await db.auth.getSession();
        if (sessionError) throw sessionError;

        // Dapatkan email untuk setiap user ID
        const emailPromises = userIds.map(async (id) => {
            try {
                const { data: { user }, error } = await db.auth.admin.getUserById(id);
                return [id, user?.email || 'Unknown'];
            } catch (error) {
                console.error('Error getting user:', error);
                return [id, 'Unknown'];
            }
        });

        const userEmails = await Promise.all(emailPromises);
        return Object.fromEntries(userEmails);
    } catch (error) {
        console.error('Error getting user emails:', error);
        return {};
    }
}

// Load data laporan
async function loadReport() {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    try {
        let data, error;

        // Query berdasarkan jenis laporan
        switch (reportType) {
            case 'transactions':
                ({ data, error } = await db
                    .from('transactions')
                    .select(`
                        id,
                        cashier_id,
                        total_amount,
                        status,
                        created_at,
                        items
                    `)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate + ' 23:59:59')
                    .order('created_at', { ascending: false }));
                
                // Tambahkan user_email dan handle items
                if (data) {
                    data = data.map(item => {
                        // Handle items
                        let items = [];
                        if (item.items) {
                            if (typeof item.items === 'string') {
                                try {
                                    items = JSON.parse(item.items);
                                } catch (e) {
                                    console.error('Failed to parse items for transaction:', item.id);
                                }
                            } else if (Array.isArray(item.items)) {
                                items = item.items;
                            } else if (typeof item.items === 'object') {
                                items = [item.items];
                            }
                        }

                        return {
                            ...item,
                            items: items,
                            user_email: `User ${item.cashier_id.slice(0,8)}`
                        };
                    });
                }
                break;

            case 'price_logs':
                ({ data, error } = await db
                    .from('price_logs')
                    .select(`
                        id,
                        old_price,
                        new_price,
                        created_at,
                        product_id,
                        products (name),
                        user_id
                    `)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate + ' 23:59:59')
                    .order('created_at', { ascending: false }));
                
                // Tambahkan user_email langsung dari user_id
                if (data) {
                    data = data.map(item => ({
                        ...item,
                        user_email: `User ${item.user_id.slice(0,8)}`
                    }));
                }
                break;

            case 'stock_logs':
                ({ data, error } = await db
                    .from('stock_logs')
                    .select(`
                        id,
                        change_amount,
                        note,
                        created_at,
                        product_id,
                        products (name),
                        user_id
                    `)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate + ' 23:59:59')
                    .order('created_at', { ascending: false }));
                
                // Tambahkan user_email langsung dari user_id
                if (data) {
                    data = data.map(item => ({
                        ...item,
                        user_email: `User ${item.user_id.slice(0,8)}`
                    }));
                }
                break;
        }

        if (error) throw error;

        updateTable(reportType, data);
        updateSummary(reportType, data);

    } catch (error) {
        console.error('Error loading report:', error);
        alert('Gagal memuat laporan: ' + error.message);
    }
}

// Update tabel berdasarkan jenis laporan
function updateTable(reportType, data) {
    const tableContainer = document.querySelector('.table-responsive table');
    if (!tableContainer) {
        console.error('Table container not found');
        return;
    }

    // Buat thead jika belum ada
    let thead = tableContainer.querySelector('thead');
    if (!thead) {
        thead = document.createElement('thead');
        tableContainer.appendChild(thead);
    }

    // Buat tbody jika belum ada
    let tbody = tableContainer.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        tableContainer.appendChild(tbody);
    }

    // Set header
    thead.innerHTML = getTableHeader(reportType);
    tbody.innerHTML = '';

    // Set data
    if (Array.isArray(data)) {
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = getTableRow(reportType, item);
            tbody.appendChild(row);
        });
    } else {
        console.error('Data is not an array:', data);
    }
}

// Get header tabel berdasarkan jenis laporan
function getTableHeader(reportType) {
    switch (reportType) {
        case 'transactions':
            return `
                <tr>
                    <th>Tanggal</th>
                    <th>No Transaksi</th>
                    <th>Kasir</th>
                    <th>Total</th>
                    <th>Status</th>
                </tr>
            `;
        case 'price_logs':
            return `
                <tr>
                    <th>Tanggal</th>
                    <th>Produk</th>
                    <th>Harga Lama</th>
                    <th>Harga Baru</th>
                    <th>Diubah Oleh</th>
                </tr>
            `;
        case 'stock_logs':
            return `
                <tr>
                    <th>Tanggal</th>
                    <th>Produk</th>
                    <th>Perubahan</th>
                    <th>Catatan</th>
                    <th>Diubah Oleh</th>
                </tr>
            `;
    }
}

// Get row data berdasarkan jenis laporan
function getTableRow(reportType, item) {
    const date = new Date(item.created_at).toLocaleString('id-ID');
    
    switch (reportType) {
        case 'transactions':
            let itemCount = 0;
            let items = [];

            if (item.items) {
                if (typeof item.items === 'string') {
                    try {
                        items = JSON.parse(item.items);
                    } catch (e) {
                        console.error('Failed to parse items string:', e);
                    }
                } else if (Array.isArray(item.items)) {
                    items = item.items;
                } else if (typeof item.items === 'object') {
                    items = [item.items];
                }
            }

            itemCount = Array.isArray(items) ? items.length : 0;

            return `
                <td>${date}</td>
                <td>${item.id.slice(0,8)}</td>
                <td>${item.user_email || 'Admin'}</td>
                <td>Rp ${(item.total_amount || 0).toLocaleString()}</td>
                <td>
                    <span class="badge ${item.status === 'completed' ? 'bg-success' : 'bg-warning'}">
                        ${itemCount} item
                    </span>
                </td>
            `;

        case 'price_logs':
            return `
                <td>${date}</td>
                <td>${item.products?.name || 'Unknown Product'}</td>
                <td>Rp ${(item.old_price || 0).toLocaleString()}</td>
                <td>Rp ${(item.new_price || 0).toLocaleString()}</td>
                <td>${item.user_email || 'Admin'}</td>
            `;

        case 'stock_logs':
            return `
                <td>${date}</td>
                <td>${item.products?.name || 'Unknown Product'}</td>
                <td>${item.change_amount > 0 ? '+' : ''}${item.change_amount}</td>
                <td>${item.note || '-'}</td>
                <td>${item.user_email || 'Admin'}</td>
            `;
    }
}

// Update ringkasan berdasarkan jenis laporan
function updateSummary(reportType, data) {
    if (reportType === 'transactions') {
        const totalTransactions = data.length;
        const totalRevenue = data.reduce((sum, item) => sum + (item.total_amount || 0), 0);
        const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

        document.getElementById('totalTransactions').textContent = totalTransactions;
        document.getElementById('totalRevenue').textContent = `Rp ${totalRevenue.toLocaleString()}`;
        document.getElementById('averageTransaction').textContent = `Rp ${Math.round(averageTransaction).toLocaleString()}`;
    }
}

// Export ke Excel
function exportToExcel() {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Dapatkan data dari tabel
    const table = document.querySelector('.table-responsive table');
    const wb = XLSX.utils.table_to_book(table, { sheet: "Report" });
    
    // Generate nama file
    const fileName = `${reportType}_${startDate}_${endDate}.xlsx`;
    
    // Export file
    XLSX.writeFile(wb, fileName);
}

// Event Listeners
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.href = '../index.html';
}); 