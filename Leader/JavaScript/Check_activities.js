/* ====== CONFIG ====== */
// ไม่ต้องใช้ Supabase Config แล้ว
const params = new URLSearchParams(window.location.search);
const activityId = params.get('activityId');

/* ====== HELPERS ====== */
const $ = sel => document.querySelector(sel);
let globalIsoDate = null;
let globalSemester = null;
let globalAcademicYear = null;

function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? '';
}

// แปลงวันที่จาก "2025-06-15 08:00:00" เป็น "08:00"
function formatTimeFromSQL(datetimeStr) {
    if (!datetimeStr) return '';
    const dateObj = new Date(datetimeStr); // Browser มักจะอ่าน format นี้ได้
    if (isNaN(dateObj.getTime())) return ''; // กันเหนียว

    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// ตั้งค่า Dropdown แบบชั่วคราว (เพราะฟอร์ม Disabled อยู่แล้ว แค่สร้าง option เดียวให้โชว์ได้ก็พอ)
function setSingleOption(selectId, value, text) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = ''; // ล้างของเก่า
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = true;
    select.appendChild(option);
}

// Logic กด Radio แล้วเด้งออก (Toggle Uncheck)
function attachRadioToggleBehavior(container = document) {
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
        if (radio.dataset.listenerAttached === "true") return;
        radio.addEventListener('click', function (event) {
            if (this.dataset.waschecked === "true") {
                event.preventDefault();
                const that = this;
                setTimeout(() => {
                    that.checked = false;
                    that.dataset.waschecked = "false";
                }, 0);
            } else {
                const group = container.querySelectorAll(`input[name="${this.name}"]`);
                group.forEach(r => r.dataset.waschecked = "false");
                this.dataset.waschecked = "true";
            }
        });
        radio.dataset.listenerAttached = "true";
    });
}

