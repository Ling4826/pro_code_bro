/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let termScoreRows = []; 

async function fetchTermScore() {
    document.getElementById("score-body").innerHTML = `
        <tr><td colspan="12" style="padding: 20px; color: #666;">กำลังดึงข้อมูล...</td></tr>
    `;

    // 1. ดึงข้อมูล User จาก Session
    const userRole = sessionStorage.getItem('user_role')?.toLowerCase(); // admin, teacher, student
    const userRefId = sessionStorage.getItem('ref_id'); // รหัสนักศึกษา (ถ้าเป็นนักเรียน)

    // 2. สร้าง Query พื้นฐาน
    let query = supabaseClient
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

    // 3. 🛡️ เพิ่มเงื่อนไขกรอง: ถ้าเป็น "student" ให้เห็นแค่ของตัวเอง
    if (userRole === 'student' && userRefId) {
        query = query.eq('student_id', userRefId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("ERROR >", error);
        document.getElementById("score-body").innerHTML = `
            <tr><td colspan="12" style="color: red;">เกิดข้อผิดพลาด: ${error.message}</td></tr>
        `;
        return null;
    }

    // แปลงข้อมูล (Mapping)
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
            majorName: major?.name ?? "-",
            level: major?.level ?? "-", 
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

    // เริ่มต้นระบบ Filter
    initFilters();
    
    // แสดงตาราง
    renderFilteredTable();
    
    // ถ้าเป็นนักเรียน ให้ซ่อนตัวกรองที่ไม่จำเป็น (Optional)
    if (userRole === 'student') {
        const filterBox = document.querySelector('.filter-controls');
        if(filterBox) filterBox.style.display = 'none'; // ซ่อนกล่องค้นหาไปเลยเพราะเห็นแค่คนเดียวอยู่แล้ว
    }
}

// ... (ส่วน Logic initFilters, getFilteredRows, renderFilteredTable เหมือนเดิม) ...
// เพื่อความกระชับ คุณสามารถใช้ฟังก์ชันเดิมต่อท้ายตรงนี้ได้เลยครับ 
// หรือถ้าต้องการโค้ดเต็มๆ แจ้งได้ครับ
// ============================================
// === SMART FILTER LOGIC (Cascading) ===
// ============================================

function initFilters() {
    const uniqueLevels = [...new Set(termScoreRows.map(r => r.level))].filter(l => l !== "-").sort();
    fillSelect("level", uniqueLevels, "ทุกระดับ");

    document.getElementById("level").addEventListener("change", () => {
        updateMajorDropdown(); 
        updateYearAndRoomDropdown(); 
        renderFilteredTable();
    });

    document.getElementById("department").addEventListener("change", () => {
        updateYearAndRoomDropdown();
        renderFilteredTable();
    });

    document.getElementById("studentYear").addEventListener("change", renderFilteredTable);
    document.getElementById("classNumber").addEventListener("change", renderFilteredTable);
    document.getElementById("searchInput").addEventListener("input", renderFilteredTable);

    updateMajorDropdown();
    updateYearAndRoomDropdown();
}

function updateMajorDropdown() {
    const levelSelect = document.getElementById("level");
    const selectedLevel = levelSelect.value;
    let filteredRows = termScoreRows;
    if (selectedLevel) {
        filteredRows = termScoreRows.filter(r => r.level === selectedLevel);
    }
    const uniqueMajors = [...new Set(filteredRows.map(r => r.majorName))].sort();
    fillSelect("department", uniqueMajors, "ทุกสาขาวิชา");
}

function updateYearAndRoomDropdown() {
    const levelSelect = document.getElementById("level");
    const majorSelect = document.getElementById("department");
    const selectedLevel = levelSelect.value;
    const selectedMajor = majorSelect.value;
    let filteredRows = termScoreRows;
    if (selectedLevel) filteredRows = filteredRows.filter(r => r.level === selectedLevel);
    if (selectedMajor) filteredRows = filteredRows.filter(r => r.majorName === selectedMajor);

    const uniqueYears = [...new Set(filteredRows.map(r => r.year))].sort((a,b) => a-b);
    const uniqueRooms = [...new Set(filteredRows.map(r => r.classNumber))].sort((a,b) => a-b);

    const currentYear = document.getElementById("studentYear").value;
    const currentRoom = document.getElementById("classNumber").value;

    fillSelect("studentYear", uniqueYears, "ทุกชั้นปี", "ปี ");
    fillSelect("classNumber", uniqueRooms, "ทุกห้อง", "ห้อง ");

    if (uniqueYears.includes(Number(currentYear)) || uniqueYears.includes(currentYear)) {
        document.getElementById("studentYear").value = currentYear;
    }
    if (uniqueRooms.includes(Number(currentRoom)) || uniqueRooms.includes(currentRoom)) {
        document.getElementById("classNumber").value = currentRoom;
    }
}

function fillSelect(elementId, items, placeholder, prefix = "") {
    const select = document.getElementById(elementId);
    if (!select) return;
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

document.addEventListener("DOMContentLoaded", async () => {
    await fetchTermScore();
});