// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU'; // Key ของคุณ
// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let departmentSelect;
let levelSelect;
let dataTableBody;
let studentYearSelect; 
let classNumberSelect; 
let allMajors = []; 

// ตัวแปรสำหรับเก็บ Major ID ที่ถูกเลือก
let selectedMajorId = null;

async function populateFilters() {
    console.log('Fetching major data for filters...');
    
    // ดึงข้อมูลทั้งหมดจากตาราง 'major'
    const { data: majors, error } = await supabaseClient
        .from('major')
        .select('id, name, level');

    if (error) {
        console.error('Error fetching majors:', error.message);
        return;
    }

    // เก็บข้อมูล Major ทั้งหมดไว้ในตัวแปร Global
    allMajors = majors; 

    // A. Populate ระดับ (Level) Filter
    const uniqueLevels = [...new Set(majors.map(m => m.level))];
    levelSelect.innerHTML = '<option value="">เลือกระดับ</option>';

    uniqueLevels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        levelSelect.appendChild(option);
    });

    // B. ล้าง Major Filter
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
}

function updateMajorFilter() {
    const selectedLevel = levelSelect.value;
    
    // ล้าง dropdown สาขาเดิม
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';

    if (selectedLevel) {
        // กรอง Majors เฉพาะที่อยู่ใน Level ที่ถูกเลือก
        const filteredMajors = allMajors.filter(m => m.level === selectedLevel);
        // ใช้ Set เพื่อให้แน่ใจว่าชื่อสาขาไม่ซ้ำ (กรณีมี ปวช. และ ปวส. ชื่อเดียวกัน)
        const uniqueMajorNames = [...new Set(filteredMajors.map(m => m.name))];

        uniqueMajorNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            departmentSelect.appendChild(option);
        });
    }

    // เรียกโหลดข้อมูลนักเรียนใหม่หลังจากอัปเดตสาขาแล้ว
    fetchAndRenderStudents();
}

async function fetchAndRenderStudents() {
    const selectedMajorName = departmentSelect.value;
    const selectedLevel = levelSelect.value;
    const selectedYear = studentYearSelect.value; 
    const selectedClassNumber = classNumberSelect.value; 

    // 1. กำหนด Join string และ Inner Join Condition
    // เนื่องจาก student เชื่อม class_id เราจึงต้อง Join ตาราง class และ major
    let classSelectString = `class!inner(
        year, 
        class_number, 
        major!inner (name, level)
    )`; 
    
    // เนื่องจากเรามีการ Join class และ major อยู่แล้ว เราจึงใช้ Inner Join เสมอเมื่อมีการกรอง
    // แต่ถ้าไม่ใช้ฟิลเตอร์ใดๆ เลย ก็ยังต้อง Join เพื่อดึง year/class_number
    let query = supabaseClient
        .from('student')
        .select(`
            id, 
            name, 
            role, 
            ${classSelectString} 
        `);

    // 2. ใช้ Filter ตามที่เลือก (ทั้งหมดจะกรองผ่านตาราง class หรือ major ที่ Join มา)
    if (selectedMajorName) {
        // กรองนักเรียนโดยใช้ชื่อสาขาผ่าน Major Table
        query = query.eq('class.major.name', selectedMajorName);
    }

    if (selectedLevel) {
        // กรองนักเรียนโดยใช้ระดับผ่าน Major Table
        query = query.eq('class.major.level', selectedLevel);
    }
    
    if (selectedYear) {
        // กรองนักเรียนโดยใช้ชั้นปีผ่าน Class Table
        query = query.eq('class.year', parseInt(selectedYear));
    }

    if (selectedClassNumber) {
        // กรองนักเรียนโดยใช้ห้องผ่าน Class Table
        query = query.eq('class.class_number', parseInt(selectedClassNumber));
    }

    // 3. ดึงข้อมูล
    const { data: students, error } = await query
        .order('id', { ascending: true }); // เรียงตามรหัสนักศึกษา

    if (error) {
        console.error('Error fetching student data:', error.message);
        dataTableBody.innerHTML = '<tr><td colspan="5">ไม่สามารถโหลดข้อมูลนักเรียนได้</td></tr>'; // แก้ไข colspan
        return;
    }

    // 4. Render Data
    dataTableBody.innerHTML = ''; // Clear table

    if (students.length === 0) {
        dataTableBody.innerHTML = '<tr><td colspan="5">ไม่พบข้อมูลนักเรียนตามเงื่อนไขที่เลือก</td></tr>'; // แก้ไข colspan
        return;
    }

    // Mapping role (จาก DB: 'Student', 'Leader') ไปเป็นภาษาไทย
    const roleMap = {
        'Student': 'นักเรียน',
        'Leader': 'ผู้ช่วยอาจารย์'
    };
    const availableRoles = ['Student', 'Leader'];

    students.forEach(student => {
        // เข้าถึงข้อมูล year และ class_number ผ่าน object 'class'
        const classData = student.class; 
        
        // ตรวจสอบว่า Class Data มีอยู่จริงหรือไม่ (ควรจะมีเพราะใช้ Inner Join)
        if (!classData) {
            console.warn(`Student ID ${student.id} has no class data.`);
            return;
        }

        const row = dataTableBody.insertRow();

        // 1. ชื่อ
        row.insertCell().textContent = student.name;
        // 2. ชั้นปี (มาจากตาราง class)
        row.insertCell().textContent = classData.year;
        // 3. ห้อง (มาจากตาราง class)
        row.insertCell().textContent = classData.class_number; 
        // 4. รหัสนักศึกษา
        row.insertCell().textContent = student.id; 

        // 5. บทบาท (Role Select Dropdown)
        const roleCell = row.insertCell();
        const roleSelect = document.createElement('select');
        roleSelect.className = 'role-select';
        roleSelect.dataset.studentId = student.id; 

        availableRoles.forEach(roleKey => {
            const option = document.createElement('option');
            option.value = roleKey;
            option.textContent = roleMap[roleKey] || roleKey; 
            if (roleKey === student.role) {
                option.selected = true;
            }
            roleSelect.appendChild(option);
        });

        roleSelect.addEventListener('change', handleRoleUpdate);
        roleCell.appendChild(roleSelect);
    });

    console.log(`Students loaded successfully: ${students.length} items`);
}

