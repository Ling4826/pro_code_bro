// ไฟล์: JavaScript/Edit_activity.js

const CONFIG = {
    API_URL: 'PHP/api_check_activity.php',         // สำหรับดึง/บันทึกกิจกรรม
    MASTER_DATA_URL: 'PHP/Create_activities.php'   // สำหรับดึงตัวเลือก สาขา/ห้องเรียน
};

const params = new URLSearchParams(window.location.search);
const activityId = params.get('activityId');
let allMajors = []; // เก็บข้อมูลสาขาทั้งหมด

// ==========================================
// 1. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. ใส่ CSS ตารางและปุ่ม Checkbox
    injectTableStyles();

    // 2. โหลดข้อมูลสาขา (Major) มารอก่อน เพื่อใส่ใน Dropdown
    await fetchMajorsData();

    // 3. ผูก Event Listener ให้ Dropdown (เมื่อเปลี่ยนค่า ให้โหลดตัวเลือกใหม่)
    setupDropdownEvents();

    // 4. ตรวจสอบ ID และโหลดข้อมูลกิจกรรม
    if (!activityId) {
        alert('ไม่พบรหัสกิจกรรม (Activity ID)');
        window.location.href = 'Activity_list.html';
        return;
    }
    await loadActivityData();

    // 5. ผูกปุ่มบันทึก
    const form = document.getElementById('createActivityForm'); 
    if (form) {
        form.addEventListener('submit', handleSave);
    }
});

// ==========================================
// 2. DATA FETCHING (MASTER DATA)
// ==========================================
async function fetchMajorsData() {
    try {
        const res = await fetch(`${CONFIG.MASTER_DATA_URL}?action=get_majors`);
        const result = await res.json();
        if (result.status === 'success') {
            allMajors = result.data;
            populateLevelDropdown(); // สร้างตัวเลือก "ระดับ" (ปวช./ปวส.)
        }
    } catch (err) {
        console.error('Error fetching majors:', err);
    }
}

// สร้างตัวเลือกใน Dropdown ระดับ (Level)
function populateLevelDropdown() {
    const levelSelect = document.getElementById('level');
    if (!levelSelect) return;

    const levels = [...new Set(allMajors.map(m => m.level))];
    levelSelect.innerHTML = '<option value="">เลือกระดับ</option>';
    levels.forEach(lvl => {
        levelSelect.innerHTML += `<option value="${lvl}">${lvl}</option>`;
    });
}

// ฟังก์ชันโหลดห้องเรียน (Class) ตามเงื่อนไข
async function fetchClasses(level, majorId, year) {
    const classSelect = document.getElementById('studentClass');
    if (!classSelect) return;

    classSelect.innerHTML = '<option value="">กำลังโหลด...</option>';
    classSelect.disabled = true;

    try {
        const params = new URLSearchParams({
            action: 'get_classes',
            level: level || '',
            majorId: majorId || '',
            year: year || ''
        });

        const res = await fetch(`${CONFIG.MASTER_DATA_URL}?${params}`);
        const result = await res.json();

        classSelect.innerHTML = '<option value="">เลือกห้องเรียน</option>';
        if (result.status === 'success' && result.data.length > 0) {
            result.data.forEach(c => {
                const className = c.class_name ? c.class_name : `ห้อง ${c.class_number}`;
                classSelect.innerHTML += `<option value="${c.id}">${className}</option>`;
            });
            classSelect.disabled = false;
        } else {
            classSelect.innerHTML = '<option value="">ไม่พบห้องเรียน</option>';
        }
    } catch (err) {
        console.error(err);
        classSelect.innerHTML = '<option value="">เกิดข้อผิดพลาด</option>';
    }
}

