// Wait for DOM and Supabase to be ready
document.addEventListener('DOMContentLoaded', () => {
    const db = window.db;
    if (!db) {
        console.error('Supabase client not initialized');
        return;
    }

    const auth = db.auth;

    // Login handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const { data, error } = await auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                window.location.href = 'pages/dashboard.html';
            } catch (error) {
                console.error('Error:', error);
                alert('Error logging in: ' + error.message);
            }
        });
    }

    // Register handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const fullName = document.getElementById('fullName').value;

            try {
                const { data, error } = await auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                });

                if (error) throw error;

                alert('Registration successful! Please check your email to confirm your account.');
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Error:', error);
                alert('Error registering: ' + error.message);
            }
        });
    }

    // Check auth status if not on login or register page
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'index.html' && currentPage !== 'register.html') {
        checkAuth();
    }

    async function checkAuth() {
        const { data: { session }, error } = await auth.getSession();
        if (error || !session) {
            window.location.href = '../index.html';
        }
    }
}); 