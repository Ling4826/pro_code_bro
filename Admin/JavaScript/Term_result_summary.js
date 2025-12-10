/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let termScoreRows = []; // ข้อมูลดิบทั้งหมด

async function fetchTermScore() {
    // แสดงสถานะ Loading
    document.getElementById("score-body").innerHTML = `
        <tr><td colspan="12" style="padding: 20px; color: #666;">กำลังดึงข้อมูล...</td></tr>
    `;

    const { data, error } = await supabaseClient
        .from('term_score')
        .select(`
            id,
            semester,
            academic_year,
            flag_ceremony_percentage,
            department_activity_percentage,
            is_passed,
            student:student_id (
                id,
                name,
                class:class_id (
                    id,
                    year,
                    class_number, 
                    major:major_id (
                        id,
                        name,
                        level
                    )
                ),
                activity_check (
                    id,
                    status,
                    activity:activity_id ( 
                        activity_type 
                    )
                )
            )
        `);

    if (error) {
        console.error("ERROR >", error);
        document.getElementById("score-body").innerHTML = `
            <tr><td colspan="12" style="color: red;">เกิดข้อผิดพลาด: ${error.message}</td></tr>
        `;
        return null;
    }

    // แปลงข้อมูลให้อยู่ในรูปแบบ Flat Data
    termScoreRows = data.map(row => {
        const student = row.student;
        const classInfo = student?.class;
        const major = classInfo?.major;
        const checks = student?.activity_check || [];

        // คำนวณจำนวน (Counts) แยกตามประเภท
        const flagList = checks.filter(c => c.activity?.activity_type === 'flag_ceremony');
        const flagTotal = flagList.length;
        const flagAttended = flagList.filter(c => c.status === 'Attended').length;

        const deptList = checks.filter(c => c.activity?.activity_type === 'activity');
        const deptTotal = deptList.length;
        const deptAttended = deptList.filter(c => c.status === 'Attended').length;

        return {
            id: row.id,
            student_id: student?.id ?? "-",
            studentName: student?.name ?? "-",
            majorName: major?.name ?? "-",
            level: major?.level ?? "-",
            year: classInfo?.year ?? "-",
            classNumber: classInfo?.class_number ?? "-",

            // ข้อมูลสำหรับแสดงผลในตาราง
            flagText: `${flagAttended}/${flagTotal}`,
            deptText: `${deptAttended}/${deptTotal}`,
            
            // ข้อมูลสำหรับ Popup (เก็บค่าตัวเลขดิบไว้ใช้)
            flagAttended, flagTotal,
            deptAttended, deptTotal,

            percentFlag: row.flag_ceremony_percentage,       
            percentActivity: row.department_activity_percentage, 
            isPassed: row.is_passed
        };
    });

    initFilters();
    renderFilteredTable();
}

/* ... (ฟังก์ชัน Filter ส่วนเดิม ไม่ต้องแก้) ... */
function initFilters() {
    const uniqueLevels = [...new Set(termScoreRows.map(r => r.level))].filter(l => l !== "-").sort();
    fillSelect("level", uniqueLevels, "ทุกระดับ");
    document.getElementById("level").addEventListener("change", () => { updateMajorDropdown(); updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("department").addEventListener("change", () => { updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("studentYear").addEventListener("change", renderFilteredTable);
    document.getElementById("classNumber").addEventListener("change", renderFilteredTable);
    document.getElementById("searchInput").addEventListener("input", renderFilteredTable);
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
    const level = document.getElementById("level").value;
    const department = document.getElementById("department").value;
    const year = document.getElementById("studentYear").value;
    const room = document.getElementById("classNumber").value;
    const searchName = document.getElementById("searchInput").value.toLowerCase();

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
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: #999;">ไม่พบข้อมูลตามเงื่อนไข</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        const passBadge = row.isPassed 
            ? '<span class="status-badge status-pass">ผ่าน</span>' 
            : '<span class="status-badge status-fail">ไม่ผ่าน</span>';

        // เพิ่ม onclick ให้เรียก openStudentModal
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

// 🔥 ฟังก์ชันเปิด Popup (Modal)
function openStudentModal(rowId) {
    // หาข้อมูลนักเรียนจาก array
    const row = termScoreRows.find(r => r.id.toString() === rowId.toString());
    if (!row) return;

    // เซ็ตชื่อนักเรียน
    document.getElementById('modalStudentName').textContent = row.studentName;

    // --- การ์ดซ้าย: หน้าเสาธง ---
    document.getElementById('flagTotal').textContent = `${row.flagTotal} ครั้ง`;
    document.getElementById('flagAttended').textContent = `${row.flagAttended} ครั้ง`;
    document.getElementById('flagPercent').textContent = `${row.percentFlag}%`;
    
    // เปลี่ยนไอคอนและสีตามคะแนน (สมมติ 80% ผ่าน)
    const flagIcon = document.getElementById('flagIcon');
    const flagCard = document.getElementById('flagCard');
    if (row.percentFlag >= 80) {
        flagIcon.className = "fas fa-check";
        flagCard.className = "card-detail card-blue"; // สีฟ้า/เขียว
    } else {
        flagIcon.className = "fas fa-times";
        flagCard.className = "card-detail card-red"; // สีแดง
    }

    // --- การ์ดขวา: กิจกรรม ---
    document.getElementById('deptTotal').textContent = `${row.deptTotal} ครั้ง`;
    document.getElementById('deptAttended').textContent = `${row.deptAttended} ครั้ง`;
    document.getElementById('deptPercent').textContent = `${row.percentActivity}%`;

    const deptIcon = document.getElementById('deptIcon');
    const deptCard = document.getElementById('deptCard');
    if (row.percentActivity >= 80) {
        deptIcon.className = "fas fa-check";
        deptCard.className = "card-detail card-blue";
    } else {
        deptIcon.className = "fas fa-times";
        deptCard.className = "card-detail card-red";
    }

    // แสดง Modal
    document.getElementById('studentModal').style.display = 'flex';
}

// ฟังก์ชันปิด Popup
function closeStudentModal() {
    document.getElementById('studentModal').style.display = 'none';
}

// ปิดเมื่อคลิกพื้นหลัง
window.onclick = function(event) {
    const modal = document.getElementById('studentModal');
    if (event.target == modal) {
        closeStudentModal();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await fetchTermScore();
});