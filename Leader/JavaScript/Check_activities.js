// Check_activities.js

const CONFIG = {
    API_URL: 'PHP/api_check_activity.php'
};

const params = new URLSearchParams(window.location.search);
const activityId = params.get('activityId');

let currentActivityData = {}; // เก็บข้อมูลเดิมไว้เทียบ

// ==========================================
// 1. INIT & LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    injectTableStyles();
    if (!activityId) {
        alert('ไม่พบรหัสกิจกรรม (Activity ID)');
        window.location.href = 'Activity_list.html';
        return;
    }

    await loadActivityData();
    setupEventListeners();
});

async function loadActivityData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?activity_id=${activityId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        // ตรวจสอบว่ามี status error หรือไม่
        if (data.status === 'error') throw new Error(data.message);

        // 1. Render Header (รายละเอียดกิจกรรม)
        if (data.activity) {
            renderActivityHeader(data.activity);
            // เก็บข้อมูลไว้ใช้ตอน Save
            currentActivityData = data.activity;
        }

        // 2. Render Table (รายชื่อนักเรียน)
        // เพิ่มการเช็คว่ามีข้อมูลนักเรียนหรือไม่
        if (data.students && Array.isArray(data.students)) {
            renderAttendanceTable(data.students);
        } else {
            console.warn('No student data found');
        }

    } catch (error) {
        console.error('Error loading data:', error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message);
    }
}

// ==========================================
// 2. RENDER FUNCTIONS
// ==========================================
function renderActivityHeader(activity) {
    // ใส่ค่าลง Input
    setValue('activityName', activity.name);
    setValue('activityType', activity.activity_type);
    setValue('semester', '1'); // Default หรือดึงจาก DB
    setValue('recurringDays', activity.is_recurring ? 1 : 0);
    
    // --- จุดที่แก้ไข: ตรวจสอบว่ามี element id="classInfoDisplay" หรือไม่ก่อนใส่ค่า ---
    const classInfoEl = document.getElementById('classInfoDisplay');
    if (classInfoEl) {
        const classInfo = `ระดับ ${activity.major_level || '-'} ${activity.major_name || '-'} ปี ${activity.year || '-'} ห้อง ${activity.class_number || '-'}`;
        classInfoEl.textContent = classInfo;
    }

    // เรียกใช้ฟังก์ชันจัดการวันที่
    setupFlatpickr(activity.start_time, activity.end_time);
}
function renderAttendanceTable(students) {
    const tbody = document.querySelector('.attendance-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const statusMap = { 'Attended': 'present', 'Absent': 'absent' };

    // *** จุดสำคัญ: ต้องมี (student, index) ***
    students.forEach((student, index) => {
        const tr = document.createElement('tr');
        tr.dataset.checkId = student.check_id;
        
        // ใส่สีพื้นหลัง: บรรทัดคู่สีขาว, บรรทัดคี่สีเทาอ่อน
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

// ฟังก์ชันบังคับเลือกได้แค่อันเดียว
window.onlyOne = function(checkbox) {
    const checkboxes = document.getElementsByName(checkbox.name);
    checkboxes.forEach((item) => {
        if (item !== checkbox) item.checked = false;
    });
}

function setupFlatpickr(startIso, endIso) {
    if (!window.flatpickr) return;

    // แปลงวันที่จาก string เป็น Date Object เพื่อป้องกัน Error ในบาง Browser
    const startDateObj = startIso ? new Date(startIso.replace(' ', 'T')) : new Date();
    const endDateObj = endIso ? new Date(endIso.replace(' ', 'T')) : new Date();

    // Date Picker
    flatpickr("#activityDate", {
        dateFormat: "d/m/Y",
        defaultDate: startDateObj,
        locale: "th"
    });

    // Time Pickers
    const timeConfig = {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        locale: "th"
    };

    flatpickr("#startTime", { ...timeConfig, defaultDate: startDateObj });
    flatpickr("#endTime", { ...timeConfig, defaultDate: endDateObj });
}

// ==========================================
// 3. SAVE LOGIC (BULK SAVE)
// ==========================================
async function handleSave(e) {
    e.preventDefault();

    // 3.1 เตรียมข้อมูล Header
    const dateStr = document.getElementById('activityDate').value; 
    const isoDate = convertDateToISO(dateStr); 
    
    const startTimeVal = document.getElementById('startTime').value;
    const endTimeVal = document.getElementById('endTime').value;

    const payload = {
        activityId: activityId,
        activityData: {
            name: document.getElementById('activityName').value,
            activity_type: document.getElementById('activityType').value,
            start_time: `${isoDate} ${startTimeVal}:00`,
            end_time: `${isoDate} ${endTimeVal}:00`,
            is_recurring: document.getElementById('recurringDays').value,
            semester: document.getElementById('semester').value || 1,
            academic_year: new Date(isoDate).getFullYear() + 543, 
            current_date: isoDate
        },
        attendanceData: []
    };

    // 3.2 เตรียมข้อมูล Table
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

    // 3.3 ส่งไป PHP
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.status === 'success') {
            alert('บันทึกข้อมูลเรียบร้อยแล้ว!');
            window.location.href = 'Activity_list.html'; 
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        console.error('Save error:', err);
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    }
}

// ==========================================
// 4. UTILS
// ==========================================
function setValue(id, val) {
    const el = document.getElementById(id);
    if(el) el.value = val;
}

function convertDateToISO(displayDate) {
    if(!displayDate) return '';
    const parts = displayDate.split('/');
    if(parts.length !== 3) return displayDate;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function setupEventListeners() {
    const form = document.getElementById('createActivityForm');
    if(form) {
        form.addEventListener('submit', handleSave);
    }
}

function injectTableStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* ตกแต่งตารางหลัก */
        .attendance-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            margin-bottom: 20px;
            background-color: #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* เงา */
            border-radius: 8px; /* มุมโค้ง */
            overflow: hidden;
        }

        /* หัวตาราง */
        .attendance-table th {
            background-color: #4a90e2; /* สีฟ้าหัวตาราง */
            color: white;
            padding: 12px;
            text-align: center;
            font-weight: bold;
            border-bottom: 2px solid #357abd;
        }

        /* ช่องข้อมูล */
        .attendance-table td {
            padding: 10px;
            border-bottom: 1px solid #eee;
            color: #333;
        }

        /* สลับสีบรรทัด (Zebra Striping) */
        .attendance-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .attendance-table tr:hover {
            background-color: #f1f7ff; /* สีตอนเอาเมาส์ชี้ */
        }

        /* Checkbox เช็คชื่อ */
        .status-checkbox {
            width: 20px;
            height: 20px;
            cursor: pointer;
            vertical-align: middle;
        }

        /* สีปุ่มเช็คชื่อ (Accent Color) - ใช้ได้กับ Chrome/Edge/Firefox ใหม่ๆ */
        .status-checkbox.present {
            accent-color: #28a745; /* สีเขียว */
        }
        .status-checkbox.absent {
            accent-color: #dc3545; /* สีแดง */
        }

        /* Responsive บนมือถือ (ปรับแต่งเพิ่มเติมจากที่มี) */
        @media screen and (max-width: 768px) {
            .attendance-table {
                display: block;
                overflow-x: auto;
                white-space: nowrap;
            }
        }
    `;
    document.head.appendChild(style);
    console.log('Injecting Custom Table Styles...');
}