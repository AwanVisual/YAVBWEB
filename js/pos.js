// Use the global db instance
const db = window.db;

// Initialize variables
let cart = [];
let products = [];
let currentCategory = 'all';

async function fetchFromSupabase(endpoint) {
    try {
        const { data, error } = await db
            .from(endpoint)
            .select('*');
            
        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error fetching from ${endpoint}:`, error);
        throw error;
    }
}

async function checkAuth() {
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session) {
        window.location.href = '../index.html';
        return;
    }
    return session;
}

async function loadProducts() {
    try {
        const { data: products, error } = await db
            .from('products')
            .select('*')
            .order('category', { ascending: true })
            .order('name', { ascending: true })
            .order('size', { ascending: true });

        if (error) throw error;

        // Group products by category first
        const categories = [...new Set(products.map(p => p.category))];
        
        // Create category buttons
        const productList = document.getElementById('productList');
        productList.innerHTML = `
            <div class="col-12 mb-4">
                <h5 class="mb-3">Pilih Kategori</h5>
                <div class="d-flex flex-wrap gap-2 mb-4">
                    ${categories.map(category => `
                        <button class="btn btn-lg btn-outline-primary" onclick="showProducts('${category}')">
                            ${category}
                        </button>
                    `).join('')}
                </div>
                <div id="productsByCategory"></div>
            </div>
        `;

        // Store products in window for later use
        window.allProducts = products;
    } catch (error) {
        console.error('Error loading products:', error);
        alert('Error: ' + error.message);
    }
}

// Function to show products for selected category
window.showProducts = function(category) {
    const products = window.allProducts;
    if (!products) return;

    // Get unique product names for this category
    const uniqueProducts = [...new Set(
        products
            .filter(p => p.category === category)
            .map(p => p.name)
    )].sort();

    // Show products as list buttons
    const productContainer = document.getElementById('productsByCategory');
    productContainer.innerHTML = `
        <h5 class="mb-3">${category}</h5>
        <div class="list-group">
            ${uniqueProducts.map(productName => {
                // Get all variants of this product
                const variants = products.filter(p => p.category === category && p.name === productName);
                const firstVariant = variants[0];
                const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
                
                return `
                    <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                            onclick="showSizes('${firstVariant.sku}', '${productName}', ${firstVariant.price}, ${JSON.stringify(variants.reduce((acc, v) => {
                                acc[v.size] = v.stock;
                                return acc;
                            }, {})).replace(/"/g, '&quot;')}, '${category}')">
                        <div>
                            <h6 class="mb-0">${productName}</h6>
                            <small class="text-muted">Rp ${firstVariant.price.toLocaleString()}</small>
                        </div>
                        ${category === 'Perlengkapan' 
                            ? `<span class="badge bg-primary rounded-pill">Stok: ${totalStock}</span>`
                            : `<span class="badge bg-primary rounded-pill">Total Stok: ${totalStock}</span>`
                        }
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

// Function to show sizes for selected product
window.showSizes = function(sku, name, price, sizes, category) {
    if (category === 'Perlengkapan') {
        // For equipment, add directly to cart
        addToCart(sku);
        return;
    }

    // For uniforms, show size selection
    const sizeOptions = Object.entries(sizes)
        .sort(([a], [b]) => {
            const sizeOrder = { 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5 };
            return sizeOrder[a] - sizeOrder[b];
        });

    // Create and show the size selection modal
    const modalHtml = `
        <div class="modal fade" id="sizeModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Pilih Ukuran - ${name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="list-group">
                            ${sizeOptions.map(([size, stock]) => {
                                return `
                                    <button type="button" 
                                        class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${stock <= 0 ? 'disabled' : ''}"
                                        onclick="selectSizeAndAddToCart('${sku}', '${name}', ${price}, '${size}', ${stock})"
                                        ${stock <= 0 ? 'disabled' : ''}>
                                        <span>Ukuran ${size}</span>
                                        <span class="badge ${stock <= 0 ? 'bg-danger' : 'bg-primary'} rounded-pill">
                                            Stok: ${stock}
                                        </span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('sizeModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('sizeModal'));
    modal.show();
}

// Function to handle size selection and add to cart
window.selectSizeAndAddToCart = async function(baseSku, name, price, size, stock) {
    try {
        // Extract the base SKU without any size suffix
        const cleanBaseSku = baseSku.split('-').slice(0, -1).join('-') || baseSku;
        console.log('Adding to cart with base SKU:', cleanBaseSku, 'size:', size);
        
        // Get all products with this base SKU
        const { data: products, error } = await db
            .from('products')
            .select('*')
            .like('sku', `${cleanBaseSku}%`);

        if (error) throw error;
        if (!products || products.length === 0) {
            throw new Error('Produk tidak ditemukan');
        }

        console.log('Found products:', products);

        // Find the product with the matching size
        const product = products.find(p => p.size === size);
        if (!product) {
            throw new Error('Ukuran produk tidak ditemukan');
        }

        console.log('Selected product:', product);

        // Add to cart
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            if (existingItem.quantity >= stock) {
                alert('Stok tidak mencukupi!');
                return;
            }
            existingItem.quantity++;
        } else {
            cart.push({
                id: product.id,
                sku: product.sku,
                name: name,
                price: price,
                quantity: 1,
                stock: stock,
                size: size
            });
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('sizeModal'));
        modal.hide();

        updateCartDisplay();
    } catch (error) {
        console.error('Error selecting size:', error);
        alert('Error: ' + error.message);
    }
}

function displayCategories() {
    // Dapatkan kategori unik dari produk
    const uniqueCategories = [...new Set(products.map(p => p.category))].filter(Boolean).sort();
    const categories = ['all', ...uniqueCategories];
    
    const categoryList = document.getElementById('categoryList');
    
    categoryList.innerHTML = categories.map(category => `
        <button class="btn ${currentCategory === category ? 'btn-add-cart' : 'btn-outline-secondary'} category-btn me-2 mb-2"
            onclick="filterByCategory('${category}')">
            ${category === 'all' ? 'Semua' : category}
        </button>
    `).join('');
}

function filterByCategory(category) {
    currentCategory = category;
    console.log('Filtering by category:', category);
    
    const filtered = category === 'all' 
        ? products 
        : products.filter(p => p.category === category);
    
    console.log('Filtered products:', filtered);
    displayProducts(filtered);
    displayCategories();
}

function displayProducts(productsToShow) {
    const productList = document.getElementById('productList');
    productList.innerHTML = '';

    productsToShow.forEach(product => {
        const productCard = `
            <div class="col-md-3 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <h6 class="card-title">${product.name}</h6>
                        <p class="card-text small text-muted">${product.description || ''}</p>
                        <p class="card-text">
                            <strong>Rp ${product.price.toLocaleString()}</strong><br>
                            <small>Stok: ${product.stock}</small>
                        </p>
                        <button class="btn btn-add-cart btn-sm w-100" 
                            onclick='addToCart(${JSON.stringify(product)})'
                            ${product.stock <= 0 ? 'disabled' : ''}>
                            Tambah ke Keranjang
                        </button>
                    </div>
                </div>
            </div>
        `;
        productList.innerHTML += productCard;
    });
}

async function addToCart(baseSku) {
    try {
        console.log('Adding to cart:', baseSku);
        
        // Get all variants of the product with this base SKU
        const { data: products, error } = await db
            .from('products')
            .select('*')
            .like('sku', `${baseSku}%`);

        if (error) throw error;
        if (!products || products.length === 0) {
            throw new Error('Produk tidak ditemukan');
        }

        // Get the base product (without size)
        const baseProduct = products.find(p => p.sku === baseSku) || products[0];
        
        // Filter variants to only include those with the exact same SKU base
        const variants = products.filter(p => {
            const productBaseSku = p.sku.includes('-') ? p.sku.split('-')[0] : p.sku;
            const currentBaseSku = baseSku.includes('-') ? baseSku.split('-')[0] : baseSku;
            return productBaseSku === currentBaseSku;
        });

        console.log('Base product:', baseProduct);
        console.log('Filtered variants:', variants);

        if (baseProduct.category === 'Perlengkapan') {
            // For equipment, add directly to cart
            if (baseProduct.stock <= 0) {
                alert('Stok produk habis!');
                return;
            }

            // Add to cart
            const existingItem = cart.find(item => item.id === baseProduct.id);
            if (existingItem) {
                if (existingItem.quantity >= baseProduct.stock) {
                    alert('Stok tidak mencukupi!');
                    return;
                }
                existingItem.quantity++;
            } else {
                cart.push({
                    id: baseProduct.id,
                    sku: baseProduct.sku,
                    name: baseProduct.name,
                    price: baseProduct.price,
                    quantity: 1,
                    stock: baseProduct.stock,
                    size: '-'
                });
            }
            
            updateCartDisplay();
        } else {
            // For uniforms, show size selection dialog
            const sizeOptions = variants.map(p => ({
                id: p.id,
                size: p.size,
                stock: p.stock
            })).sort((a, b) => {
                const sizeOrder = { 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5 };
                return sizeOrder[a.size] - sizeOrder[b.size];
            });

            // Create and show the size selection modal
            const modalHtml = `
                <div class="modal fade" id="sizeModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Pilih Ukuran - ${baseProduct.name}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="list-group">
                                    ${sizeOptions.map(opt => `
                                        <button type="button" 
                                            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${opt.stock <= 0 ? 'disabled' : ''}"
                                            onclick="selectSize('${opt.id}', '${baseProduct.name}', ${baseProduct.price}, '${opt.size}', ${opt.stock})"
                                            ${opt.stock <= 0 ? 'disabled' : ''}>
                                            <span>Ukuran ${opt.size}</span>
                                            <span class="badge ${opt.stock <= 0 ? 'bg-danger' : 'bg-primary'} rounded-pill">
                                                Stok: ${opt.stock}
                                            </span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingModal = document.getElementById('sizeModal');
            if (existingModal) {
                existingModal.remove();
            }

            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('sizeModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Error: ' + error.message);
    }
}

// Function to handle size selection
window.selectSize = function(productId, name, price, size, stock) {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        if (existingItem.quantity >= stock) {
            alert('Stok tidak mencukupi!');
            return;
        }
        existingItem.quantity++;
    } else {
        cart.push({
            id: productId,
            name: name,
            price: price,
            quantity: 1,
            stock: stock,
            size: size
        });
    }

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('sizeModal'));
    modal.hide();

    updateCartDisplay();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        const newQuantity = item.quantity + change;
        if (newQuantity > 0 && newQuantity <= item.stock) {
            item.quantity = newQuantity;
        } else if (newQuantity <= 0) {
            removeFromCart(productId);
            return;
        }
    }
    updateCartDisplay();
}

function updateCartDisplay() {
    const cartElement = document.getElementById('cart');
    const totalElement = document.getElementById('totalAmount');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    cartElement.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        cartElement.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <h6 class="mb-0">${item.name}</h6>
                    <small class="text-muted">Rp ${item.price.toLocaleString()} x ${item.quantity}</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="btn-group btn-group-sm me-2">
                        <button class="btn btn-outline-secondary" onclick="updateQuantity('${item.id}', -1)">-</button>
                        <button class="btn btn-outline-secondary" onclick="updateQuantity('${item.id}', 1)">+</button>
                    </div>
                    <div class="text-end">
                        <div>Rp ${itemTotal.toLocaleString()}</div>
                        <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    totalElement.textContent = `Rp ${total.toLocaleString()}`;
    
    // Update button states
    checkoutBtn.disabled = cart.length === 0;
    document.getElementById('printLastBtn').disabled = false;
}

// Search functionality
document.getElementById('searchProduct').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.description?.toLowerCase().includes(searchTerm) ||
        p.sku.toLowerCase().includes(searchTerm)
    );
    displayProducts(filtered);
});

// Fungsi untuk print bill
function generateBill(transaction) {
    const billWindow = window.open('', '_blank');
    
    const billContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Struk Pembayaran</title>
            <style>
                body {
                    font-family: 'Courier New', monospace;
                    width: 300px;
                    margin: 0 auto;
                    padding: 10px;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .mb-1 { margin-bottom: 10px; }
                .border-bottom { border-bottom: 1px dashed #000; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="text-center mb-1">
                <h3 style="margin:0">YAVB</h3>
                <p style="margin:0">Jl. Contoh No. 123</p>
                <p style="margin:0">Telp: 081234567890</p>
            </div>
            <div class="border-bottom mb-1">
                <p style="margin:0">No: ${transaction.id.slice(0,8)}</p>
                <p style="margin:0">Kasir: ${transaction.cashier_name || 'Admin'}</p>
                <p style="margin:0">Tanggal: ${new Date().toLocaleString('id-ID')}</p>
            </div>
            <div class="mb-1">
                ${transaction.items.map(item => `
                    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                        <div>${item.name}</div>
                        <div>${item.quantity} x ${item.price.toLocaleString()}</div>
                    </div>
                    <div class="text-right">${(item.quantity * item.price).toLocaleString()}</div>
                `).join('')}
            </div>
            <div class="border-bottom mb-1">
                <div style="display:flex;justify-content:space-between">
                    <strong>TOTAL</strong>
                    <strong>Rp ${transaction.total_amount.toLocaleString()}</strong>
                </div>
            </div>
            <div class="text-center mb-1">
                <p style="margin:0">Terima kasih atas kunjungan Anda</p>
                <p style="margin:0">Barang yang sudah dibeli tidak dapat ditukar</p>
            </div>
            <button class="no-print" onclick="window.print()">Print Struk</button>
        </body>
        </html>
    `;
    
    billWindow.document.write(billContent);
    billWindow.document.close();
}

// Update fungsi checkout
document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if (cart.length === 0) {
        alert('Keranjang kosong!');
        return;
    }

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Memproses...';

    try {
        const session = await checkAuth();
        if (!session) {
            throw new Error('Silakan login terlebih dahulu');
        }

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const user = session.user;
        
        // Buat objek transaksi
        const transactionData = {
            items: JSON.stringify(cart), // Simpan cart sebagai JSON string
            total_amount: total,
            cashier_id: user.id,
            status: 'completed',
            created_at: new Date().toISOString()
        };

        // Create transaction
        const { data: transaction, error: transactionError } = await db
            .from('transactions')
            .insert([transactionData])
            .select()
            .single();

        if (transactionError) throw transactionError;

        // Update stock for each item
        for (const item of cart) {
            const { data: currentProduct, error: getError } = await db
                .from('products')
                .select('stock')
                .eq('id', item.id)
                .single();

            if (getError) throw getError;

            const newStock = currentProduct.stock - item.quantity;
            
            const { error: stockError } = await db
                .from('products')
                .update({ stock: newStock })
                .eq('id', item.id);

            if (stockError) throw stockError;

            // Log stock change
            await db
                .from('stock_logs')
                .insert([{
                    product_id: item.id,
                    change_amount: -item.quantity,
                    note: `Transaksi #${transaction.id}`,
                    user_id: user.id
                }]);
        }

        // Generate dan print bill
        generateBill({
            ...transaction,
            items: cart,
            cashier_name: user.user_metadata?.full_name || 'Admin'
        });

        alert('Transaksi berhasil!');
        cart = [];
        updateCartDisplay();
        await loadProducts(); // Reload products to update stock display

    } catch (error) {
        console.error('Checkout error:', error);
        alert('Error saat memproses transaksi: ' + error.message);
    } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Bayar';
    }
});

// Fungsi untuk mendapatkan transaksi terakhir
async function getLastTransaction() {
    try {
        const { data, error } = await db
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting last transaction:', error);
        throw error;
    }
}

// Event listener untuk tombol print struk terakhir
document.getElementById('printLastBtn').addEventListener('click', async () => {
    try {
        const transaction = await getLastTransaction();
        if (transaction) {
            const session = await checkAuth();
            generateBill({
                ...transaction,
                items: JSON.parse(transaction.items), // Parse items dari JSON string
                cashier_name: session.user.user_metadata?.full_name || 'Admin'
            });
        } else {
            alert('Tidak ada transaksi yang ditemukan');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error getting last transaction: ' + error.message);
    }
});

// Panggil checkAuth saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    checkAuth().then(() => {
        loadProducts();
    });
});

// Fungsi untuk memuat produk di kasir
async function loadProductsForCashier() {
    const productList = document.getElementById('productList');
    if (!productList) {
        console.error('Product list element not found');
        return;
    }

    try {
        // Show loading state
        productList.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>
        `;

        // Get products
        const products = await fetchFromSupabase('products');

        if (!products || products.length === 0) {
            productList.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="alert alert-info mb-0">
                            Belum ada produk. Klik tombol "Tambah Produk" untuk menambahkan produk baru.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Render products
        productList.innerHTML = products.map(product => `
            <tr>
                <td>${product.sku || '-'}</td>
                <td>${product.name || '-'}</td>
                <td>${product.category || '-'}</td>
                <td>Rp ${(product.price || 0).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="addToCart('${product.id}')">
                        Tambah
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading products:', error);
        productList.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="alert alert-danger mb-0">
                        Error: ${error.message}
                    </div>
                </td>
            </tr>
        `;
    }
}

// Panggil fungsi ini saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    loadProductsForCashier();
}); 