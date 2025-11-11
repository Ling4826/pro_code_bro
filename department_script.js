// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
// NOTE: ใช้ค่าที่คุณให้มาในตัวอย่างโค้ด
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const departmentSelect = document.getElementById('department');
const levelSelect = document.getElementById('level');
const dataTableBody = document.querySelector('.data-table tbody');

// ตัวแปรสำหรับเก็บ Major ID ที่ถูกเลือก
let selectedMajorId = null; 

/**
 * 1. ดึงข้อมูลสาขาและระดับทั้งหมดเพื่อใช้ใน Filter Dropdown
 */
async function populateFilters() {
    console.log('Fetching major data for filters...');

    // ดึงข้อมูลทั้งหมดจากตาราง 'major'
    const { data: majors, error } = await supabaseClient
        .from('major')
        .select('id, name, level'); // ดึงทั้ง id, name, และ level

    if (error) {
        console.error('Error fetching majors:', error.message);
        return;
    }

    // A. Populate สาขา (Major) Filter
    const uniqueMajorNames = [...new Set(majors.map(m => m.name))];
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>'; // ใช้ value="" แทน 'เลือกสาขา'
    
    uniqueMajorNames.forEach(name => {
        const option = document.createElement('option');
        // NOTE: ใช้ชื่อสาขา (name) เป็น value สำหรับ filter UI
        option.value = name; 
        option.textContent = name;
        departmentSelect.appendChild(option);
    });

    // B. Populate ระดับ (Level) Filter
    const uniqueLevels = [...new Set(majors.map(m => m.level))];
    levelSelect.innerHTML = '<option value="">เลือกระดับ</option>'; // ใช้ value="" แทน 'เลือกระดับ'

    uniqueLevels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        levelSelect.appendChild(option);
    });
}

/**
 * 2. ดึงข้อมูลนักเรียนตาม Filter ที่เลือกและ Render ลงในตาราง
 */
async function fetchAndRenderStudents() {
    const selectedMajorName = departmentSelect.value;
    const selectedLevel = levelSelect.value;
    
    // 1. สร้าง Query Base
    let query = supabaseClient
        .from('student')
        .select(`
            id, 
            name, 
            role, 
            major (id, name, level) 
        `);

    // 2. ใช้ Filter ตามที่เลือก
    if (selectedMajorName) {
        // กรองนักเรียนโดยใช้ชื่อสาขาและระดับผ่านการ Join กับตาราง major
        query = query.eq('major.name', selectedMajorName);
    }
    
    if (selectedLevel) {
        // Supabase ต้องกรองผ่าน Major table สำหรับ 'level'
        // NOTE: การกรอง nested object/join ใน Supabase ต้องตั้งค่า RLS Policy ให้ถูกต้อง
        // แต่ในเบื้องต้นจะใช้การดึงข้อมูลทั้งหมดมา filter ใน JS ก่อน (ไม่แนะนำสำหรับข้อมูลเยอะ)
        // หรือใช้ RPC (Stored Procedure) ถ้าไม่สามารถกรองผ่าน Join ได้ตรงๆ

        // สำหรับตอนนี้จะลองใช้ eq ใน major.level แต่หากไม่ได้ผล อาจต้องใช้ RPC
        query = query.eq('major.level', selectedLevel); 
    }
    
    // 3. ดึงข้อมูล
    const { data: students, error } = await query
        .order('id', { ascending: true }); // เรียงตามรหัสนักศึกษา

    if (error) {
        console.error('Error fetching student data:', error.message);
        dataTableBody.innerHTML = '<tr><td colspan="3">ไม่สามารถโหลดข้อมูลนักเรียนได้</td></tr>';
        return;
    }
    
    // 4. Render Data
    dataTableBody.innerHTML = ''; // Clear table
    
    if (students.length === 0) {
        dataTableBody.innerHTML = '<tr><td colspan="3">ไม่พบข้อมูลนักเรียนตามเงื่อนไขที่เลือก</td></tr>';
        return;
    }

    // Mapping role (จาก DB: 'Student', 'Leader') ไปเป็นภาษาไทย
    const roleMap = {
        'Student': 'นักเรียน',
        'Leader': 'ผู้ช่วยอาจารย์'
    };
    
    // ตัวเลือกทั้งหมดใน dropdown (เผื่อไว้สำหรับ Admin ที่ต้องการเปลี่ยนบทบาท)
    const availableRoles = ['Student', 'Leader', 'Teacher']; 

    students.forEach(student => {
        const row = dataTableBody.insertRow();
        
        // 1. ชื่อ
        row.insertCell().textContent = student.name;

        // 2. รหัสนักศึกษา
        row.insertCell().textContent = student.id;

        // 3. บทบาท (Role Select Dropdown)
        const roleCell = row.insertCell();
        const roleSelect = document.createElement('select');
        roleSelect.className = 'role-select';
        roleSelect.dataset.studentId = student.id; // เก็บ ID ไว้สำหรับ update

        availableRoles.forEach(roleKey => {
            const option = document.createElement('option');
            option.value = roleKey;
            option.textContent = roleMap[roleKey] || roleKey; // ใช้ค่าภาษาไทยถ้ามี
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
        // หากยกเลิก ให้เปลี่ยนค่าใน dropdown กลับไปเป็นค่าเดิมก่อนที่จะมีการเปลี่ยนแปลง (ถ้าทำได้)
        // สำหรับตอนนี้ เราจะให้ผู้ใช้เลือกอีกครั้ง หรือเรียก fetchAndRenderStudents() เพื่อโหลดข้อมูลใหม่
        // แต่การโหลดข้อมูลใหม่จะทำให้ตำแหน่งในตารางหายไป ดังนั้นควรให้เซิร์ฟเวอร์จัดการการเปลี่ยนแปลง
        return;
    }
    
    try {
        // NOTE: การเปลี่ยน Role เป็น 'Teacher' ควรทำผ่านตาราง user_account และอาจต้อง update ในตาราง teacher ด้วย
        // แต่สำหรับตาราง student เราจะอัพเดตเฉพาะ field 'role'
        const { error: studentUpdateError } = await supabaseClient
            .from('student')
            .update({ role: newRole })
            .eq('id', studentId);
            
        // NOTE: หากต้องการเปลี่ยน Role ใน user_account ด้วย ต้องเพิ่มโค้ดที่นี่

        if (studentUpdateError) {
            console.error('Error updating student role:', studentUpdateError.message);
            alert(`ไม่สามารถอัปเดตบทบาทได้: ${studentUpdateError.message}`);
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


// 4. Event Listener สำหรับโหลดข้อมูลเริ่มต้นและเมื่อมีการเปลี่ยน Filter
document.addEventListener('DOMContentLoaded', () => {
    populateFilters();
    fetchAndRenderStudents(); // โหลดข้อมูลครั้งแรก
    
    // Attach event listeners to filters
    departmentSelect.addEventListener('change', fetchAndRenderStudents);
    levelSelect.addEventListener('change', fetchAndRenderStudents);
});