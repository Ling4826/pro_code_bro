// Activity_list.js

// CONFIG
// Activity_list.js
const CONFIG = {
    API_GET_URL: 'PHP/api_get_activities.php',    
    API_ACTION_URL: 'PHP/api_activity_actions.php' // ใช้ Path นี้ถูกต้องแล้วครับ
};

let departmentSelect;
let levelSelect;
let studentYearSelect;
let classNumberSelect;
let activityNameInput;

let cachedActivities = []; // เก็บข้อมูลกิจกรรมทั้งหมดไว้กรอง Client-side
let activityIdToDelete = null;

// ==========================================================
// === 1. INITIALIZATION ===
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get Elements
    departmentSelect = document.getElementById('department');
    levelSelect = document.getElementById('level');
    studentYearSelect = document.getElementById('studentYear');
    classNumberSelect = document.getElementById('classNumber');
    activityNameInput = document.getElementById('activityNameInput');

    // 2. Setup Modal Elements (ย้ายมาไว้ข้างบนเพื่อความชัวร์)
    setupModalElements();

    if (!departmentSelect || !levelSelect || !studentYearSelect || !classNumberSelect || !activityNameInput) {
        console.error("Critical Error: Required DOM elements missing.");
        return;
    }

    // 3. Fetch Data
    fetchActivities();

    // 4. Attach Filter Listeners
    [levelSelect, departmentSelect, studentYearSelect, classNumberSelect].forEach(el => {
        el.addEventListener('change', () => filterActivities());
    });
    activityNameInput.addEventListener('input', () => filterActivities());
});

// ==========================================================
// === 2. FETCH DATA & POPULATE FILTERS ===
// ==========================================================

async function fetchActivities() {
    const container = document.getElementById('activityCardContainer');
    container.innerHTML = '<div class="loader">กำลังโหลดกิจกรรม...</div>';

    try {
        const response = await fetch(CONFIG.API_GET_URL);
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        
        const data = await response.json(); // PHP ส่ง Array กลับมาโดยตรง (จากไฟล์ api_get_activities.php)

        // ตรวจสอบ format ข้อมูล
        if (data.status === 'error') throw new Error(data.message);
        
        cachedActivities = Array.isArray(data) ? data : [];
        
        // 1. สร้างตัวเลือกใน Dropdown จากข้อมูลที่มีอยู่จริง (Smart Filters)
        populateSmartFilters();

        // 2. แสดงผลการ์ด
        RenderActivityCards(cachedActivities);

    } catch (error) {
        console.error('Fetch error:', error);
        container.innerHTML = `<p style="color:red; text-align:center;">เกิดข้อผิดพลาด: ${error.message}</p>`;
    }
}

// 🔥 Smart Filters: สร้างตัวเลือกจากกิจกรรมที่มีอยู่จริง ไม่ต้องยิง API เพิ่ม
function populateSmartFilters() {
    const uniqueLevels = new Set();
    const uniqueMajors = new Set();
    const uniqueYears = new Set();
    const uniqueClasses = new Set();

    cachedActivities.forEach(act => {
        if (act.class && act.class.major) {
            if (act.class.major.level) uniqueLevels.add(act.class.major.level);
            if (act.class.major.name) uniqueMajors.add(act.class.major.name);
            if (act.class.year) uniqueYears.add(act.class.year);
            if (act.class.class_number) uniqueClasses.add(act.class.class_number);
        }
    });

    // Helper ในการเติม Option
    const fill = (select, set, prefix = '') => {
        select.innerHTML = `<option value="">${select.options[0].text}</option>`; // Keep first option text
        [...set].sort().forEach(val => {
            select.innerHTML += `<option value="${val}">${prefix}${val}</option>`;
        });
    };

    fill(levelSelect, uniqueLevels);
    fill(departmentSelect, uniqueMajors);
    fill(studentYearSelect, [...uniqueYears].sort((a,b)=>a-b), 'ปี ');
    fill(classNumberSelect, [...uniqueClasses].sort((a,b)=>a-b), 'ห้อง ');
}

// ==========================================================
// === 3. RENDER CARDS ===
// ==========================================================

