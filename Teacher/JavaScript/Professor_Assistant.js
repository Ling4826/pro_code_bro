// Professor_Assistant.js

const CONFIG = {
    API_URL: 'PHP/api_manage_students.php'
};

let departmentSelect;
let levelSelect;
let studentYearSelect; 
let classNumberSelect; 
let dataTableBody;

let allMajors = []; 
let allClasses = []; 

// ==========================================
// 1. INIT & LOAD FILTER DATA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Get DOM Elements
    departmentSelect = document.getElementById('department');
    levelSelect = document.getElementById('level');
    studentYearSelect = document.getElementById('studentYear'); 
    classNumberSelect = document.getElementById('classNumber'); 
    dataTableBody = document.querySelector('.data-table tbody');

    if (!departmentSelect || !levelSelect || !dataTableBody) {
        console.error("Required elements not found");
        return;
    }

    // 2. Load Filters
    populateFilters();

    // 3. Attach Events
    levelSelect.addEventListener('change', handleLevelChange);
    departmentSelect.addEventListener('change', handleMajorChange);
    studentYearSelect.addEventListener('change', () => {
        updateClassNumberFilter();
        fetchAndRenderStudents();
    });
    classNumberSelect.addEventListener('change', fetchAndRenderStudents);

    // 4. Initial Load
    fetchAndRenderStudents(); 
});

async function populateFilters() {
    try {
        // A. Load Majors
        const resMajors = await fetch(`${CONFIG.API_URL}?action=get_majors`);
        const dataMajors = await resMajors.json();
        if(dataMajors.status === 'success') allMajors = dataMajors.data;

        // B. Load Classes
        const resClasses = await fetch(`${CONFIG.API_URL}?action=get_classes`);
        const dataClasses = await resClasses.json();
        if(dataClasses.status === 'success') allClasses = dataClasses.data;

        // C. Populate Level Dropdown
        const uniqueLevels = [...new Set(allMajors.map(m => m.level))];
        levelSelect.innerHTML = '<option value="">เลือกระดับ</option>';
        uniqueLevels.forEach(level => {
            levelSelect.innerHTML += `<option value="${level}">${level}</option>`;
        });

    } catch (err) {
        console.error('Filter loading error:', err);
    }
}

// ==========================================
// 2. FILTER LOGIC
// ==========================================
function handleLevelChange() {
    updateMajorDropdown();
    updateYearDropdown(); 
    updateClassNumberFilter(); 
    fetchAndRenderStudents();
}

function handleMajorChange() {
    updateClassNumberFilter();
    fetchAndRenderStudents();
}

function updateMajorDropdown() {
    const selectedLevel = levelSelect.value;
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    
    if(!selectedLevel) return;

    const filteredMajors = allMajors.filter(m => m.level === selectedLevel);
    // ใช้ Set เพื่อกรองชื่อซ้ำ (ถ้ามี)
    const uniqueNames = [...new Set(filteredMajors.map(m => m.name))];
    
    uniqueNames.forEach(name => {
        departmentSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });
}

function updateYearDropdown() {
    const selectedLevel = levelSelect.value;
    studentYearSelect.innerHTML = '<option value="">เลือกชั้นปี</option>';

    if (!selectedLevel) return;

    // Logic ง่ายๆ ตามระดับ (หรือจะกรองจาก allClasses ก็ได้)
    let years = [];
    if (selectedLevel === 'ปวช.') years = [1, 2, 3];
    else if (selectedLevel === 'ปวส.') years = [1, 2];

    years.forEach(y => {
        studentYearSelect.innerHTML += `<option value="${y}">ปี ${y}</option>`;
    });
}

function updateClassNumberFilter() {
    const selectedYear = studentYearSelect.value;
    const selectedMajorName = departmentSelect.value;
    const selectedLevel = levelSelect.value;

    classNumberSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    if (!selectedLevel || !selectedMajorName || !selectedYear) return;

    // หา major_id จาก name & level
    const targetMajors = allMajors.filter(m => m.name === selectedMajorName && m.level === selectedLevel);
    const targetMajorIds = targetMajors.map(m => m.id);

    // กรอง Classes
    const filteredClasses = allClasses.filter(c => 
        targetMajorIds.includes(c.major_id) && 
        c.year == selectedYear
    );

    const uniqueClassNums = [...new Set(filteredClasses.map(c => c.class_number))].sort((a,b) => a-b);

    uniqueClassNums.forEach(num => {
        classNumberSelect.innerHTML += `<option value="${num}">ห้อง ${num}</option>`;
    });
}

// ==========================================
// 3. FETCH & RENDER STUDENTS
// ==========================================
async function fetchAndRenderStudents() {
    dataTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';

    const params = new URLSearchParams({
        action: 'get_students',
        majorName: departmentSelect.value,
        level: levelSelect.value,
        year: studentYearSelect.value,
        classNumber: classNumberSelect.value
    });

    try {
        const res = await fetch(`${CONFIG.API_URL}?${params}`);
        const result = await res.json();

        dataTableBody.innerHTML = '';

        if (result.status !== 'success' || result.data.length === 0) {
            dataTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่พบข้อมูลนักเรียน</td></tr>';
            return;
        }

        const roleMap = { 'Student': 'นักเรียน', 'Leader': 'ผู้ช่วยอาจารย์' };

        result.data.forEach(student => {
            const row = dataTableBody.insertRow();
            
            row.insertCell().textContent = student.name;
            row.insertCell().textContent = student.major_level;
            row.insertCell().textContent = student.year;
            row.insertCell().textContent = student.class_number;
            row.insertCell().textContent = student.id;

            // Role Select
            const roleCell = row.insertCell();
            const select = document.createElement('select');
            select.className = 'role-select'; // ใส่ class ไว้แต่ง CSS
            select.dataset.studentId = student.id;
            select.dataset.originalRole = student.role; // เก็บค่าเดิมไว้กันพลาด

            ['Student', 'Leader'].forEach(roleKey => {
                const opt = document.createElement('option');
                opt.value = roleKey;
                opt.textContent = roleMap[roleKey];
                if (student.role === roleKey) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener('change', handleRoleUpdate);
            roleCell.appendChild(select);
        });

    } catch (err) {
        console.error('Fetch students error:', err);
        dataTableBody.innerHTML = `<tr><td colspan="6" style="color:red;">เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
    }
}

// ==========================================
// 4. UPDATE ROLE (LOGIC)
// ==========================================
async function handleRoleUpdate(event) {
    const select = event.target;
    const studentId = select.dataset.studentId;
    const newRole = select.value;
    const originalRole = select.dataset.originalRole;
    const roleText = select.options[select.selectedIndex].text;

    const confirmMsg = `ยืนยันการเปลี่ยนบทบาทของรหัส ${studentId}\nเป็น "${roleText}" หรือไม่?`;
    
    if (!confirm(confirmMsg)) {
        select.value = originalRole; // คืนค่าเดิมถ้ากด ยกเลิก
        return;
    }

    try {
        const res = await fetch(`${CONFIG.API_URL}?action=update_role`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: studentId,
                role: newRole
            })
        });

        const result = await res.json();

        if (result.status === 'success') {
            alert(`✅ ${result.message}`);
            select.dataset.originalRole = newRole; // อัปเดตค่าเดิมเป็นค่าใหม่
            // อาจจะโหลดตารางใหม่เพื่อความชัวร์ หรือปล่อยไว้ก็ได้
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        alert(`❌ ไม่สามารถอัปเดตได้: ${err.message}`);
        select.value = originalRole; // ดีดกลับค่าเดิม
    }
}