// Overview_activity.js

// CONFIG
const CONFIG = {
    API_URL: 'PHP/api_get_overview.php', // ตรวจสอบ Path ให้ถูกต้อง
    REFRESH_RATE: 3000 // 3 วินาที
};

let currentActivities = [];
let isFirstLoad = true;
let intervalId = null;

// ==========================================
// 1. FETCH DATA
// ==========================================
async function fetchActivities() {
    try {
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);

        const activities = await response.json();
        if (activities.status === 'error') throw new Error(activities.message);

        currentActivities = activities;

        // โหลดครั้งแรก: สร้างตัวเลือกวันที่
        if (isFirstLoad) {
            LoadDateOptions(activities);
            setupFilterListeners();
            isFirstLoad = false;
        } else {
            // โหลดครั้งถัดไป: อัปเดตตัวเลือกวันที่ (แบบไม่รีเซ็ตค่าที่เลือกอยู่)
            LoadDateOptions(activities, true);
        }

        applyFiltersAndRender();

    } catch (err) {
        console.error('Error fetching activities:', err);
        const container = document.getElementById('activityCheckTableBody');
        if(container) {
             container.innerHTML = `<tr><td colspan="9" style="color:red; text-align:center;">เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
        }
    }
}

// ==========================================
// 2. FILTER & DATE OPTIONS
// ==========================================
function LoadDateOptions(activities, keepSelection = false) {
    const daySelect = document.getElementById('daySelect');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');

    if (!daySelect || !monthSelect || !yearSelect) return;

    const currentDay = keepSelection ? daySelect.value : "";
    const currentMonth = keepSelection ? monthSelect.value : "";
    const currentYear = keepSelection ? yearSelect.value : "";

    const days = new Set();
    const months = new Set();
    const years = new Set();

    activities.forEach(act => {
        if(act.start_time) {
            const d = new Date(act.start_time);
            days.add(d.getDate());
            months.add(d.getMonth() + 1);
            years.add(d.getFullYear() + 543); // ปี พ.ศ.
        }
    });

    // Helper ในการสร้าง Options
    const buildOptions = (set, currentVal) => {
        let html = `<option value="">ทั้งหมด</option>`;
        Array.from(set).sort((a,b)=>a-b).forEach(item => {
            const selected = (String(item) === String(currentVal)) ? 'selected' : '';
            html += `<option value="${item}" ${selected}>${item}</option>`;
        });
        return html;
    };

    if(!keepSelection || daySelect.innerHTML === "") daySelect.innerHTML = buildOptions(days, currentDay);
    if(!keepSelection || monthSelect.innerHTML === "") monthSelect.innerHTML = buildOptions(months, currentMonth);
    if(!keepSelection || yearSelect.innerHTML === "") yearSelect.innerHTML = buildOptions(years, currentYear);
}

function setupFilterListeners() {
    ['daySelect', 'monthSelect', 'yearSelect'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', applyFiltersAndRender);
    });
}

function applyFiltersAndRender() {
    const dVal = document.getElementById('daySelect')?.value;
    const mVal = document.getElementById('monthSelect')?.value;
    const yVal = document.getElementById('yearSelect')?.value;

    const filtered = currentActivities.filter(act => {
        if(!act.start_time) return false;
        const d = new Date(act.start_time);
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear() + 543;

        const matchDay = !dVal || day === parseInt(dVal);
        const matchMonth = !mVal || month === parseInt(mVal);
        const matchYear = !yVal || year === parseInt(yVal);

        return matchDay && matchMonth && matchYear;
    });

    RenderTable(filtered);
}

// ==========================================
// 3. RENDER TABLE
// ==========================================
function RenderTable(activities) {
    const container = document.getElementById('activityCheckTableBody');
    if (!container) return;

    if (activities.length === 0) {
        container.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color:#999;">ไม่พบข้อมูลกิจกรรม</td></tr>';
        return;
    }

    const rows = activities.map(act => {
        // จัดรูปแบบเวลา
        const startDate = new Date(act.start_time);
        const endDate = new Date(act.end_time);
        
        const dateStr = startDate.toLocaleDateString('th-TH', { 
            year: 'numeric', month: '2-digit', day: '2-digit' 
        });
        const timeStr = `${formatTime(startDate)} - ${formatTime(endDate)}`;

        // ข้อมูล Class (จัดการกรณีไม่มีข้อมูล)
        const major = act.major_name || 'ทุกสาขา';
        const level = act.major_level || 'ทุกระดับ';
        const year = act.year ? `ปี ${act.year}` : 'ทุกชั้นปี';
        const className = act.class_name ? act.class_name : (act.class_number ? `ห้อง ${act.class_number}` : 'ทุกห้อง');

        // คำนวณสถานะ (ใช้ค่าที่ PHP นับมาให้แล้ว)
        const totalStudents = act.total_students;
        const attendedCount = act.attended_count;
        const checkedCount = act.checked_count; // จำนวนคนที่ถูกเช็คแล้ว (ไม่ว่าสถานะใด)

        let percent = 0;
        let statusText = "ยังไม่เช็ก";
        let statusClass = "unchecked";

        if (totalStudents > 0) {
            percent = Math.round((attendedCount / totalStudents) * 100);

            if (checkedCount === 0) {
                statusText = "ยังไม่เช็ก";
                statusClass = "unchecked";
            } else if (attendedCount === totalStudents) {
                statusText = "มาครบ";
                statusClass = "checked";
            } else {
                // ถ้ามีการเช็คไปบ้างแล้ว (checkedCount > 0) แต่มาไม่ครบ
                statusText = "ยังไม่ครบ";
                statusClass = "partial";
            }
        } else {
            statusText = "ไม่มีรายชื่อ";
        }

        return `
        <tr>
            <td>${act.name}</td>
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td>${major}</td>
            <td>${level}</td>
            <td>${year}</td>
            <td>${className}</td>
            <td class="status-cell">
                <span class="${statusClass}" style="font-weight:bold; padding: 4px 8px; border-radius: 4px;">${statusText}</span>
            </td>
            <td>
                <strong>${attendedCount} / ${totalStudents}</strong>
                <span style="color:#666; font-size:0.9em;">(${percent}%)</span>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = rows;
}

// Helpers
function formatTime(dateObj) {
    return dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function exportToExcel() {
    // ฟังก์ชัน Export ยังคงไว้เหมือนเดิม หรือจะทำเพิ่มในอนาคตก็ได้
    alert("ระบบ Export Excel (PHP Version) กำลังอยู่ในการพัฒนา");
}

// ==========================================
// 4. INIT & AUTO REFRESH
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const excelBtn = document.getElementById("exportExcelBtn");
    if(excelBtn) excelBtn.addEventListener("click", exportToExcel);

    // โหลดครั้งแรกทันที
    await fetchActivities();

    // ตั้งเวลาโหลดอัตโนมัติ (Polling)
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(fetchActivities, CONFIG.REFRESH_RATE);
});