// ==========================================
// 3. LOAD ACTIVITY DATA & RENDER
// ==========================================
async function loadActivityData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?activity_id=${activityId}`);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        if (data.status === 'error') throw new Error(data.message);

        // Render ข้อมูลกิจกรรม (Header)
        if (data.activity) {
            await renderActivityForm(data.activity);
        }

        // Render ตารางนักเรียน (Table)
        if (data.students && Array.isArray(data.students)) {
            renderAttendanceTable(data.students);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message);
    }
}

// ฟังก์ชันแสดงข้อมูลลงฟอร์ม (สำคัญ: ต้องรอ Dropdown โหลดเสร็จก่อนใส่ค่า)
async function renderActivityForm(activity) {
    const setValue = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
    };

    setValue('activityName', activity.name);
    setValue('activityType', activity.activity_type);
    setValue('semester', activity.semester || 1);
    setValue('recurringDays', activity.is_recurring ? 1 : 0);
    
    // ตั้งค่า DatePicker
    setupFlatpickr(activity.start_time, activity.end_time);

    // *** ส่วนจัดการ Dropdown (Level -> Major -> Year -> Class) ***
    // ถ้ากิจกรรมนี้มี Class ID (ไม่ใช่แบบเหมารวม) ให้พยายามเลือก Dropdown ให้ตรง
    if (activity.major_level) {
        setValue('level', activity.major_level);
        
        // 1. Trigger การเปลี่ยน Level เพื่อโหลดสาขา
        handleLevelChange(); 

        // 2. ใส่ค่าสาขา (Major)
        if (activity.major_id) {
            setValue('department', activity.major_id);
        }

        // 3. ใส่ค่าปี (Year)
        if (activity.year) {
            setValue('studentYear', activity.year);
        }

        // 4. โหลดห้องเรียน แล้วใส่ค่าห้อง (Class)
        // ต้องรอ fetchClasses เสร็จก่อน ถึงจะ setValue ได้
        await fetchClasses(activity.major_level, activity.major_id, activity.year);
        
        if (activity.class_id) {
            setValue('studentClass', activity.class_id);
        }
    }
}

// ==========================================
// 4. EVENT HANDLERS (DROPDOWN LOGIC)
// ==========================================
function setupDropdownEvents() {
    const levelSelect = document.getElementById('level');
    const deptSelect = document.getElementById('department');
    const yearSelect = document.getElementById('studentYear');
    
    if (levelSelect) levelSelect.addEventListener('change', handleLevelChange);
    
    // เมื่อเปลี่ยน Level, Dept, หรือ Year ให้โหลดห้องเรียนใหม่
    if (levelSelect) levelSelect.addEventListener('change', () => triggerFetchClass());
    if (deptSelect) deptSelect.addEventListener('change', () => triggerFetchClass());
    if (yearSelect) yearSelect.addEventListener('change', () => triggerFetchClass());
}

function handleLevelChange() {
    const levelSelect = document.getElementById('level');
    const deptSelect = document.getElementById('department');
    const yearSelect = document.getElementById('studentYear');
    
    if(!levelSelect || !deptSelect || !yearSelect) return;

    const selectedLevel = levelSelect.value;
    
    // Reset Dept
    deptSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    const filteredMajors = allMajors.filter(m => m.level === selectedLevel);
    filteredMajors.forEach(m => {
        deptSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });

    // Reset Year
    yearSelect.innerHTML = '<option value="">เลือกปี</option>';
    let years = [];
    if (selectedLevel === 'ปวช.') years = [1, 2, 3];
    else if (selectedLevel === 'ปวส.') years = [1, 2];
    
    years.forEach(y => {
        yearSelect.innerHTML += `<option value="${y}">ปี ${y}</option>`;
    });
}

function triggerFetchClass() {
    const level = document.getElementById('level').value;
    const majorId = document.getElementById('department').value;
    const year = document.getElementById('studentYear').value;
    fetchClasses(level, majorId, year);
}

// ==========================================
// 5. TABLE & CHECKBOX LOGIC
// ==========================================
function renderAttendanceTable(students) {
    const tbody = document.querySelector('.attendance-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const statusMap = { 'Attended': 'present', 'Absent': 'absent' };

    students.forEach((student, index) => {
        const tr = document.createElement('tr');
        tr.dataset.checkId = student.check_id;
        tr.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';

        const uiStatus = statusMap[student.status] || ''; 
        const groupName = `status_${student.check_id}`; 

        tr.innerHTML = `
            <td style="text-align:left; padding-left:15px; color:#333;">${student.student_name}</td>
            <td style="text-align:center; color:#333;">${student.student_id}</td>
            
            <td class="status-col" style="text-align:center;">
                <input type="checkbox" name="${groupName}" value="Attended" 
                       ${uiStatus === 'present' ? 'checked' : ''} 
                       class="status-checkbox present" onclick="onlyOne(this)">
            </td>
            
            <td class="status-col" style="text-align:center;">
                <input type="checkbox" name="${groupName}" value="Absent" 
                       ${uiStatus === 'absent' ? 'checked' : ''} 
                       class="status-checkbox absent" onclick="onlyOne(this)">
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.onlyOne = function(checkbox) {
    const checkboxes = document.getElementsByName(checkbox.name);
    checkboxes.forEach((item) => {
        if (item !== checkbox) item.checked = false;
    });
}