/**
 * 3. ฟังก์ชันจัดการเมื่อมีการเปลี่ยนบทบาท (Role)
 */
async function handleRoleUpdate(event) {
    const selectElement = event.target;
    const studentId = selectElement.dataset.studentId;
    const newRole = selectElement.value;

    if (!confirm(`แน่ใจที่จะเปลี่ยนบทบาทของรหัส ${studentId} เป็น ${selectElement.options[selectElement.selectedIndex].textContent} หรือไม่?`)) {
        // ดึงค่าเดิมกลับมาเพื่อไม่ให้ UI ไม่ตรงกับ DB (เฉพาะในกรณีที่ยกเลิก)
        await fetchAndRenderStudents(); 
        return;
    }
try {
        const { error: studentUpdateError } = await supabaseClient
            .from('student')
            .update({ role: newRole })
            .eq('id', studentId);

       if (studentUpdateError) {
            console.error('Error updating student role:', studentUpdateError.message);
            
            // *** ส่วนนี้คือการจัดการ Error ที่มาจาก Database Trigger ***
            if (studentUpdateError.message.includes('already has 2 leaders')) {
                alert(`ไม่สามารถอัปเดตบทบาทได้: สาขาและชั้นปีนี้เต็มโควต้าหัวหน้า (จำกัด 2 คน)`);
            } else {
                alert(`ไม่สามารถอัปเดตบทบาทได้: ${studentUpdateError.message}`);
            }
            
            // รีโหลดข้อมูลเพื่อแสดงสถานะที่ถูกต้อง
            await fetchAndRenderStudents();
            return;
        }

        alert(`อัปเดตบทบาทของรหัส ${studentId} สำเร็จเป็น ${selectElement.options[selectElement.selectedIndex].textContent}`);

    } catch (e) {
        console.error('Update Error:', e);
        alert('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // *** ย้ายการกำหนดค่าตัวแปร DOM มาไว้ในนี้ ***
    departmentSelect = document.getElementById('department');
    levelSelect = document.getElementById('level');
    studentYearSelect = document.getElementById('studentYear'); 
    classNumberSelect = document.getElementById('classNumber'); 
    dataTableBody = document.querySelector('.data-table tbody');

    // ตรวจสอบว่า Elements ถูกโหลดหรือไม่
    if (!departmentSelect || !levelSelect || !studentYearSelect || !classNumberSelect || !dataTableBody) { 
        console.error("Critical Error: One or more required DOM elements were not found.");
        return; 
    }

    populateFilters();
    fetchAndRenderStudents(); // โหลดข้อมูลครั้งแรก

    levelSelect.addEventListener('change', updateMajorFilter);
    departmentSelect.addEventListener('change', fetchAndRenderStudents);
    studentYearSelect.addEventListener('change', fetchAndRenderStudents);
    classNumberSelect.addEventListener('change', fetchAndRenderStudents);
});