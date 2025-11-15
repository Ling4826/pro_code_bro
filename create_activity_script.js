// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------------------------------------
// *ฟังก์ชันจัดการ Form Submission*
// (ส่วนนี้ไม่มีการแก้ไข)
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
    const classSelect = form.studentClass.value || null;
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
        // **หมายเหตุ: ตรงนี้ใช้ class.year ที่อ้างอิงจากตาราง class ซึ่งอาจเป็น 1, 2, 3**
        // หากต้องการอ้างอิงจากข้อมูลปีที่เป็น 1, 2 สำหรับ ปวส. ต้องมั่นใจว่า class.year ถูก set ตามนั้น
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
        // เนื่องจาก `activityDate` มาในรูปแบบ YYYY-MM-DD
        const dateParts = activityDate.split("-").map(Number);
        const [y, m, d] = dateParts.length === 3 ? dateParts : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()];
        
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);

        // สร้าง Date object โดยใช้ Date (year, monthIndex, day, hours, minutes)
        // monthIndex คือ 0-11, ดังนั้นต้องลบ 1 ออกจากเดือน
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
                // major_id จะถูกใส่เฉพาะเมื่อมีการเลือกสาขาใน dropdown เท่านั้น
                class_id: classSelect ? parseInt(classSelect, 10) : null,
                for_student: true,
                for_leader: true,
                for_teacher: false,
                is_recurring: recurringDays > 0,
                // **สมมติว่าผู้สร้างคือ created_by: 1 (Admin/Teacher)**
                created_by: 1, 
            })
            .select("id")
            .single();

        if (activityError) throw activityError;

        const activityId = activity.id;

        // ------------------------------------------------
        // 6️⃣ สร้าง activity_check
        // ------------------------------------------------
        const currentYear = new Date().getFullYear();
        // หากต้องการปีการศึกษาไทย (พ.ศ.) ให้ใช้ currentYear + 543
        const academicYear = currentYear + 543; 
        
        // ตรวจสอบว่า `activityDate` เป็นรูปแบบ 'YYYY-MM-DD'
        const insertDate = activityDate.split(' ').length > 1 ? activityDate.split(' ')[0] : activityDate;
        
        const checks = students.map(s => ({
            activity_id: activityId,
            student_id: s.id,
            status: 'Pending', // กำหนดสถานะเริ่มต้น
            date: insertDate,
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
async function fetchClasses(level, majorId, year) {
    let classQuery = supabaseClient.from("class").select("id, class_name, major_id, year");

    // กรองตาม major_id
    if (majorId) {
        classQuery = classQuery.eq("major_id", parseInt(majorId, 10));
    } else if (level) {
        // ถ้าไม่มี majorId แต่เลือก level → ดึง major_ids ตาม level
        const { data: majors, error: majorError } = await supabaseClient
            .from("major")
            .select("id")
            .eq("level", level);
        if (majorError) throw majorError;

        const majorIds = majors.map(m => m.id);
        if (majorIds.length > 0) {
            classQuery = classQuery.in("major_id", majorIds);
        }
    }

    // กรองตาม year
    if (year) {
        classQuery = classQuery.eq("year", parseInt(year, 10));
    }

    const { data: classes, error } = await classQuery;
    if (error) throw error;
    return classes || [];
}

// -------------------------------------------------------------
// *อัปเดต dropdown ของ Class*
// -------------------------------------------------------------
async function updateClassDropdown() {
    const level = document.getElementById('level').value;
    const majorId = document.getElementById('department').value;
    const year = document.getElementById('studentYear').value;

    const classSelect = document.getElementById('studentClass');
    classSelect.innerHTML = '<option value="">เลือกห้องเรียน</option>';

    if (!level && !majorId && !year) return;

    try {
        const classes = await fetchClasses(level, majorId, year);
        classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.class_name || `Class ${c.id}`;
            classSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error fetching classes:", err);
        alert("ไม่สามารถโหลดห้องเรียนได้");
    }
}

// -------------------------------------------------------------
// *อัปเดต dropdown สาขาและปีตามระดับที่เลือก*
// -------------------------------------------------------------
function handleLevelChange(selectedLevel, majors) {
    const departmentSelect = document.getElementById('department');
    const yearSelect = document.getElementById('studentYear');
    
    // 1. Reset dropdown
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    yearSelect.innerHTML = '<option value="">เลือกปี</option>';

    if (!selectedLevel) {
        // ถ้าไม่ได้เลือกระดับ ให้จบการทำงาน
        return;
    }

    // 2. กรองและแสดงสาขาตามระดับที่เลือก
    const filteredMajors = majors.filter(m => m.level === selectedLevel);

    filteredMajors.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        departmentSelect.appendChild(option);
    });

    // 3. กำหนดตัวเลือกปีตามระดับ (Hardcode ตามหลักสูตร)
    let years = [];
    if (selectedLevel === 'ปวช.') {
        // ปวช. มี 3 ปี
        years = [1, 2, 3]; 
    } else if (selectedLevel === 'ปวส.') {
        // ปวส. มี 2 ปี
        years = [1, 2]; 
    }
    
    years.forEach(y => {
        const option = document.createElement('option');
        // ใช้ year 3 สำหรับ ปวส. ถ้า class.year ใน DB ถูกตั้งค่าเป็น 3 ทั้งหมด
        // แต่ในโค้ดเดิมใช้ year 1, 2 ใน CTE และมีการ Join กับ class.year
        // ดังนั้นเพื่อให้ UI ตรงกับข้อมูลที่ควรจะเป็นสำหรับ ปวส. (ปี 1 และ ปี 2) ให้ใช้ค่า 1, 2
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
    });
    departmentSelect.addEventListener('change', updateClassDropdown);
    yearSelect.addEventListener('change', updateClassDropdown);
    updateClassDropdown();
}

// -------------------------------------------------------------
// *เริ่มต้นเมื่อ DOM โหลดเสร็จ*
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // 1. โหลดข้อมูลสาขาทั้งหมด
    const allMajors = await fetchAllMajors();
    
    // **ลบ: fetchStudentYear();** -> ไม่จำเป็นแล้ว
    // **เนื่องจากเรา hardcode ตัวเลือกปีใน handleLevelChange()**

    const levelSelect = document.getElementById('level');
    if (levelSelect) {
        levelSelect.addEventListener('change', () => {
            const selectedLevel = levelSelect.value;
            // เรียกใช้ฟังก์ชันใหม่
            handleLevelChange(selectedLevel, allMajors);
        });
    }
    
    // ตั้งค่า Flatpickr เหมือนเดิม
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