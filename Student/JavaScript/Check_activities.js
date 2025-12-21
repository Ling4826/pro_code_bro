/* ====== CONFIG ====== */
// ดึง activityId จาก URL
const params = new URLSearchParams(window.location.search);
const activityId = params.get('activityId');

/* ====== HELPERS ====== */
const $ = sel => document.querySelector(sel);

// ตั้งค่า Value ให้ input field
function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? '';
}

// สร้าง option เดียวให้ select (เพื่อโชว์ค่าเฉยๆ)
function setSingleOption(selectId, value, text) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = ''; 
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = true;
    select.appendChild(option);
    select.disabled = true; // ล็อกไม่ให้เปลี่ยน
}

// แปลงเวลา SQL -> HH:mm
function formatTimeFromSQL(datetimeStr) {
    if (!datetimeStr) return '';
    const dateObj = new Date(datetimeStr); 
    if (isNaN(dateObj.getTime())) return ''; 

    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/* ====== MAIN LOADER (Read-Only Logic) ====== */
async function loadActivityData() {
    if (!activityId) {
        alert('ไม่พบรหัสกิจกรรม (Activity ID)');
        return;
    }

    try {
        // 1. เรียก API PHP เพื่อดึงข้อมูล
        // (ตรวจสอบ path ให้ตรงกับโฟลเดอร์งานของคุณ)
        const response = await fetch(`PHP/api_get_activity_detail.php?id=${activityId}`);
        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        const activity = data.activity;
        const checks = data.checks; // รายชื่อคนเช็คชื่อ

        // 2. แสดงข้อมูลทั่วไป (Header)
        setValue('activityName', activity.name);
        setValue('activityType', activity.activity_type);
        setValue('recurringDays', activity.is_recurring ? 1 : 0);
        
        // ถ้ามีข้อมูลการเช็คชื่อ ให้เอา Semester จาก record แรกมาโชว์
        let showSemester = "1"; // Default
        if (checks.length > 0 && checks[0].semester) {
            showSemester = checks[0].semester;
        }
        setValue('semester', showSemester);

        // 3. แสดงข้อมูล Class/Major (ใส่ค่าหลอกๆ ใน Dropdown ให้โชว์ได้)
        const classInfo = activity.class || {};
        const majorInfo = classInfo.major || {};

        if (majorInfo.level) setSingleOption('level', majorInfo.level, majorInfo.level);
        if (majorInfo.name) setSingleOption('department', majorInfo.id, majorInfo.name);
        if (classInfo.year) setSingleOption('studentYear', classInfo.year, classInfo.year);
        
        const className = classInfo.class_number ? `ห้อง ${classInfo.class_number}` : 'ทุกห้อง';
        setSingleOption('studentClass', classInfo.id || '', className);

        // 4. ตั้งค่า Flatpickr (Date/Time) แบบ Read-only
        if (window.flatpickr) {
            // วันที่ (ใช้วันที่เริ่มกิจกรรม หรือวันที่เช็คชื่อล่าสุด)
            let dateStr = activity.start_time;
            if (checks.length > 0 && checks[0].date) {
                dateStr = checks[0].date;
            }
            
            flatpickr("#activityDate", {
                dateFormat: "d/m/Y",
                locale: "th",
                defaultDate: dateStr,
                disabled: true // 🔒 ล็อก
            });

            // เวลา
            flatpickr("#startTime", {
                enableTime: true, noCalendar: true, time_24hr: true,
                dateFormat: "H:i", altInput: true, altFormat: "H:i น.",
                defaultDate: formatTimeFromSQL(activity.start_time),
                disabled: true // 🔒 ล็อก
            });

            flatpickr("#endTime", {
                enableTime: true, noCalendar: true, time_24hr: true,
                dateFormat: "H:i", altInput: true, altFormat: "H:i น.",
                defaultDate: formatTimeFromSQL(activity.end_time),
                disabled: true // 🔒 ล็อก
            });
        }

        // 5. สร้างตารางรายชื่อ (Render Table)
        const tableBody = document.querySelector('.attendance-table tbody');
        tableBody.innerHTML = '';

        if (checks.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999;">ยังไม่มีการเช็คชื่อในกิจกรรมนี้</td></tr>`;
        } else {
            const statusMap = { 'Attended': 'present', 'Absent': 'absent', 'Excused': 'late' };

            checks.forEach(record => {
                const studentName = record.student_name || '-';
                const studentId = record.student_id || '-';
                const currentStatus = statusMap[record.status] || '';
                const radioName = `status_${record.id}`;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align:left; padding-left:10px">${studentName}</td>
                    <td>${studentId}</td>
                    <td>
                        <input type="radio" name="${radioName}" value="present" ${currentStatus === 'present' ? 'checked' : ''} disabled>
                        <label class="present-btn" style="cursor: default; opacity: ${currentStatus === 'present' ? '1' : '0.5'};"></label>
                    </td>
                    <td>
                        <input type="radio" name="${radioName}" value="absent" ${currentStatus === 'absent' ? 'checked' : ''} disabled>
                        <label class="absent-btn" style="cursor: default; opacity: ${currentStatus === 'absent' ? '1' : '0.5'};"></label>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // 6. 🔒 ซ่อนหรือล็อกปุ่มบันทึก (เพราะนักเรียนห้ามกด)
        const saveBtn = document.querySelector('.create-button');
        if (saveBtn) {
            saveBtn.style.display = 'none'; // ซ่อนปุ่มไปเลย
            // หรือ saveBtn.disabled = true; // ถ้าอยากให้เห็นแต่กดไม่ได้
        }

        // ล็อก input ทุกตัวในฟอร์ม (กันเหนียว)
        document.querySelectorAll('#createActivityForm input, #createActivityForm select').forEach(el => {
            el.disabled = true;
        });

    } catch (err) {
        console.error('Error loading data:', err);
        alert('เกิดข้อผิดพลาด: ' + err.message);
    }
}

/* ====== INIT ====== */
document.addEventListener('DOMContentLoaded', async () => {
    await loadActivityData();
});