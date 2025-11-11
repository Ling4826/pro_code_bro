// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

// สร้าง Supabase Client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * ฟังก์ชันหลักในการจัดการ Form Submission
 * @param {Event} event - event ของการ submit ฟอร์ม
 */
async function handleCreateActivity(event) {
    event.preventDefault(); // ป้องกันการโหลดหน้าใหม่

    const form = event.target;
    
    // 1. ดึงค่าจากฟอร์ม
    const activityName = form.activityName.value;
    const activityDate = form.activityDate.value; // เช่น "10/11/2568"
    const startTime = form.startTime.value;       // เช่น "08:00"
    const endTime = form.endTime.value;         // เช่น "08:30"
    const departmentId = form.department.value;
    const level = form.level.value; // ไม่ได้ใช้ในการ Insert ตาราง activity โดยตรง แต่ใช้ในการ Filter/กำหนดกลุ่มเป้าหมายในอนาคต
    const recurringDays = parseInt(form.recurringDays.value, 10);
    
    // 2. ตรวจสอบข้อมูลเบื้องต้น
    if (!activityName || !activityDate || !startTime || !endTime || !departmentId) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
    }

    // 3. แปลงวันที่และเวลาให้อยู่ในรูปแบบ ISO 8601 (TIMESTAMP WITH TIME ZONE) ที่ Supabase ต้องการ
    try {
        // แปลงวันที่ไทย (วว/ดด/ปปปป) เป็น YYYY-MM-DD
        const [day, month, thaiYear] = activityDate.split('/').map(Number);
        const gregorianYear = thaiYear - 543; // แปลง พ.ศ. เป็น ค.ศ.
        
        // สร้าง DateTime Object (Supabase จะจัดการ Time Zone เอง)
        const start_time_iso = new Date(gregorianYear, month - 1, day, parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1])).toISOString();
        const end_time_iso = new Date(gregorianYear, month - 1, day, parseInt(endTime.split(':')[0]), parseInt(endTime.split(':')[1])).toISOString();
        
        // ตรวจสอบความถูกต้องของเวลา
        if (new Date(start_time_iso) >= new Date(end_time_iso)) {
             alert('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
             return;
        }

        // 4. เตรียมข้อมูลสำหรับ Insert
        const activityData = {
            name: activityName,
            start_time: start_time_iso,
            end_time: end_time_iso,
            // ในที่นี้กำหนดให้กิจกรรมสำหรับนักเรียนและผู้นำเป็น TRUE เสมอ ถ้าไม่ได้มีเงื่อนไขต่างออกไป
            for_student: true, 
            for_leader: true,
            for_teacher: false,
            is_recurring: recurringDays > 0, // กำหนด is_recurring เป็น True ถ้ามีการกำหนดวันซ้ำ
            created_by: 1, // *สมมติว่าผู้สร้างคือ Admin (user_account.id = 1)* - ในระบบจริงต้องดึงจาก Session/Login
            department_id: parseInt(departmentId, 10)
            // หมายเหตุ: ถ้าใช้ level (ปวช/ปวส) ในการกรอง ต้องเพิ่มตารางความสัมพันธ์หรือใช้ตาราง department
        };
        
        // 5. Insert ข้อมูลลงใน Supabase
        const { data, error } = await supabase
            .from('activity')
            .insert([activityData]);

        if (error) {
            console.error('Supabase Insert Error:', error.message);
            alert(`สร้างกิจกรรมไม่สำเร็จ: ${error.message}`);
        } else {
            alert(`สร้างกิจกรรม "${activityName}" สำเร็จแล้ว!`);
            form.reset(); // ล้างฟอร์ม
            // อาจเปลี่ยนเส้นทางไปยังหน้าตรวจสอบกิจกรรม
            // window.location.href = 'check_activity.html'; 
        }

    } catch (e) {
        console.error('Data Processing Error:', e);
        alert('เกิดข้อผิดพลาดในการประมวลผลวันที่/เวลา');
    }
}

// แนบ Event Listener เมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createActivityForm');
    if (form) {
        form.addEventListener('submit', handleCreateActivity);
    }
});