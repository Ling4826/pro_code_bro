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
                        level,
                        teacher_major (
                            teacher:teacher_id (id, name)
                        )
                    )
                ),
                activity_check (
                    id,
                    activity_id,
                    status
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

    // แปลงข้อมูลให้อยู่ในรูปแบบ Flat Data เพื่อให้ง่ายต่อการกรอง
    termScoreRows = data.map(row => {
        const student = row.student;
        const classInfo = student?.class;
        const major = classInfo?.major;
        
        const advisorList = major?.teacher_major?.map(tm => tm.teacher.name) || [];
        const activityCount = row.activity_check?.filter(a => a.status === "Attended").length || 0;

        return {
            id: row.id,
            student_id: student?.id ?? "-",
            studentName: student?.name ?? "-",
            
            // ข้อมูลสำหรับ Filter
            majorName: major?.name ?? "-",
            level: major?.level ?? "-", // ใช้ Level จาก Database โดยตรง
            year: classInfo?.year ?? "-",
            classNumber: classInfo?.class_number ?? "-",
            
            advisors: advisorList.join(", ") || "-",
            attendedActivity: activityCount,
            
            exActivity: row.flag_ceremony_percentage,
            exInternship: row.department_activity_percentage,
            
            isActivityPassed: row.is_passed,
            isInternshipPassed: row.department_activity_percentage >= 50
        };
    });

    // เริ่มต้นระบบ Filter (Cascading)
    initFilters();
    
    // แสดงตารางครั้งแรก
    renderFilteredTable();
}

// ============================================
// === SMART FILTER LOGIC (Cascading) ===
// ============================================

function initFilters() {
    // 1. ดึง Level ทั้งหมดที่มีในระบบมาใส่ Dropdown แรกสุด
    // (บางทีใน DB อาจเก็บเป็น "ปวช." หรือ "Vocational Certificate" ต้องเช็คดีๆ)
    // ในที่นี้สมมติว่าใน DB major.level เก็บคำว่า "ปวช." หรือ "ปวส."
    
    // ถ้าอยาก Hardcode เพื่อความสวยงามก็ได้ แต่ถ้าเอาจาก DB ก็ใช้แบบนี้:
    const uniqueLevels = [...new Set(termScoreRows.map(r => r.level))].filter(l => l !== "-").sort();
    fillSelect("level", uniqueLevels, "ทุกระดับ");

    // เมื่อ Level เปลี่ยน -> ให้ไปอัปเดต Major
    document.getElementById("level").addEventListener("change", () => {
        updateMajorDropdown(); 
        updateYearAndRoomDropdown(); // รีเซ็ตลูกๆ
        renderFilteredTable();
    });

    // เมื่อ Major เปลี่ยน -> ให้ไปอัปเดต Year และ Room
    document.getElementById("department").addEventListener("change", () => {
        updateYearAndRoomDropdown();
        renderFilteredTable();
    });

    // เมื่อ Year/Room เปลี่ยน -> แค่ Render ตารางใหม่
    document.getElementById("studentYear").addEventListener("change", renderFilteredTable);
    document.getElementById("classNumber").addEventListener("change", renderFilteredTable);
    document.getElementById("searchInput").addEventListener("input", renderFilteredTable);

    // Initial populate
    updateMajorDropdown();
    updateYearAndRoomDropdown();
}

function updateMajorDropdown() {
    const levelSelect = document.getElementById("level");
    const selectedLevel = levelSelect.value;
    
    // กรองเอาเฉพาะข้อมูลที่ตรงกับ Level ที่เลือก
    let filteredRows = termScoreRows;
    if (selectedLevel) {
        filteredRows = termScoreRows.filter(r => r.level === selectedLevel);
    }

    // ดึงรายชื่อสาขาจากข้อมูลที่กรองแล้ว
    const uniqueMajors = [...new Set(filteredRows.map(r => r.majorName))].sort();
    
    // เติมเข้า Dropdown สาขา
    fillSelect("department", uniqueMajors, "ทุกสาขาวิชา");
}

