// Create_activity.js

const CONFIG = {
    API_URL: 'PHP/Create_activities.php'
};

// ==========================================
// 1. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // ไม่ต้องโหลด fetchInitialData() แล้ว เพราะเราไม่ใช้ Dropdown
    setupEventListeners();
    setupFlatpickr();
});

// ==========================================
// 2. EVENTS
// ==========================================
function setupEventListeners() {
    // เหลือแค่ปุ่ม Submit อย่างเดียว
    document.getElementById('createActivityForm').addEventListener('submit', handleCreateActivity);
}

// ==========================================
// 3. FORM SUBMISSION
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
        return;
    }

    const payload = {
        activityName: document.getElementById('activityName').value,
        activityType: document.getElementById('activityType').value,
        activityDate: isoDate,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        semester: document.getElementById('semester').value,
        recurringDays: document.getElementById('recurringDays').value, 
        
        // *** จุดสำคัญ: ส่ง classId เป็น null หรือไม่ต้องส่งเลย ***
        classId: null, 
        
        // ปีการศึกษา ใช้ปีปัจจุบัน + 543
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