/* ====== MAIN LOADER ====== */
async function loadActivityData() {
    if (!activityId) {
        alert('ไม่พบรหัสกิจกรรม (Activity ID)');
        return;
    }

    try {
        // 1. เรียก API PHP เพื่อดึงข้อมูลกิจกรรม + รายชื่อเช็คชื่อ
        const response = await fetch(`PHP/api_get_activity_detail.php?id=${activityId}`);
        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        const activity = data.activity;
        const checks = data.checks;

        // 2. เก็บค่าตัวแปร Global สำหรับใช้ตอนบันทึก
        // ใช้ Date จาก Check record แรก (ถ้ามี) หรือจาก Activity start_time
        let refDateStr = activity.start_time;
        let refSemester = "1"; // Default
        
        // ถ้าเคยมีการเช็คชื่อแล้ว ให้ยึดวันที่/เทอม จาก record การเช็คชื่อล่าสุด
        if (checks.length > 0 && checks[0].date) {
            refDateStr = checks[0].date; // Format: YYYY-MM-DD
            refSemester = checks[0].semester;
            globalAcademicYear = checks[0].academic_year;
        }

        const dateObj = new Date(refDateStr);
        globalIsoDate = dateObj.toISOString().split('T')[0]; // เก็บ YYYY-MM-DD
        globalSemester = refSemester;
        if (!globalAcademicYear) globalAcademicYear = (dateObj.getFullYear() + 543).toString();

        // 3. แสดงข้อมูลลงใน Form
        setValue('activityName', activity.name);
        setValue('activityType', activity.activity_type);
        setValue('recurringDays', activity.is_recurring ? 1 : 0);
        setValue('semester', globalSemester);

        // ตั้งค่า Dropdown ต่างๆ (สร้าง Option ปลอมๆ ขึ้นมาเพื่อให้โชว์ข้อมูลได้)
        const classInfo = activity.class || {};
        const majorInfo = classInfo.major || {};

        if (majorInfo.level) setSingleOption('level', majorInfo.level, majorInfo.level);
        if (majorInfo.name) setSingleOption('department', majorInfo.id, majorInfo.name);
        if (classInfo.year) setSingleOption('studentYear', classInfo.year, classInfo.year);
        
        const className = classInfo.class_number ? `ห้อง ${classInfo.class_number}` : 'ทุกห้อง';
        setSingleOption('studentClass', classInfo.id || '', className);

        // 4. ตั้งค่า Flatpickr (Date/Time)
        if (window.flatpickr) {
            // วันที่
            flatpickr("#activityDate", {
                dateFormat: "d/m/Y",
                locale: "th",
                defaultDate: dateObj,
                disabled: true
            });

            // เวลาเริ่ม
            flatpickr("#startTime", {
                enableTime: true,
                noCalendar: true,
                time_24hr: true,
                dateFormat: "H:i",
                altInput: true,
                altFormat: "H:i น.",
                defaultDate: formatTimeFromSQL(activity.start_time),
                disabled: true
            });

            // เวลาสิ้นสุด
            flatpickr("#endTime", {
                enableTime: true,
                noCalendar: true,
                time_24hr: true,
                dateFormat: "H:i",
                altInput: true,
                altFormat: "H:i น.",
                defaultDate: formatTimeFromSQL(activity.end_time),
                disabled: true
            });
        }

        // 5. สร้างตารางรายชื่อ (Render Table)
        const tableBody = document.querySelector('.attendance-table tbody');
        tableBody.innerHTML = '';

        const statusMap = { 'Attended': 'present', 'Absent': 'absent', 'Excused': 'late' };

        checks.forEach(record => {
            const tr = document.createElement('tr');
            tr.dataset.recordId = record.id; // เก็บ ID ของ activity_check ไว้
            
            const studentName = record.student_name || '-';
            const studentId = record.student_id || '-';
            const currentStatus = statusMap[record.status] || '';
            const radioName = `status_${record.id}`;

            tr.innerHTML = `
                <td style="text-align:left; padding-left:10px">${studentName}</td>
                <td>${studentId}</td>
                <td>
                    <input type="radio" name="${radioName}" id="present_${record.id}" value="present" ${currentStatus === 'present' ? 'checked' : ''}>
                    <label for="present_${record.id}" class="present-btn"></label>
                </td>
                <td>
                    <input type="radio" name="${radioName}" id="absent_${record.id}" value="absent" ${currentStatus === 'absent' ? 'checked' : ''}>
                    <label for="absent_${record.id}" class="absent-btn"></label>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        attachRadioToggleBehavior(tableBody);

    } catch (err) {
        console.error('Error loading data:', err);
        alert('เกิดข้อผิดพลาด: ' + err.message);
    }
}

/* ====== INIT & SUBMIT ====== */
document.addEventListener('DOMContentLoaded', async () => {
    // โหลดข้อมูลทันทีเมื่อเปิดหน้า
    await loadActivityData();

    // จัดการการกดปุ่มบันทึก
    const form = document.getElementById('createActivityForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                // 1. รวบรวมข้อมูลจากตาราง
                const rows = document.querySelectorAll('.attendance-table tbody tr');
                const recordsToUpdate = [];
                const statusMapDB = { 'present': 'Attended', 'absent': 'Absent', 'late': 'Excused' };

                rows.forEach(row => {
                    const recordId = row.dataset.recordId;
                    const checkedRadio = row.querySelector('input[type="radio"]:checked');
                    
                    // แปลงค่าจาก radio (present/absent) เป็นค่า DB (Attended/Absent)
                    // ถ้าไม่ได้ติ๊กอะไรเลย ให้เป็น null (หรือจะตั้ง Default ก็ได้)
                    let statusValue = null;
                    if (checkedRadio) {
                        statusValue = statusMapDB[checkedRadio.value];
                    }

                    if (recordId) {
                        recordsToUpdate.push({
                            id: recordId,
                            status: statusValue
                        });
                    }
                });

                if (recordsToUpdate.length === 0) {
                    alert('ไม่พบรายชื่อนักเรียน');
                    return;
                }

                // 2. ส่งข้อมูลไปที่ PHP
                const response = await fetch('PHP/api_save_attendance.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: globalIsoDate,
                        semester: globalSemester,
                        academic_year: globalAcademicYear,
                        records: recordsToUpdate
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    alert('บันทึกการเข้าเรียนเรียบร้อยแล้ว!');
                    window.location.href = 'Activity_list.html';
                } else {
                    throw new Error(result.message || 'Unknown error');
                }

            } catch (err) {
                console.error('Submit error:', err);
                alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
            }
        });
    }
});