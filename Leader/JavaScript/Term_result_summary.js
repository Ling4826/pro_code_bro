/* ====== CONFIG ====== */
// ❌ ไม่ต้องใช้ Supabase Config แล้ว
let termScoreRows = [];
let leaderClassInfo = null;

// === MAIN FETCH FUNCTION ===
async function fetchTermScore() {
    const tbody = document.getElementById("score-body");
    tbody.innerHTML = `
        <tr><td colspan="8" style="padding: 20px; color: #666; text-align:center;">กำลังดึงข้อมูล...</td></tr>
    `;

    // 1. ดึง Ref ID ของคนที่ล็อกอินอยู่
    const refId = sessionStorage.getItem('ref_id');

    try {
        // ✅ เรียก API PHP
        // (ไฟล์นี้ต้องอยู่ folder PHP/api_get_term_score.php ตามโครงสร้างที่คุณมี)
        const response = await fetch('PHP/api_get_term_score.php');
        
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        // 2. จัดเรียงข้อมูล (Logic เดิม)
        data.sort((a, b) => {
            // ปีล่าสุดมาก่อน
            if (a.academic_year !== b.academic_year) {
                return b.academic_year.localeCompare(a.academic_year);
            }
            // เทอมสูงสุดมาก่อน
            return b.semester - a.semester;
        });

        // กรองข้อมูลซ้ำ (Logic เดิม: เอาเฉพาะข้อมูลล่าสุดของนักเรียนแต่ละคน)
        const uniqueRowsMap = new Map();
        data.forEach(row => {
            // โครงสร้าง JSON จาก PHP: row.student.id
            const studentId = row.student?.id;
            if (studentId && !uniqueRowsMap.has(studentId)) {
                uniqueRowsMap.set(studentId, row);
            }
        });
        const uniqueData = Array.from(uniqueRowsMap.values());

        // 3. 🔥 หาข้อมูลห้องของผู้ใช้ (Logic ใหม่: หาจากข้อมูลที่โหลดมาเลย ไม่ต้องยิง API แยก)
        // ถ้าคนล็อกอิน (refId) มีชื่ออยู่ในลิสต์ผลการเรียน ให้จำข้อมูลห้องเขาไว้ set default filter
        const myData = uniqueData.find(row => row.student?.id == refId);
        if (myData) {
            const cls = myData.student.class;
            const mj = cls.major;
            leaderClassInfo = {
                level: mj.level,
                majorName: mj.name,
                year: cls.year.toString(),
                classNumber: cls.class_number.toString()
            };
        } else {
            console.warn("ไม่พบข้อมูลผลการเรียนของคุณในระบบ (อาจเป็น Admin/Teacher หรือยังไม่มีผลการเรียน)");
        }

        // 4. แปลงข้อมูล PHP ให้อยู่ในฟอร์แมตที่ตารางต้องการ
        termScoreRows = uniqueData.map(row => {
            const student = row.student;
            const classInfo = student?.class;
            const major = classInfo?.major;
            
            // ✅ ข้อมูล Counts ที่ PHP คำนวณมาให้แล้ว
            const counts = student?.counts || { 
                flag_total: 0, flag_attended: 0, 
                dept_total: 0, dept_attended: 0 
            };

            const flagTotal = parseInt(counts.flag_total || 0);
            const flagAttended = parseInt(counts.flag_attended || 0);
            const deptTotal = parseInt(counts.dept_total || 0);
            const deptAttended = parseInt(counts.dept_attended || 0);

            // คำนวณเปอร์เซ็นต์
            const calcFlagPercent = flagTotal > 0 ? (flagAttended / flagTotal) * 100 : 0;
            const calcDeptPercent = deptTotal > 0 ? (deptAttended / deptTotal) * 100 : 0;

            // เกณฑ์ผ่าน 80%
            const isPassedCalc = (calcFlagPercent >= 80) && (calcDeptPercent >= 80);

            return {
                id: row.id,
                student_id: student?.id ?? "-",
                studentName: student?.name ?? "-",
                majorName: major?.name ?? "-",
                level: major?.level ?? "-",
                year: classInfo?.year ?? "-",
                classNumber: classInfo?.class_number ?? "-",

                flagText: `${flagAttended}/${flagTotal}`,
                deptText: `${deptAttended}/${deptTotal}`,

                flagAttended, flagTotal,
                deptAttended, deptTotal,

                percentFlag: parseFloat(calcFlagPercent.toFixed(2)),
                percentActivity: parseFloat(calcDeptPercent.toFixed(2)),
                isPassed: isPassedCalc
            };
        });

        // เริ่มต้น Filter
        initFilters();

    } catch (error) {
        console.error("ERROR >", error);
        tbody.innerHTML = `
            <tr><td colspan="8" style="color: red; text-align:center;">เกิดข้อผิดพลาด: ${error.message}</td></tr>
        `;
    }
}

