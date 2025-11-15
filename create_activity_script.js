// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------------------------------------
// *โหลดปีของนักเรียน*
// -------------------------------------------------------------
async function fetchStudentYear() {
    console.log('Fetching Years from class join...');

    // ดึงข้อมูลปีของนักเรียนจาก class
    const { data: studentYears, error } = await supabaseClient
        .from('student')
        .select('class:class_id (year)') // join กับ class
        //.eq('class.major_id', someMajorId) // ถ้าต้องการกรองสาขา
        ;

    const yearSelect = document.getElementById('studentYear');
    yearSelect.innerHTML = '<option value="">เลือกปี</option>';

    if (error) {
        console.error('Error fetching Years:', error.message);
        return;
    }

    if (studentYears && studentYears.length > 0) {
        // ดึงค่า year จาก class แล้วทำให้ unique
        const uniqueYears = [...new Set(studentYears.map(s => s.class.year))].sort();
        uniqueYears.forEach(y => {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            yearSelect.appendChild(option);
        });
        console.log(`Years loaded successfully: ${uniqueYears.length} items`);
    } else {
        console.warn('No year data found');
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

    if (!activityName || !activityDate || !startTime || !endTime || !semester) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
    }

    try {
        // ------------------------------------------------
        // 1️⃣ ดึง major ตาม level (ถ้าเลือก level)
        // ------------------------------------------------
        let majorIdsFromLevel = [];

        if (level) {
            const { data: majors, error: majorError } = await supabaseClient
                .from("major")
                .select("id")
                .eq("level", level);

            if (majorError) throw majorError;

            majorIdsFromLevel = majors.map(m => m.id);
        }

        // ------------------------------------------------
        // 2️⃣ Query class ตาม major_id, level, year
        // ------------------------------------------------
        let classQuery = supabaseClient.from("class").select("id, major_id, year");

        // ถ้าเลือก major → ใช้ major โดยตรง
        if (majorId) {
            classQuery = classQuery.eq("major_id", parseInt(majorId));
        }
        // ถ้าไม่เลือก major แต่เลือก level → ใช้ majorIds จาก level
        else if (majorIdsFromLevel.length > 0) {
            classQuery = classQuery.in("major_id", majorIdsFromLevel);
        }

        // ถ้าเลือก year → กรองตาม class.year
        if (studentYear) {
            classQuery = classQuery.eq("year", parseInt(studentYear));
        }

        const { data: classes, error: classError } = await classQuery;
        if (classError) throw classError;

        if (!classes || classes.length === 0) {
            alert("⚠️ ไม่พบ class ตามเงื่อนไขที่เลือก");
            return;
        }

        const classIds = classes.map(c => c.id);

        // ------------------------------------------------
        // 3️⃣ ดึง student จาก class_id
        // ------------------------------------------------
        const { data: students, error: studentError } = await supabaseClient
            .from("student")
            .select("id, class_id")
            .in("class_id", classIds);

        if (studentError) throw studentError;

        if (!students || students.length === 0) {
            alert("⚠️ ไม่มีนักเรียนในคลาสตามที่เลือก");
            return;
        }

        // ------------------------------------------------
        // 4️⃣ แปลงวันที่เป็น ISO format
        // ------------------------------------------------
        const [y, m, d] = activityDate.split("-").map(Number);
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);

        const startISO = new Date(y, m - 1, d, sh, sm).toISOString();
        const endISO = new Date(y, m - 1, d, eh, em).toISOString();

        // ------------------------------------------------
        // 5️⃣ สร้าง activity
        // ------------------------------------------------
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
                is_recurring: recurringDays > 0,
                created_by: 1,
            })
            .select("id")
            .single();

        if (activityError) throw activityError;

        const activityId = activity.id;

        // ------------------------------------------------
        // 6️⃣ สร้าง activity_check
        // ------------------------------------------------
        const academicYear = new Date().getFullYear();
        const checks = students.map(s => ({
            activity_id: activityId,
            student_id: s.id,
            status: null,
            date: activityDate,
            semester,
            academic_year: academicYear,
        }));

        const { error: checkError } = await supabaseClient
            .from("activity_check")
            .insert(checks);

        if (checkError) throw checkError;

        alert(`✅ สร้างกิจกรรมสำเร็จ และเพิ่มนักเรียนทั้งหมด ${students.length} คน`);
        form.reset();

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาด: " + (err.message || JSON.stringify(err)));
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