function updateYearAndRoomDropdown() {
    const levelSelect = document.getElementById("level");
    const majorSelect = document.getElementById("department");
    
    const selectedLevel = levelSelect.value;
    const selectedMajor = majorSelect.value;

    // กรองข้อมูลตาม Level และ Major ที่เลือกอยู่
    let filteredRows = termScoreRows;
    if (selectedLevel) {
        filteredRows = filteredRows.filter(r => r.level === selectedLevel);
    }
    if (selectedMajor) {
        filteredRows = filteredRows.filter(r => r.majorName === selectedMajor);
    }

    // ดึงชั้นปี และ ห้อง ที่เป็นไปได้จากข้อมูลชุดนั้น
    const uniqueYears = [...new Set(filteredRows.map(r => r.year))].sort((a,b) => a-b);
    const uniqueRooms = [...new Set(filteredRows.map(r => r.classNumber))].sort((a,b) => a-b);

    // เติม Dropdown (เก็บค่าเดิมไว้ถ้ามี แต่ถ้าค่าเดิมไม่อยู่ในลิสต์ใหม่ มันจะเด้งออกเอง)
    const currentYear = document.getElementById("studentYear").value;
    const currentRoom = document.getElementById("classNumber").value;

    fillSelect("studentYear", uniqueYears, "ทุกชั้นปี", "ปี ");
    fillSelect("classNumber", uniqueRooms, "ทุกห้อง", "ห้อง ");

    // พยายามคืนค่าเดิมกลับไปถ้ามันยัง valid อยู่
    if (uniqueYears.includes(Number(currentYear)) || uniqueYears.includes(currentYear)) {
        document.getElementById("studentYear").value = currentYear;
    }
    if (uniqueRooms.includes(Number(currentRoom)) || uniqueRooms.includes(currentRoom)) {
        document.getElementById("classNumber").value = currentRoom;
    }
}

// Helper Function: เติม Option เข้า Select
function fillSelect(elementId, items, placeholder, prefix = "") {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    // ล้างของเก่า
    select.innerHTML = `<option value="">${placeholder}</option>`;
    
    items.forEach(item => {
        if (item !== "-" && item !== null && item !== undefined) { 
            const option = document.createElement("option");
            option.value = item;
            option.textContent = prefix + item;
            select.appendChild(option);
        }
    });
}

// ============================================
// === FILTER TABLE LOGIC ===
// ============================================

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

function renderFilteredTable() {
    const filtered = getFilteredRows();
    const tbody = document.getElementById("score-body");
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 20px; color: #999;">ไม่พบข้อมูลตามเงื่อนไข</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        const actBadgeClass = row.isActivityPassed ? 'status-pass' : 'status-fail';
        const actText = row.isActivityPassed ? 'ผ่าน' : 'ไม่ผ่าน';

        const internBadgeClass = row.isInternshipPassed ? 'status-pass' : 'status-fail';
        const internText = row.isInternshipPassed ? 'ผ่าน' : 'ไม่ผ่าน';

        return `
        <tr>
            <td>${row.student_id}</td>
            <td style="font-weight: bold;">${row.studentName}</td>
            <td>${row.majorName}</td>
            <td>${row.year}</td>
            <td>${row.classNumber}</td>
            <td>${row.advisors}</td>
            <td>${row.attendedActivity}</td>
            <td>${row.exActivity}%</td>
            <td>${row.exInternship}%</td>
            <td><span class="status-badge ${actBadgeClass}">${actText}</span></td>
            <td><span class="status-badge ${internBadgeClass}">${internText}</span></td>
        </tr>
        `;
    }).join("");
}

// เริ่มทำงานเมื่อโหลดหน้าเสร็จ
document.addEventListener("DOMContentLoaded", async () => {
    await fetchTermScore();
});