function RenderActivityCards(activities) {
    const container = document.getElementById('activityCardContainer');
    container.innerHTML = '';

    if (activities.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%; color:#888;">ไม่พบกิจกรรม</p>';
        return;
    }

    // ใช้ map().join('') เพื่อประสิทธิภาพที่ดีกว่า
    container.innerHTML = activities.map(activity => {
        // จัดการวันที่และเวลา
        const startDate = new Date(activity.start_time);
        const endDate = new Date(activity.end_time);
        
        const dateStr = startDate.toLocaleDateString('th-TH', { 
            day: '2-digit', month: '2-digit', year: 'numeric' 
        });
        const timeStr = `${formatTime(startDate)} - ${formatTime(endDate)}`;

        // จัดการข้อมูล Class (Safe Access)
        const classInfo = activity.class || {};
        const majorInfo = classInfo.major || {};

        const deptName = majorInfo.name || 'ทุกสาขา';
        const level = majorInfo.level || 'ทุกระดับ';
        const year = classInfo.year ? `ปี ${classInfo.year}` : 'ทุกชั้นปี';
        const classNum = classInfo.class_number ? `ห้อง ${classInfo.class_number}` : 'ทุกห้อง';
        
        const recurringText = activity.is_recurring ? 'มีกิจกรรมซ้ำ' : 'ครั้งเดียว';

        return `
            <div class="activity-card" 
                 data-id="${activity.id}"
                 data-name="${activity.name}"
                 onclick="goToCheckActivity('${activity.id}', event)">
                
                <div class="card-title">${activity.name}</div>
                <div class="card-body">
                    <div class="card-detail"><i class="far fa-calendar-alt"></i> วันที่ ${dateStr}</div>
                    <div class="card-detail"><i class="far fa-clock"></i> เวลา ${timeStr} น.</div>
                    <hr>
                    <div class="card-detail"><strong>สาขา:</strong> ${deptName}</div>
                    <div class="card-detail"><strong>ระดับ:</strong> ${level}</div>
                    <div class="card-detail"><strong>ชั้นเรียน:</strong> ${year} ${classNum}</div>
                    
                    <div class="card-footer">
                        <span>${recurringText}</span>
                        <div class="card-actions">
                            <i class="fas fa-edit edit-btn" onclick="goToEdit('${activity.id}', event)" title="แก้ไข"></i>
                            <i class="fas fa-trash-alt delete-btn" onclick="confirmDelete('${activity.id}', '${activity.name}', event)" title="ลบ"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Helper Functions
function formatTime(date) {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Navigation Functions (ใส่ onclick ใน HTML เพื่อลด Event Listener ที่ซับซ้อน)
window.goToCheckActivity = (id, event) => {
    if (event.target.closest('.card-actions')) return; // ถ้ากดปุ่ม action ไม่ต้องไป
    window.location.href = `Check_activities.html?activityId=${id}`;
};

window.goToEdit = (id, event) => {
    event.stopPropagation();
    window.location.href = `Edit_activity.html?activityId=${id}`;
};

window.confirmDelete = (id, name, event) => {
    event.stopPropagation();
    activityIdToDelete = id;
    showConfirmModal(name);
};

// ==========================================================
// === 4. FILTER LOGIC ===
// ==========================================================

function filterActivities() {
    const keyword = activityNameInput.value.toLowerCase().trim();
    const filters = {
        level: levelSelect.value,
        dept: departmentSelect.value,
        year: studentYearSelect.value,
        room: classNumberSelect.value
    };

    const filtered = cachedActivities.filter(act => {
        const c = act.class || {};
        const m = c.major || {};

        // Search Name
        if (keyword && !act.name.toLowerCase().includes(keyword)) return false;

        // Dropdowns
        if (filters.level && m.level !== filters.level) return false;
        if (filters.dept && m.name !== filters.dept) return false;
        if (filters.year && String(c.year) !== filters.year) return false;
        if (filters.room && String(c.class_number) !== filters.room) return false;

        return true;
    });

    RenderActivityCards(filtered);
}

// ==========================================================
// === 5. DELETE & MODAL ===
// ==========================================================

let confirmDialog;

function setupModalElements() {
    confirmDialog = document.getElementById('confirmDialog');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    const closeModalBtn = confirmDialog?.querySelector('.close-btn');

    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDelete);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideConfirmModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', hideConfirmModal);
}

function showConfirmModal(name) {
    const nameSpan = document.getElementById('activityToDeleteName');
    if (nameSpan) nameSpan.textContent = name;
    if (confirmDialog) confirmDialog.style.display = 'flex';
}

function hideConfirmModal() {
    if (confirmDialog) confirmDialog.style.display = 'none';
    activityIdToDelete = null;
}
async function handleDelete(event) { // รับค่า event เข้ามา
    if(event) event.preventDefault(); // ป้องกันการ Refresh หน้าจอโดยไม่ตั้งใจ
    
    if (!activityIdToDelete) return;
    
    // UI Feedback
    const btn = document.getElementById('confirmDelete');
    const originalText = btn.textContent;
    btn.textContent = 'กำลังลบ...';
    btn.disabled = true;

    try {
        // ใช้ ./ นำหน้าเพื่อให้มั่นใจว่าเป็น Relative Path ที่ถูกต้อง
        const res = await fetch('./PHP/api_activity_actions.php', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: activityIdToDelete })
        });

        const result = await res.json();

        if (result.status === 'success') {
            alert('ลบกิจกรรมเรียบร้อยแล้ว');
            await fetchActivities(); // โหลดข้อมูลใหม่
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        console.error('Delete Error:', err);
        alert('ไม่สามารถลบกิจกรรมได้: ' + err.message);
    } finally {
        hideConfirmModal();
        btn.textContent = originalText;
        btn.disabled = false;
    }
}