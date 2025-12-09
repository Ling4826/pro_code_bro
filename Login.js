/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

// เรียกใช้ library supabase ที่เพิ่มใน HTML
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginForm = document.getElementById('login');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // ป้องกันเว็บรีเฟรชเอง

    // ดึงค่าจากช่อง input โดยใช้ ID ที่ตั้งไว้ใน HTML
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // ส่งค่าไปเช็คกับฐานข้อมูล
    const { data: user, error } = await supabaseClient
        .from('user_account')
        .select('*')
        .eq('username', email)
        .eq('ref_id', password) // เช็ค password กับ ref_id ตามเดิมที่คุณเขียนไว้
        .single();

    if (error) {
        alert('เข้าสู่ระบบไม่สำเร็จ: ' + error.message);
        return;
    }

    // บันทึก session
    sessionStorage.setItem('user_id', user.id);
    sessionStorage.setItem('user_role', user.role);
    
    alert('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ ' + sessionStorage.getItem('user_role'));
    
    // --- เปลี่ยนหน้า ---
    // *ข้อควรระวัง: ตรวจสอบว่ามีโฟลเดอร์ Admin และไฟล์ Home.html อยู่จริง
    window.location.href = '/Admin/Home.html'; 
});