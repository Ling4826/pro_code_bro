// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU'; // Key ของคุณ

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


async function fetchDepartments() {
    console.log('Fetching departments...');

    // ดึงข้อมูลทั้งหมดจากตาราง 'department'
    const { data: departments, error } = await supabaseClient
        .from('department')
        .select('id, name');

    if (error) {
        console.error('Error fetching departments:', error.message);
        const departmentSelect = document.getElementById('department');
        departmentSelect.innerHTML = '<option value="">ไม่สามารถโหลดแผนกได้</option>';
        return;
    }

    const departmentSelect = document.getElementById('department');
    departmentSelect.innerHTML = '<option value="">เลือกแผนก</option>';

    if (departments) {
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            departmentSelect.appendChild(option);
        });
        console.log(`Departments loaded successfully: ${departments.length} items`);
    }
}

// -------------------------------------------------------------
// *ฟังก์ชันจัดการ Form Submission*
// -------------------------------------------------------------
async function handleCreateActivity(event) {
    event.preventDefault();
    const form = event.target;

    // 1. ดึงค่าจากฟอร์ม
    const activityName = form.activityName.value;
    const activityDate = form.activityDate.value; // YYYY-MM-DD (ค.ศ.)
    const startTime = form.startTime.value;       // HH:MM
    const endTime = form.endTime.value;         // HH:MM
    const departmentId = form.department.value;
    const recurringDays = parseInt(form.recurringDays.value, 10);

    // 2. ตรวจสอบข้อมูลเบื้องต้น
    if (!activityName || !activityDate || !startTime || !endTime || !departmentId) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
    }

    // 3. แปลงวันที่และเวลาให้อยู่ในรูปแบบ ISO 8601 (TIMESTAMP WITH TIME ZONE)
    try {
        const [year, month, day] = activityDate.split('-').map(Number);
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        // **สำคัญ:** สร้าง Date Object โดยใช้ Constructor ที่ตีความค่าเป็น Local Time (GMT+7)
        const startDateTime = new Date(year, month - 1, day, startHour, startMinute, 0);
        const endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0);

        const start_time_iso = startDateTime.toISOString();
        const end_time_iso = endDateTime.toISOString();

        // ตรวจสอบความถูกต้องของเวลา
        if (startDateTime >= endDateTime) {
            alert('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
            return;
        }

        // 4. เตรียมข้อมูลสำหรับ Insert
        const activityData = {
            name: activityName,
            start_time: start_time_iso,
            end_time: end_time_iso,
            for_student: true,
            for_leader: true,
            for_teacher: false,
            // ส่งค่า is_recurring ที่ถูกต้องตามที่คุณต้องการ
            recurrence_interval: (recurringDays > 0) ? recurringDays : null,

            created_by: 1,
            department_id: parseInt(departmentId, 10)
        };

        console.log('Activity Data to Insert:', activityData);

        // 5. Insert ข้อมูลลงใน Supabase
        const { error } = await supabaseClient
            .from('activity')
            .insert([activityData]);

        if (error) {
            console.error('Supabase Insert Error:', error);
            alert(`สร้างกิจกรรมไม่สำเร็จ: ${error.message}`);
        } else {
            alert(`สร้างกิจกรรม "${activityName}" สำเร็จแล้ว!`);
            form.reset();
        }

    } catch (e) {
        console.error('Data Processing Error:', e);
        alert('เกิดข้อผิดพลาดในการประมวลผลวันที่/เวลา');
    }
}


// -------------------------------------------------------------
// *DOM Content Loaded Event Listener (เรียกใช้ Flatpickr ที่นี่)*
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. เรียกใช้ฟังก์ชันดึงข้อมูลแผนก
    fetchDepartments();

    // 2. ตั้งค่า Flatpickr สำหรับวันที่ (ภาษาไทย/พ.ศ.)
    flatpickr(".flatpickr-thai", {
        locale: "th", // ใช้ภาษาไทย
        dateFormat: "Y-m-d", // รูปแบบข้อมูลที่ส่งค่าให้ Form (ค.ศ. สำหรับ JS)
        altInput: true,
        altFormat: "d F Y", // รูปแบบที่แสดงผลให้ผู้ใช้ (พ.ศ.)
    });

    // 3. การตั้งค่า Flatpickr สำหรับเวลา 24 ชั่วโมง
    flatpickr(".flatpickr-time", {
        enableTime: true,
        noCalendar: true,
        time_24hr: true,
        dateFormat: "H:i", // รูปแบบข้อมูลที่ส่งไป (HH:MM)
        altInput: true, // เปิดใช้งาน alt input
        altFormat: "H:i น.", // รูปแบบการแสดงผล (HH:MM น.)
        minuteIncrement: 1,
    });

    // 4. แนบ Event Listener ให้กับฟอร์ม
    const form = document.getElementById('createActivityForm');
    if (form) {
        form.addEventListener('submit', handleCreateActivity);
    }
});