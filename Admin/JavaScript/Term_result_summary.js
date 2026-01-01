/* ====== CONFIG ====== */
const API_URL = 'PHP/api_get_term_summary.php'; // ตรวจสอบ Path ให้ตรงกับโฟลเดอร์ของคุณ

let termScoreRows = [];

async function fetchTermScore() {
    const tbody = document.getElementById("score-body");
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="12" style="padding: 20px; color: #666; text-align: center;">กำลังประมวลผลข้อมูล...</td></tr>`;
    }

    try {
        // เรียก API PHP
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        
        const data = await response.json();
        if (data.status === 'error') throw new Error(data.message);

        // Map ข้อมูลให้เข้ากับโครงสร้างตารางเดิม
        termScoreRows = data.map(row => {
            // แปลงค่าตัวเลขจาก String (Database) เป็น Number
            const flagTotal = parseInt(row.flag_total || 0);
            const flagAttended = parseInt(row.flag_attended || 0);
            const deptTotal = parseInt(row.dept_total || 0);
            const deptAttended = parseInt(row.dept_attended || 0);

            // คำนวณ %
            const percentFlag = flagTotal > 0 ? (flagAttended / flagTotal) * 100 : 0;
            const percentActivity = deptTotal > 0 ? (deptAttended / deptTotal) * 100 : 0;

            // ตรวจสอบเกณฑ์ผ่าน (80%)
            const isPassed = (percentFlag >= 80) && (percentActivity >= 80);

            return {
                id: row.student_id, // ใช้ ID นักเรียนเป็น Key หลัก
                student_id: row.student_id,
                studentName: row.student_name,
                majorName: row.major_name || "-",
                level: row.major_level || "-",
                year: row.class_year || "-",
                classNumber: row.class_number || "-",

                // ข้อความแสดงจำนวนครั้ง
                flagText: `${flagAttended}/${flagTotal}`,
                deptText: `${deptAttended}/${deptTotal}`,

                flagAttended, flagTotal,
                deptAttended, deptTotal,

                percentFlag: parseFloat(percentFlag.toFixed(2)),
                percentActivity: parseFloat(percentActivity.toFixed(2)),
                isPassed: isPassed
            };
        });

        initFilters();
        renderFilteredTable();

    } catch (error) {
        console.error("ERROR >", error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="12" style="color: red; text-align: center;">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        }
    }
}

/* ... (ส่วน Filter ยังคงใช้ Logic เดิมได้ เพราะเรา Map โครงสร้างข้อมูลให้เหมือนเดิมแล้ว) ... */

function initFilters() {
    const uniqueLevels = [...new Set(termScoreRows.map(r => r.level))].filter(l => l !== "-").sort();
    fillSelect("level", uniqueLevels, "ทุกระดับ");
    
    // Bind Event Listeners
    document.getElementById("level")?.addEventListener("change", () => { updateMajorDropdown(); updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("department")?.addEventListener("change", () => { updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("studentYear")?.addEventListener("change", renderFilteredTable);
    document.getElementById("classNumber")?.addEventListener("change", renderFilteredTable);
    document.getElementById("searchInput")?.addEventListener("input", renderFilteredTable);
    
    updateMajorDropdown();
    updateYearAndRoomDropdown();
}

function updateMajorDropdown() {
    const levelSelect = document.getElementById("level");
    const filteredRows = levelSelect.value ? termScoreRows.filter(r => r.level === levelSelect.value) : termScoreRows;
    const uniqueMajors = [...new Set(filteredRows.map(r => r.majorName))].sort();
    fillSelect("department", uniqueMajors, "ทุกสาขาวิชา");
}

function updateYearAndRoomDropdown() {
    const level = document.getElementById("level").value;
    const major = document.getElementById("department").value;
    let filteredRows = termScoreRows;
    if (level) filteredRows = filteredRows.filter(r => r.level === level);
    if (major) filteredRows = filteredRows.filter(r => r.majorName === major);

    const uniqueYears = [...new Set(filteredRows.map(r => r.year))].sort((a, b) => a - b);
    const uniqueRooms = [...new Set(filteredRows.map(r => r.classNumber))].sort((a, b) => a - b);

    fillSelect("studentYear", uniqueYears, "ทุกชั้นปี", "ปี ");
    fillSelect("classNumber", uniqueRooms, "ทุกห้อง", "ห้อง ");
}

function fillSelect(elementId, items, placeholder, prefix = "") {
    const select = document.getElementById(elementId);
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        if (item !== "-" && item != null) {
            const option = document.createElement("option");
            option.value = item;
            option.textContent = prefix + item;
            select.appendChild(option);
        }
    });
    if (items.includes(Number(currentVal)) || items.includes(currentVal)) select.value = currentVal;
}

function getFilteredRows() {
    let rows = [...termScoreRows];
    const level = document.getElementById("level")?.value;
    const department = document.getElementById("department")?.value;
    const year = document.getElementById("studentYear")?.value;
    const room = document.getElementById("classNumber")?.value;
    const searchName = document.getElementById("searchInput")?.value.toLowerCase();

    if (level) rows = rows.filter(r => r.level === level);
    if (department) rows = rows.filter(r => r.majorName === department);
    if (year) rows = rows.filter(r => r.year == year);
    if (room) rows = rows.filter(r => r.classNumber == room);
    if (searchName) rows = rows.filter(r => r.studentName.toLowerCase().includes(searchName));
    return rows;
}

/* ====== RENDER TABLE & POPUP ====== */

function renderFilteredTable() {
    const filtered = getFilteredRows();
    const tbody = document.getElementById("score-body");
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: #999;">ไม่พบข้อมูลตามเงื่อนไข</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        const passBadge = row.isPassed
            ? '<span class="status-badge status-pass">ผ่าน</span>'
            : '<span class="status-badge status-fail">ไม่ผ่าน</span>';

        return `
        <tr style="cursor: pointer;" onclick="openStudentModal('${row.id}')">
            <td>${row.student_id}</td>
            <td style="font-weight: bold; color: #007bff;">${row.studentName}</td>
            <td>${row.majorName}</td>
            <td>${row.year}</td>
            <td>${row.classNumber}</td>
            
            <td style="text-align:center;">
                <div style="font-weight:bold; font-size:1.1em;">${row.flagText}</div>
                <div style="font-size:0.85em; color:#666;">(${row.percentFlag}%)</div>
            </td>     
            
            <td style="text-align:center;">
                <div style="font-weight:bold; font-size:1.1em;">${row.deptText}</div>
                <div style="font-size:0.85em; color:#666;">(${row.percentActivity}%)</div>
            </td> 

            <td>${passBadge}</td>
        </tr>
        `;
    }).join("");
}

// 🔥 ฟังก์ชันเปิด Popup
function openStudentModal(rowId) {
    const row = termScoreRows.find(r => r.id.toString() === rowId.toString());
    if (!row) return;

    document.getElementById('modalStudentName').textContent = row.studentName;

    // --- การ์ดซ้าย: หน้าเสาธง ---
    document.getElementById('flagTotal').textContent = `${row.flagTotal} ครั้ง`;
    document.getElementById('flagAttended').textContent = `${row.flagAttended} ครั้ง`;
    document.getElementById('flagPercent').textContent = `${row.percentFlag}%`;

    const flagIcon = document.getElementById('flagIcon');
    const flagCard = document.getElementById('flagCard');
    
    // รีเซ็ตคลาสก่อนเติมใหม่
    flagIcon.className = row.percentFlag >= 80 ? "fas fa-check" : "fas fa-times";
    flagCard.className = row.percentFlag >= 80 ? "card-detail card-blue" : "card-detail card-red";

    // --- การ์ดขวา: กิจกรรม ---
    document.getElementById('deptTotal').textContent = `${row.deptTotal} ครั้ง`;
    document.getElementById('deptAttended').textContent = `${row.deptAttended} ครั้ง`;
    document.getElementById('deptPercent').textContent = `${row.percentActivity}%`;

    const deptIcon = document.getElementById('deptIcon');
    const deptCard = document.getElementById('deptCard');

    deptIcon.className = row.percentActivity >= 80 ? "fas fa-check" : "fas fa-times";
    deptCard.className = row.percentActivity >= 80 ? "card-detail card-blue" : "card-detail card-red";

    const modal = document.getElementById('studentModal');
    if (modal) modal.style.display = 'flex';
}

function closeStudentModal() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.style.display = 'none';
}

// Event Listeners นอกเหนือจาก Filter
window.onclick = function (event) {
    const modal = document.getElementById('studentModal');
    if (event.target == modal) {
        closeStudentModal();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await fetchTermScore();
});