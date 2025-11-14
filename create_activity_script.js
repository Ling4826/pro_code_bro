// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------------------------------------
// *โหลดปีของนักเรียน*
// -------------------------------------------------------------
async function fetchStudentYear() {
    console.log('Fetching Years...');

    const { data: years, error } = await supabaseClient
        .from('student')
        .select('year');
        
    const yearSelect = document.getElementById('studentYear');
    if (error) {
        console.error('Error fetching Years:', error.message);
        return;
    }

    if (years?.length) {
    const uniqueYears = [...new Set(years.map(s => s.year))].sort();
    yearSelect.innerHTML += uniqueYears
        .map(y => `<option value="${y}">${y}</option>`)
        .join("");
    console.log(`Years loaded successfully: ${uniqueYears.length} items`);
}

}

// -------------------------------------------------------------
// *ฟังก์ชันจัดการ Form Submission*
// -------------------------------------------------------------
async function handleCreateActivity(event) {
    event.preventDefault();
    const form = event.target;

    const activityName = form.activityName.value;
    const activityDate = form.activityDate.value;
    const startTime = form.startTime.value;
    const endTime = form.endTime.value;
    const semester = parseInt(form.semester.value, 10);
    const recurringDays = parseInt(form.recurringDays.value, 10);

    // ฟิลเตอร์ (ไม่บังคับ)
    const level = form.level.value || "";
    const majorId = form.department.value || "";
    const studentYear = form.studentYear.value || "";

    // เช็กเฉพาะฟิลด์ที่จำเป็นจริงๆ
    if (!activityName || !activityDate || !startTime || !endTime || !semester) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
    }

    try {
        // ----------------------
        //  สร้าง Query ของ student
        // ----------------------
        let studentQuery = supabaseClient
            .from('student')
            .select('id');

        //  ถ้าทั้ง 3 ฟิลเตอร์ว่าง → ดึงนักเรียนทั้งหมด
        if (!level && !majorId && !studentYear) {
            console.log("📌 ดึงนักเรียนทั้งหมด (ไม่กรอง)");
        } else {
            // กรองเฉพาะฟิลด์ที่มีค่า
            if (level) studentQuery = studentQuery.eq('level', level);
            if (majorId) studentQuery = studentQuery.eq('major_id', parseInt(majorId));
            if (studentYear) studentQuery = studentQuery.eq('year', parseInt(studentYear));
        }

        const { data: students, error: studentError } = await studentQuery;

        if (studentError) {
            console.error(studentError);
            alert("ดึงข้อมูลนักเรียนล้มเหลว");
            return;
        }

        if (!students || students.length === 0) {
            alert("⚠️ ไม่มีนักเรียนตรงตามเงื่อนไข");
            return;
        }

        // ---------------------------
        //  แปลงเวลาเป็น ISO
        // ---------------------------
        const [y, m, d] = activityDate.split("-").map(Number);
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);

        const startISO = new Date(y, m - 1, d, sh, sm).toISOString();
        const endISO = new Date(y, m - 1, d, eh, em).toISOString();

        // ---------------------------
        //  สร้าง activity
        // ---------------------------
        const { data: activity, error: activityError } = await supabaseClient
            .from("activity")
            .insert({
                name: activityName,
                start_time: startISO,
                end_time: endISO,
                major_id: majorId ? parseInt(majorId) : null,
                for_student: true,
                for_leader: true,
                for_teacher: false,
                is_recurring: recurringDays > 0 ? recurringDays : null,
                created_by: 1,
            })
            .select("id")
            .single();

        if (activityError) {
            console.error(activityError);
            alert("สร้างกิจกรรมล้มเหลว");
            return;
        }

        const activityId = activity.id;

        // ---------------------------
        // สร้าง activity_check
        // ---------------------------
        const academicYear = new Date().getFullYear();

        const checks = students.map(s => ({
            activity_id: activityId,
            student_id: s.id,
            status: "Absent",
            date: activityDate,
            semester,
            academic_year: academicYear
        }));

        const { error: checkError } = await supabaseClient
            .from("activity_check")
            .insert(checks);

        if (checkError) {
            console.error(checkError);
            alert("สร้าง activity_check ล้มเหลว");
        } else {
            alert(`✅ สร้างกิจกรรมสำเร็จ และเพิ่มนักเรียนทั้งหมด ${students.length} คน`);
            form.reset();
        }

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดภายในระบบ");
    }
}


// -------------------------------------------------------------
// *โหลดข้อมูล Major ทั้งหมด*
// -------------------------------------------------------------
async function fetchAllMajors() {
    console.log('Fetching all majors...');
    const { data: majors, error } = await supabaseClient
        .from('major')
        .select('id, name, level');

    if (error) {
        console.error('Error fetching majors:', error.message);
        alert('ไม่สามารถโหลดข้อมูลสาขาได้');
        return [];
    }

    console.log(`Loaded majors: ${majors.length} items`);
    return majors;
}

// -------------------------------------------------------------
// *อัปเดต dropdown สาขาตามระดับที่เลือก*
// -------------------------------------------------------------
function updateDepartmentOptions(selectedLevel, majors) {
    const departmentSelect = document.getElementById('department');
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';

    let filteredMajors = majors.filter(m => m.level === selectedLevel);
    if (filteredMajors.length === 0) filteredMajors = majors;

    filteredMajors.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        departmentSelect.appendChild(option);
    });
}

// -------------------------------------------------------------
// *เริ่มต้นเมื่อ DOM โหลดเสร็จ*
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    const allMajors = await fetchAllMajors();
    await fetchStudentYear();

    const levelSelect = document.getElementById('level');
    if (levelSelect) {
        levelSelect.addEventListener('change', () => {
            const selectedLevel = levelSelect.value;
            updateDepartmentOptions(selectedLevel, allMajors);
        });
    }

    flatpickr(".flatpickr-thai", {
        locale: "th",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d F Y",
    });

    flatpickr(".flatpickr-time", {
        enableTime: true,
        noCalendar: true,
        time_24hr: true,
        dateFormat: "H:i",
        altInput: true,
        altFormat: "H:i น.",
        minuteIncrement: 1,
    });

    const form = document.getElementById('createActivityForm');
    if (form) {
        form.addEventListener('submit', handleCreateActivity);
    }
});
