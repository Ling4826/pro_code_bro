/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginForm = document.getElementById('login');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); 

    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // 1. เช็คตาราง user_account ก่อน (Admin / Teacher / Student)
    const { data: user, error } = await supabaseClient
        .from('user_account')
        .select('*')
        .eq('username', email)
        .eq('ref_id', password)
        .single();

    if (error || !user) {
        alert('เข้าสู่ระบบไม่สำเร็จ: ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        return;
    }

    // เก็บ Session เบื้องต้น
    sessionStorage.setItem('user_id', user.id);
    sessionStorage.setItem('user_role', user.role);
    sessionStorage.setItem('ref_id', user.ref_id); // เก็บ ref_id (รหัสนักเรียน) ไว้ใช้ต่อ

    const mainRole = user.role.toLowerCase();

    // --- ตรวจสอบ Role เพื่อแยกหน้า ---

    if (mainRole === 'admin') {
        alert('ยินดีต้อนรับผู้ดูแลระบบ');
        window.location.href = 'Admin/Home.html';

    } else if (mainRole === 'teacher') {
        alert('ยินดีต้อนรับอาจารย์');
        window.location.href = 'Teacher/Home.html';

    } else if (mainRole === 'student') {
        // *** 2. ถ้าเป็นนักเรียน ให้ไปเช็คต่อว่าเป็น "หัวหน้าห้อง (Leader)" หรือไม่ ***
        const { data: studentInfo, error: stError } = await supabaseClient
            .from('student')
            .select('role') // ดึง role จากตาราง student (Student หรือ Leader)
            .eq('id', user.ref_id) // ใช้ ref_id (รหัสนักเรียน) ในการหา
            .single();

        if (stError) {
            alert('เกิดข้อผิดพลาดในการดึงข้อมูลนักเรียน');
            return;
        }

        // เช็คว่าเป็น Leader หรือไม่
        if (studentInfo.role === 'Leader') {
            alert('ยินดีต้อนรับหัวหน้าห้อง (Leader)');
            // ไปหน้าสำหรับหัวหน้าห้อง (คุณต้องสร้างโฟลเดอร์ Leader หรือใช้หน้าร่วมกันแต่เปิดสิทธิ์เพิ่ม)
            window.location.href = 'Leader/Home.html'; 
        } else {
            alert('ยินดีต้อนรับนักเรียน');
            // ไปหน้าสำหรับนักเรียนทั่วไป
            window.location.href = 'Student/Home.html';
        }

    } else {
        alert('ไม่พบสิทธิ์การเข้าใช้งาน');
    }
});