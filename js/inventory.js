// Wait for DOM and Supabase to be ready
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.db; // Use the global db instance
    if (!db) {
        console.error('Supabase client not initialized');
        return;
    }

    // Tambahkan ke window object agar bisa diakses dari HTML
    window.deleteProduct = deleteProduct;

    // Fungsi untuk edit stok
    window.editStock = async function(baseSku) {
        try {
            console.log('Editing stock for SKU:', baseSku);
            
            // Get all products with this base SKU
            const { data: products, error } = await db
                .from('products')
                .select('*')
                .like('sku', `${baseSku}%`);

            if (error) {
                console.error('Error fetching products:', error);
                throw error;
            }

            if (!products || products.length === 0) {
                throw new Error('Produk tidak ditemukan');
            }

            console.log('Products found:', products);

            const firstProduct = products[0];
            
            // Fill form with product details
            document.getElementById('editProductId').value = firstProduct.id;
            document.getElementById('editProductName').value = firstProduct.name;
            document.getElementById('currentStock').value = firstProduct.stock;
            
            // Set category
            const categorySelect = document.getElementById('editProductCategory');
            if (categorySelect) {
                categorySelect.value = firstProduct.category;
                categorySelect.disabled = true;
            }
            
            // Set size options
            const sizeSelect = document.getElementById('editProductSize');
            if (sizeSelect) {
                // Clear existing options
                sizeSelect.innerHTML = '';
                
                if (firstProduct.category === 'Perlengkapan') {
                    // For equipment, just show one option
                    const option = document.createElement('option');
                    option.value = firstProduct.id;
                    option.textContent = '-';
                    sizeSelect.appendChild(option);
                    sizeSelect.disabled = true;
                } else {
                    // For uniforms, show all sizes
                    sizeSelect.disabled = false;
                    
                    // Get unique sizes and sort them
                    const sizeOrder = { 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5 };
                    const uniqueProducts = Array.from(new Map(products.map(item => [item.size, item])).values());
                    uniqueProducts.sort((a, b) => sizeOrder[a.size] - sizeOrder[b.size]);
                    
                    uniqueProducts.forEach(product => {
                        const option = document.createElement('option');
                        option.value = product.id;
                        option.textContent = product.size;
                        sizeSelect.appendChild(option);
                    });
                }
                
                // Set initial value
                sizeSelect.value = firstProduct.id;
                
                // Update current stock when size changes
                sizeSelect.onchange = function() {
                    console.log('Size changed to:', this.value);
                    const selectedProduct = products.find(p => p.id.toString() === this.value.toString());
                    console.log('Selected product:', selectedProduct);
                    if (selectedProduct) {
                        document.getElementById('currentStock').value = selectedProduct.stock;
                        document.getElementById('editProductId').value = selectedProduct.id;
                    }
                };
            }

            // Reset other fields
            document.getElementById('stockChange').value = '';
            document.getElementById('stockNote').value = '';

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('editStockModal'));
            modal.show();
        } catch (error) {
            console.error('Error getting product details:', error);
            alert('Error: ' + error.message);
        }
    }

    // Fungsi untuk menghapus produk
    async function deleteProduct(baseSku) {
        if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
            return;
        }

        try {
            // Get all products with this base SKU
            const { data: products, error: getError } = await db
                .from('products')
                .select('id')
                .like('sku', `${baseSku}%`);

            if (getError) throw getError;

            // Get all product IDs
            const productIds = products.map(p => p.id);

            // Hapus stock logs terlebih dahulu
            const { error: stockLogsError } = await db
                .from('stock_logs')
                .delete()
                .in('product_id', productIds);

            if (stockLogsError) throw stockLogsError;

            // Setelah stock logs dihapus, baru hapus produk
            const { error: productError } = await db
                .from('products')
                .delete()
                .in('id', productIds);

            if (productError) throw productError;

            alert('Produk berhasil dihapus');
            loadProducts(); // Refresh tabel
        } catch (error) {
            console.error('Error:', error);
            alert('Error menghapus produk: ' + error.message);
        }
    }

    // Fungsi untuk memuat produk
    async function loadProducts() {
        console.log('Loading products...');
        
        const productList = document.getElementById('productList');
        if (!productList) {
            console.error('Product list element not found');
            return;
        }

        try {
            // Show loading state
            productList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </td>
                </tr>
            `;

            // Get products
            const { data: products, error } = await db
                .from('products')
                .select('*')
                .order('category', { ascending: true })
                .order('name', { ascending: true })
                .order('size', { ascending: true });

            if (error) throw error;

            if (!products || products.length === 0) {
                productList.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center">
                            <div class="alert alert-info mb-0">
                                Belum ada produk. Klik tombol "Tambah Produk" untuk menambahkan produk baru.
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            // Kelompokkan produk berdasarkan nama dan kategori
            const groupedProducts = {};
            products.forEach(product => {
                const baseSku = product.sku.split('-')[0]; // Ambil SKU dasar
                const key = `${product.category}-${product.name}`;
                if (!groupedProducts[key]) {
                    groupedProducts[key] = {
                        sku: baseSku,
                        name: product.name,
                        category: product.category,
                        price: product.price,
                        sizes: {},
                        min_stock: product.min_stock
                    };
                }
                groupedProducts[key].sizes[product.size] = product.stock;
            });

            // Render products
            productList.innerHTML = Object.values(groupedProducts).map(product => {
                // Buat tampilan ukuran dan stok
                let sizeStockHtml = '';
                if (product.category === 'Perlengkapan') {
                    sizeStockHtml = `<span class="badge bg-secondary">Stok: ${product.sizes['-']}</span>`;
                } else {
                    sizeStockHtml = Object.entries(product.sizes)
                        .sort(([a], [b]) => {
                            const sizeOrder = { 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5 };
                            return sizeOrder[a] - sizeOrder[b];
                        })
                        .map(([size, stock]) => 
                            `<span class="badge ${stock <= product.min_stock ? 'bg-warning' : 'bg-success'} me-1">
                                ${size}: ${stock}
                            </span>`
                        ).join('');
                }

                // Hitung total stok
                const totalStock = Object.values(product.sizes).reduce((a, b) => a + b, 0);

                return `
                    <tr>
                        <td>${product.sku}</td>
                        <td>${product.name}</td>
                        <td>${product.category}</td>
                        <td>Rp ${product.price.toLocaleString()}</td>
                        <td>${sizeStockHtml}</td>
                        <td>
                            <span class="badge ${totalStock <= product.min_stock ? 'bg-warning' : 'bg-success'}">
                                ${totalStock <= product.min_stock ? 'Stok Menipis' : 'Stok Aman'}
                            </span>
                        </td>
                        <td>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-primary" onclick="editStock('${product.sku}')">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.sku}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading products:', error);
            alert('Error: ' + error.message);
        }
    }

    // Fungsi untuk menambah produk
    async function addProduct() {
        try {
            const category = document.getElementById('category').value;
            const baseData = {
                sku: document.getElementById('sku').value,
                name: document.getElementById('name').value,
                description: document.getElementById('description').value,
                category: category,
                price: parseFloat(document.getElementById('price').value) || 0,
                stock: parseInt(document.getElementById('stock').value) || 0,
                min_stock: parseInt(document.getElementById('minStock').value) || 10
            };

            console.log('Adding product with category:', category);

            let productsToAdd = [];
            
            if (category === 'Perlengkapan') {
                // Untuk perlengkapan, tambah satu produk saja dengan ukuran "-"
                productsToAdd.push({
                    ...baseData,
                    size: '-'
                });
            } else {
                // Untuk seragam, tambah produk untuk setiap ukuran
                const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
                sizes.forEach(size => {
                    productsToAdd.push({
                        ...baseData,
                        sku: `${baseData.sku}-${size}`,
                        size: size
                    });
                });
            }

            console.log('Products to add:', productsToAdd);

            const { data, error } = await db
                .from('products')
                .insert(productsToAdd)
                .select();

            if (error) throw error;

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
            modal.hide();

            // Reset form
            document.getElementById('addProductForm').reset();

            // Reload products
            await loadProducts();
            alert('Produk berhasil ditambahkan!');

        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    // Fungsi untuk update stok
    async function updateStock() {
        try {
            const productId = document.getElementById('editProductId').value;
            const stockChange = parseInt(document.getElementById('stockChange').value) || 0;
            const note = document.getElementById('stockNote').value;

            if (!productId) {
                throw new Error('ID produk tidak valid');
            }

            if (stockChange === 0) {
                throw new Error('Perubahan stok harus diisi');
            }

            console.log('Updating stock for product ID:', productId);
            console.log('Stock change:', stockChange);

            // Get current product details
            const { data: product, error: getError } = await db
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (getError) {
                console.error('Error getting product:', getError);
                throw getError;
            }

            if (!product) {
                throw new Error('Produk tidak ditemukan');
            }

            console.log('Current product:', product);

            const newStock = (product.stock || 0) + stockChange;
            if (newStock < 0) {
                throw new Error('Stok tidak boleh kurang dari 0');
            }

            console.log('New stock will be:', newStock);

            // Update stock
            const { error: updateError } = await db
                .from('products')
                .update({ 
                    stock: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId);

            if (updateError) {
                console.error('Error updating stock:', updateError);
                throw updateError;
            }

            // Add stock log
            const session = await db.auth.getSession();
            const userId = session.data.session?.user?.id;

            const { error: logError } = await db
                .from('stock_logs')
                .insert([{
                    product_id: productId,
                    change_amount: stockChange,
                    note: note || `Perubahan stok: ${stockChange}`,
                    user_id: userId,
                    created_at: new Date().toISOString()
                }]);

            if (logError) {
                console.error('Error creating stock log:', logError);
                throw logError;
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editStockModal'));
            if (modal) {
                modal.hide();
            }

            // Reset form
            const form = document.getElementById('editStockForm');
            if (form) {
                form.reset();
            }

            // Reload products
            await loadProducts();
            alert('Stok berhasil diupdate!');

        } catch (error) {
            console.error('Error in updateStock:', error);
            alert('Error: ' + error.message);
        }
    }

    // Tambahkan ke window object agar bisa diakses dari HTML
    window.updateStock = updateStock;

    // Inisialisasi event listeners dan setup awal
    function initializeForm() {
        console.log('Initializing form...');
        
        // Setup event listener untuk kategori
        const categorySelect = document.getElementById('category');
        if (!categorySelect) {
            console.error('Category select element not found!');
            return;
        }

        console.log('Found elements:', { categorySelect });

        // Reset form saat modal ditutup
        const addProductModal = document.getElementById('addProductModal');
        if (addProductModal) {
            addProductModal.addEventListener('hidden.bs.modal', function () {
                document.getElementById('addProductForm').reset();
                categorySelect.value = '';
            });
        }

        // Setup event listener untuk tombol simpan
        const saveProductBtn = document.getElementById('saveProductBtn');
        if (saveProductBtn) {
            saveProductBtn.onclick = addProduct;
        }

        // Setup event listener untuk tombol update stok
        const saveStockBtn = document.getElementById('saveStockBtn');
        if (saveStockBtn) {
            saveStockBtn.onclick = updateStock;
        }

        console.log('Form initialization complete');
    }

    // Initialize form when page loads
    initializeForm();
    console.log('Form initialized on page load');

    // Setup event listeners
    document.getElementById('searchProduct')?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#productList tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });

    // Load initial data
    await loadProducts();
    console.log('Initial products loaded');
});