// ==========================================
// 6. SAVE LOGIC
// ==========================================
async function handleSave(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : 'บันทึก';
    
    if(submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังบันทึก...';
    }

    try {
        const dateStr = document.getElementById('activityDate').value;
        const isoDate = convertDateToISO(dateStr); 
        
        if (!isoDate) throw new Error("กรุณาระบุวันที่ให้ถูกต้อง");

        const startTimeVal = document.getElementById('startTime').value;
        const endTimeVal = document.getElementById('endTime').value;
        const classIdVal = document.getElementById('studentClass').value; // รับค่า Class ID ใหม่ (ถ้ามีการเปลี่ยน)

        const payload = {
            activityId: activityId,
            activityData: {
                name: document.getElementById('activityName').value,
                activity_type: document.getElementById('activityType').value,
                start_time: `${isoDate} ${startTimeVal}:00`,
                end_time: `${isoDate} ${endTimeVal}:00`,
                is_recurring: document.getElementById('recurringDays').value,
                semester: document.getElementById('semester').value || 1,
                class_id: classIdVal || null, // อัปเดตห้องเรียน (หรือ null ถ้าไม่เลือก)
                academic_year: new Date(isoDate).getFullYear() + 543,
                current_date: isoDate
            },
            attendanceData: []
        };

        const rows = document.querySelectorAll('.attendance-table tbody tr');
        rows.forEach(row => {
            const checkId = row.dataset.checkId;
            const checkedRadio = row.querySelector(`input[name="status_${checkId}"]:checked`);
            const status = checkedRadio ? checkedRadio.value : null;

            payload.attendanceData.push({
                check_id: checkId,
                status: status
            });
        });

        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.status === 'success') {
            alert('แก้ไขข้อมูลเรียบร้อยแล้ว!');
            window.location.href = 'Activity_list.html';
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        console.error('Save error:', err);
        alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
        if(submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// ==========================================
// 7. UTILS & STYLES
// ==========================================
function convertDateToISO(displayDate) {
    if(!displayDate) return '';
    const parts = displayDate.split('/');
    if(parts.length !== 3) return null;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function setupFlatpickr(startIso, endIso) {
    if (!window.flatpickr) return;
    const startDateObj = startIso ? new Date(startIso.replace(' ', 'T')) : new Date();
    const endDateObj = endIso ? new Date(endIso.replace(' ', 'T')) : new Date();

    flatpickr("#activityDate", { dateFormat: "d/m/Y", defaultDate: startDateObj, locale: "th" });
    const timeConfig = { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, locale: "th" };
    flatpickr("#startTime", { ...timeConfig, defaultDate: startDateObj });
    flatpickr("#endTime", { ...timeConfig, defaultDate: endDateObj });
}

function injectTableStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* บังคับสีหัวตาราง */
        .attendance-table th {
            background-color: #2c3e50 !important;
            color: #ffffff !important;
            padding: 15px;
            text-align: center;
        }
        .attendance-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            background-color: #fff;
        }
        .attendance-table td {
            padding: 12px;
            border-bottom: 1px solid #eee;
            color: #444;
            vertical-align: middle;
        }
        .status-checkbox {
            appearance: auto !important;
            -webkit-appearance: checkbox !important;
            width: 20px !important;
            height: 20px !important;
            cursor: pointer;
            display: inline-block !important;
        }
        .status-checkbox.present { accent-color: #27ae60; } 
        .status-checkbox.absent { accent-color: #c0392b; }
        .attendance-table tr:hover td {
            background-color: #ecf0f1 !important;
        }
    `;
    document.head.appendChild(style);
}