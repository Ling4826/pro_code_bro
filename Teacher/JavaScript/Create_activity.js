// JavaScript/Create_activity.js

const CONFIG = {
    API_URL: 'PHP/Create_activities.php'
};

// ตัวแปรเก็บข้อมูลสาขาทั้งหมด (โหลดครั้งเดียวตอนเข้าหน้าเว็บ)
let allMajors = [];

// ==========================================
// 1. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupFlatpickr();
    
    // โหลดข้อมูลสาขาวิชาเตรียมไว้
    await fetchMajors();
});

// ==========================================
// 2. EVENTS
// ==========================================
function setupEventListeners() {
    // Submit Form
    document.getElementById('createActivityForm').addEventListener('submit', handleCreateActivity);

    // เมื่อเลือก "ระดับ" (ปวช./ปวส.) -> กรองสาขา และ สร้างตัวเลือกปี
    document.getElementById('level').addEventListener('change', handleLevelChange);

    // เมื่อเลือก "สาขา" หรือ "ปี" -> ให้ไปโหลดรายชื่อ "ห้อง"
    document.getElementById('department').addEventListener('change', fetchClasses);
    document.getElementById('studentYear').addEventListener('change', fetchClasses);
}

// ==========================================
// 3. DATA FETCHING (ส่วนที่หายไป)
// ==========================================

// 3.1 ดึงรายชื่อสาขาทั้งหมด
async function fetchMajors() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=get_majors`);
        const result = await response.json();
        
        if (result.status === 'success') {
            allMajors = result.data; // เก็บใส่ตัวแปรไว้กรองภายหลัง
        } else {
            console.error('Error fetching majors:', result.message);
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

// 3.2 ทำงานเมื่อเปลี่ยน Dropdown "ระดับ"
function handleLevelChange() {
    const level = document.getElementById('level').value; // ปวช. หรือ ปวส.
    const deptSelect = document.getElementById('department');
    const yearSelect = document.getElementById('studentYear');
    const classSelect = document.getElementById('studentClass');

    // เคลียร์ค่าเก่า
    deptSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    yearSelect.innerHTML = '<option value="">เลือกปี</option>';
    classSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    if (!level) return;

    // กรองสาขาให้ตรงกับระดับที่เลือก
    const filteredMajors = allMajors.filter(m => m.level === level);
    filteredMajors.forEach(major => {
        const option = document.createElement('option');
        option.value = major.id;
        option.textContent = major.name;
        deptSelect.appendChild(option);
    });

    // สร้างตัวเลือกปี (ปวช. มี 3 ปี, ปวส. มี 2 ปี)
    const maxYear = (level === 'ปวช.') ? 3 : 2;
    for (let i = 1; i <= maxYear; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `ปี ${i}`;
        yearSelect.appendChild(option);
    }
}

// 3.3 ดึงข้อมูลห้องเรียน (เมื่อเลือก สาขา + ปี ครบแล้ว)
async function fetchClasses() {
    const majorId = document.getElementById('department').value;
    const year = document.getElementById('studentYear').value;
    const classSelect = document.getElementById('studentClass');

    // เคลียร์ห้องเก่าเสมอ
    classSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    // ถ้ายังเลือกไม่ครบ ไม่ต้องไปดึงข้อมูล
    if (!majorId || !year) return;

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=get_classes&majorId=${majorId}&year=${year}`);
        const result = await response.json();

        if (result.status === 'success') {
            result.data.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.id; // ส่ง class_id ไป
                option.textContent = cls.class_name;
                classSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching classes:', error);
    }
}

// ==========================================
// 4. FORM SUBMISSION
// ==========================================
async function handleCreateActivity(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังบันทึก...';

    // แปลงวันที่
    const dateDisplay = document.getElementById('activityDate').value;
    const dateParts = dateDisplay.split('/');
    const isoDate = (dateParts.length === 3) ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : '';

    if(!isoDate) {
        alert('รูปแบบวันที่ไม่ถูกต้อง');
        submitBtn.disabled = false;
        submitBtn.textContent = 'สร้างกิจกรรม'; // คืนค่าข้อความปุ่ม
        return;
    }

    // ดึงค่า classId จาก Dropdown (ถ้าไม่ได้เลือกจะเป็นค่าว่าง)
    const selectedClassId = document.getElementById('studentClass').value;

    const payload = {
        activityName: document.getElementById('activityName').value,
        activityType: document.getElementById('activityType').value,
        activityDate: isoDate,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        semester: document.getElementById('semester').value,
        recurringDays: document.getElementById('recurringDays').value, 
        
        // ส่ง classId ที่เลือกไป (ถ้าเป็นค่าว่าง Backend จะมองว่าเป็นกิจกรรมรวม)
        classId: selectedClassId || null, 
        
        academicYear: new Date().getFullYear() + 543 
    };

    try {
        const res = await fetch(`${CONFIG.API_URL}?action=create_activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (result.status === 'success') {
            alert(result.message);
            window.location.href = 'Activity_list.html';
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
        console.error(err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'สร้างกิจกรรม';
    }
}

// ==========================================
// 5. UTILS
// ==========================================
function setupFlatpickr() {
    if (window.flatpickr) {
        flatpickr("#activityDate", {
            dateFormat: "d/m/Y",
            locale: "th",
            defaultDate: new Date()
        });
        
        const timeConfig = {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            locale: "th"
        };
        flatpickr("#startTime", timeConfig);
        flatpickr("#endTime", timeConfig);
    }
}