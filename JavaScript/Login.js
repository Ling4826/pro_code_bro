/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const loginForm = document.getElementById('login');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const { data: user, error } = await supabaseClient
        .from('user_account')
        .select('*')
        .eq('username', email)
        .eq('ref_id', password)
        .single();

    if (error) {
        alert('Login failed: ' + error.message);
        return;
    }
    sessionStorage.setItem('user_id', user.id);
    sessionStorage.setItem('user_role', user.role);
    alert('Login successful! Welcome, ' + sessionStorage.getItem('user_role'));
    window.location.href = 'index.html';
});
