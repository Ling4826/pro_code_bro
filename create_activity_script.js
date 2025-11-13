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
        yearSelect.innerHTML = '<option value="">ไม่สามารถโหลดปีการศึกษาได้</option>';
        return;
    }

    yearSelect.innerHTML = '<option value="">เลือกปี</option>';

    if (years && years.length > 0) {
        const uniqueYears = [...new Set(years.map(item => item.year))].sort();
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

    // 1. ดึงค่าจากฟอร์ม
    const activityName = form.activityName.value;
    const activityDate = form.activityDate.value;
    const startTime = form.startTime.value;
    const endTime = form.endTime.value;
    const majorId = form.department.value;
    const recurringDays = parseInt(form.recurringDays.value, 10);
    const semester = parseInt(form.semester.value, 10);
    const studentYear = parseInt(form.studentYear.value, 10);

    if (!activityName || !activityDate || !startTime || !endTime || !majorId || !semester || !studentYear) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
    }

    try {
        // 🟢 ขั้นแรก: ตรวจว่านักเรียนในสาขา/ปีนี้มีไหม (ก่อนสร้าง activity)
        const { data: students, error: studentError } = await supabaseClient
            .from('student')
            .select('id')
            .eq('year', studentYear)
            .eq('major_id', majorId);

        if (studentError) {
            console.error('Error fetching students:', studentError);
            alert('ไม่สามารถโหลดรายชื่อนักเรียนได้');
            return;
        }

        if (!students || students.length === 0) {
            alert('⚠️ ไม่พบนักเรียนในปีและสาขาที่เลือก — ระบบจะไม่สร้างกิจกรรม');
            return; // ❌ หยุดทำงานก่อน insert activity
        }

        // 2. แปลงเวลาเป็น ISO 8601
        const [year, month, day] = activityDate.split('-').map(Number);
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const startDateTime = new Date(year, month - 1, day, startHour, startMinute, 0);
        const endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0);

        if (startDateTime >= endDateTime) {
            alert('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
            return;
        }

        const start_time_iso = startDateTime.toISOString();
        const end_time_iso = endDateTime.toISOString();

        // 3. เตรียมข้อมูลกิจกรรม
        const activityData = {
            name: activityName,
            start_time: start_time_iso,
            end_time: end_time_iso,
            for_student: true,
            for_leader: true,
            for_teacher: false,
            is_recurring: (recurringDays > 0) ? recurringDays : null,
            created_by: 1,
            major_id: parseInt(majorId, 10)
        };

        console.log('Activity Data to Insert:', activityData);

        // 4. Insert activity
        const { data: insertedActivity, error: insertError } = await supabaseClient
            .from('activity')
            .insert([activityData])
            .select('id')
            .single();

        if (insertError) {
            console.error('Supabase Insert Error:', insertError);
            alert(`สร้างกิจกรรมไม่สำเร็จ: ${insertError.message}`);
            return;
        }

        const activityId = insertedActivity.id;
        console.log('✅ Activity Created with ID:', activityId);

        // 5. เตรียมข้อมูลสำหรับ activity_check
        const academicYear = new Date(activityDate).getFullYear();
        const checkRecords = students.map(s => ({
            activity_id: activityId,
            student_id: s.id,
            status: 'Absent',
            date: activityDate,
            semester: semester,
            academic_year: academicYear
        }));

        // 6. Insert activity_check ทั้งหมด
        const { error: checkError } = await supabaseClient
            .from('activity_check')
            .insert(checkRecords);

        if (checkError) {
            console.error('Error inserting activity_check:', checkError);
            alert(`เกิดข้อผิดพลาดตอนเพิ่ม activity_check: ${checkError.message}`);
        } else {
            alert(`✅ สร้างกิจกรรม "${activityName}" และบันทึกนักเรียน ${students.length} คนสำเร็จแล้ว`);
            form.reset();
        }

    } catch (e) {
        console.error('Data Processing Error:', e);
        alert('เกิดข้อผิดพลาดในการประมวลผลวันที่/เวลา');
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
