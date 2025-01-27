// Use the global db instance
const auth = window.db.auth;

const SUPABASE_URL = 'https://crwxvkrsqdkzcmrmjefq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3h2a3JzcWRremNtcm1qZWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4NTgyMTEsImV4cCI6MjA1MzQzNDIxMX0.DeEvmP9-ZZYA1hJwY5BvuT5kFV2x8_1s9bEsnlT0yIs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = document.getElementById('role').value;

    if (password !== confirmPassword) {
        alert('Password dan konfirmasi password tidak cocok!');
        return;
    }

    try {
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Mendaftar...';

        // Step 1: Daftar user tanpa verifikasi email
        const { data: { user }, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                },
                emailRedirectTo: window.location.origin
            }
        });

        if (signUpError) throw signUpError;
        if (!user) throw new Error('Pendaftaran gagal - tidak ada data user');

        // Step 2: Langsung login setelah register
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) throw signInError;

        // Step 3: Dapatkan role_id
        const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id')
            .eq('name', role)
            .single();

        if (roleError) throw roleError;

        // Step 4: Insert ke user_roles
        const { error: userRoleError } = await supabase
            .from('user_roles')
            .insert([{
                user_id: user.id,
                role_id: roleData.id
            }]);

        if (userRoleError) throw userRoleError;

        alert('Pendaftaran berhasil!');
        window.location.href = 'pages/dashboard.html';

    } catch (error) {
        console.error('Error detail:', error);
        alert('Error: ' + error.message);
    } finally {
        const submitButton = document.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Daftar';
    }
});

// Fungsi untuk mendapatkan role_id berdasarkan nama role
async function getRoleId(roleName) {
    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single();

    if (error) throw error;
    return data.id;
}

// Tambahkan link ke halaman register di index.html 