/* ====== FILTER LOGIC & RENDERING (ใช้ Logic เดิมได้เลย) ====== */

function initFilters() {
    // 1. สร้าง Dropdowns
    const uniqueLevels = [...new Set(termScoreRows.map(r => r.level))].filter(l => l !== "-").sort();
    fillSelect("level", uniqueLevels, "ทุกระดับ");

    // 2. กำหนดค่าเริ่มต้น (จากข้อมูลที่หามาได้ในขั้นตอน fetch)
    if (leaderClassInfo) {
        const { level, majorName, classNumber } = leaderClassInfo;

        const levelSelect = document.getElementById("level");
        if (uniqueLevels.includes(level)) {
            levelSelect.value = level;
        }

        updateMajorDropdown();
        const departmentSelect = document.getElementById("department");
        // เช็คว่า option มีค่า majorName ไหม
        if (departmentSelect && [...departmentSelect.options].some(o => o.value === majorName)) {
            departmentSelect.value = majorName;
        }

        updateYearAndRoomDropdown();
        const classNumberSelect = document.getElementById("classNumber");
        if (classNumberSelect && [...classNumberSelect.options].some(o => o.value === classNumber)) {
            classNumberSelect.value = classNumber;
        }
    }

    // 3. Event Listeners
    document.getElementById("level").addEventListener("change", () => { updateMajorDropdown(); updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("department").addEventListener("change", () => { updateYearAndRoomDropdown(); renderFilteredTable(); });
    document.getElementById("studentYear").addEventListener("change", renderFilteredTable);
    document.getElementById("classNumber").addEventListener("change", renderFilteredTable);
    document.getElementById("searchInput").addEventListener("input", renderFilteredTable);

    renderFilteredTable();
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
    // พยายามคงค่าเดิมไว้ถ้ามีอยู่ในตัวเลือกใหม่
    // ใช้ trick เล็กน้อยเพื่อเช็คทั้ง string และ number
    if ([...select.options].some(o => o.value == currentVal)) {
        select.value = currentVal;
    }
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
    // ต้องแปลง rowId เป็น string เพื่อความชัวร์เวลาค้นหา
    const row = termScoreRows.find(r => r.id.toString() === rowId.toString());
    if (!row) return;

    document.getElementById('modalStudentName').textContent = row.studentName;

    // --- การ์ดซ้าย: หน้าเสาธง ---
    document.getElementById('flagTotal').textContent = `${row.flagTotal} ครั้ง`;
    document.getElementById('flagAttended').textContent = `${row.flagAttended} ครั้ง`;
    document.getElementById('flagPercent').textContent = `${row.percentFlag}%`;

    const flagIcon = document.getElementById('flagIcon');
    const flagCard = document.getElementById('flagCard');
    if (row.percentFlag >= 80) {
        flagIcon.className = "fas fa-check";
        flagCard.className = "card-detail card-blue"; // สีฟ้าตาม CSS เดิม
    } else {
        flagIcon.className = "fas fa-times";
        flagCard.className = "card-detail card-red";
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

    document.getElementById('studentModal').style.display = 'flex';
}

function closeStudentModal() {
    document.getElementById('studentModal').style.display = 'none';
}

window.onclick = function (event) {
    const modal = document.getElementById('studentModal');
    if (event.target == modal) {
        closeStudentModal();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await fetchTermScore();
});