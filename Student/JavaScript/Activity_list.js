// ไฟล์: JavaScript/Activity_list.js

const CONFIG = {
    // ใช้ PHP ตัวเดิมที่คุ้นเคย
    API_URL: 'PHP/api_activity_list.php', 
    API_MASTER: 'PHP/Create_activities.php', 
    API_ACTION: 'PHP/api_activity_actions.php' 
};

let allMajors = [];
let activityToDeleteId = null;

// ==========================================
// 1. INIT
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    // 1.1 โหลดตัวเลือก (Dropdown) - โหลดไว้เฉยๆ เผื่อเป็นอาจารย์ใช้
    await fetchMasterData();
    
    // 1.2 ผูก Event ให้ตัวกรอง
    setupFilterEvents();
    
    // 1.3 โหลดรายการกิจกรรม
    fetchActivities();
});

// ==========================================
// 2. DROPDOWN LOGIC (เหมือนเดิม)
// ==========================================
async function fetchMasterData() {
    try {
        const res = await fetch(`${CONFIG.API_MASTER}?action=get_majors`);
        if (!res.ok) return; // เงียบไว้ถ้าโหลดไม่ได้
        const result = await res.json();
        if (result.status === 'success') {
            allMajors = result.data;
            populateLevelDropdown();
        }
    } catch (err) {
        console.error("Error fetching majors:", err);
    }
}

function populateLevelDropdown() {
    const levelSelect = document.getElementById('level');
    if(!levelSelect) return;
    const levels = [...new Set(allMajors.map(m => m.level))].sort();
    levelSelect.innerHTML = '<option value="">ทุกระดับ</option>';
    levels.forEach(lvl => levelSelect.innerHTML += `<option value="${lvl}">${lvl}</option>`);
    levelSelect.disabled = false;
}

function handleLevelChange() {
    const selectedLevel = document.getElementById('level').value;
    const deptSelect = document.getElementById('department');
    deptSelect.innerHTML = '<option value="">ทุกสาขาวิชา</option>';
    
    if (selectedLevel) {
        const filteredMajors = allMajors.filter(m => m.level === selectedLevel);
        filteredMajors.forEach(m => deptSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`);
        deptSelect.disabled = false;
    } else {
        deptSelect.disabled = true;
    }
    resetClassDropdowns();
    fetchActivities(); 
}

function resetClassDropdowns() {
    document.getElementById('studentYear').innerHTML = '<option value="">ทุกชั้นปี</option>';
    document.getElementById('classNumber').innerHTML = '<option value="">ทุกห้อง</option>';
    document.getElementById('studentYear').disabled = true;
    document.getElementById('classNumber').disabled = true;
}

async function fetchClassesForDropdown() {
    const level = document.getElementById('level').value;
    const majorId = document.getElementById('department').value;
    if (!level || !majorId) { fetchActivities(); return; }

    try {
        const params = new URLSearchParams({ action: 'get_classes', level, majorId });
        const res = await fetch(`${CONFIG.API_MASTER}?${params}`);
        const result = await res.json();
        if (result.status === 'success') populateYearAndRoom(result.data);
    } catch (err) { console.error(err); }
    fetchActivities();
}

function populateYearAndRoom(classes) {
    const yearSelect = document.getElementById('studentYear');
    const roomSelect = document.getElementById('classNumber');
    
    const years = [...new Set(classes.map(c => c.year))].sort((a,b) => a-b);
    const rooms = [...new Set(classes.map(c => c.class_number))].sort((a,b) => a-b);

    yearSelect.innerHTML = '<option value="">ทุกชั้นปี</option>';
    years.forEach(y => yearSelect.innerHTML += `<option value="${y}">ปี ${y}</option>`);
    roomSelect.innerHTML = '<option value="">ทุกห้อง</option>';
    rooms.forEach(r => roomSelect.innerHTML += `<option value="${r}">ห้อง ${r}</option>`);
    yearSelect.disabled = false;
    roomSelect.disabled = false;
}

function setupFilterEvents() {
    document.getElementById('level')?.addEventListener('change', handleLevelChange);
    document.getElementById('department')?.addEventListener('change', fetchClassesForDropdown);
    document.getElementById('studentYear')?.addEventListener('change', fetchActivities);
    document.getElementById('classNumber')?.addEventListener('change', fetchActivities);
    
    let timeout;
    document.getElementById('activityNameInput')?.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchActivities(), 500);
    });
}

// ==========================================
// 3. FETCH ACTIVITIES (หัวใจหลัก)
// ==========================================
async function fetchActivities() {
    const container = document.getElementById('activityCardContainer');
    container.innerHTML = '<p style="width:100%; text-align:center; color:#666;">กำลังโหลดข้อมูล...</p>';

    // ดึงรหัสนักเรียนจาก Session
    const studentId = sessionStorage.getItem('ref_id');

    // เตรียมค่าส่งไป PHP
    const params = new URLSearchParams({
        search: document.getElementById('activityNameInput')?.value || '',
        level: document.getElementById('level')?.value || '',
        major_id: document.getElementById('department')?.value || '',
        class_year: document.getElementById('studentYear')?.value || '',
        class_room: document.getElementById('classNumber')?.value || ''
    });

    // ถ้ามี student_id ให้แนบไปด้วย (PHP จะใช้ตัวนี้กรองเป็นหลัก)
    if (studentId) {
        params.append('student_id', studentId);
        
        // (Optional) ถ้าเป็นนักเรียน อาจจะปิด Dropdown อื่นๆ เพื่อไม่ให้งง
        // disableFiltersForStudent(); 
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}?${params}`);
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const result = await response.json();

        if (result.status === 'success') {
            renderActivities(result.data);
        } else {
            container.innerHTML = `<p style="color:red; text-align:center;">เกิดข้อผิดพลาด: ${result.message}</p>`;
        }
    } catch (error) {
        console.error("Error loading activities:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้</p>`;
    }
}

function renderActivities(activities) {
    const container = document.getElementById('activityCardContainer');
    container.innerHTML = '';

    if (activities.length === 0) {
        container.innerHTML = '<p style="width:100%; text-align:center; padding:20px; color:#999;">ไม่พบกิจกรรม</p>';
        return;
    }

    activities.forEach(act => {
        const card = document.createElement('div');
        card.className = 'activity-card';
        
        // แปลงวันที่และเวลา
        const dateObj = new Date(act.start_time);
        const dateStr = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        
        // แสดงข้อมูลห้องเรียน
        let classInfo = '<span style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:4px; font-size:12px;">กิจกรรมส่วนกลาง</span>';
        if (act.class_id) {
            classInfo = `${act.major_level || ''} ${act.major_name || ''} ปี ${act.year || ''} ห้อง ${act.class_number || ''}`;
        }

        const typeLabel = act.activity_type === 'flag_ceremony' ? 'หน้าเสาธง' : 'กิจกรรมทั่วไป';

        // เช็คสิทธิ์ (ถ้านักเรียนดู ไม่ให้มีปุ่มลบ/แก้ไข)
        // (ใช้การเช็คแบบง่ายๆ ว่าถ้ามี student_id ใน session ให้ซ่อนปุ่ม)
        const isStudent = sessionStorage.getItem('ref_id'); 
        let actionButtons = '';
        
        if (!isStudent) { // ถ้าเป็นอาจารย์/แอดมิน ให้โชว์ปุ่ม
             actionButtons = `
                <div class="card-actions">
                    <i class="fas fa-pen" onclick="editActivity('${act.id}', event)" title="แก้ไข"></i>
                    <i class="fas fa-trash-alt" onclick="confirmDelete('${act.id}', '${act.name}', event)" title="ลบ"></i>
                </div>`;
        }

        card.innerHTML = `
            <div style="flex-grow: 1;" onclick="viewActivity('${act.id}')">
                <h3 style="margin: 0 0 10px 0; font-size: 1.2rem;">${act.name}</h3>
                <p style="margin: 5px 0; font-size: 0.9rem; opacity: 0.9;">
                    <i class="far fa-calendar-alt"></i> ${dateStr}
                </p>
                <p style="margin: 5px 0; font-size: 0.9rem; opacity: 0.9;">
                    <i class="far fa-clock"></i> ${timeStr}
                </p>
                <p style="margin: 5px 0; font-size: 0.9rem;">
                    <i class="fas fa-tag"></i> ${typeLabel}
                </p>
                <div style="margin-top: 10px; font-size: 0.85rem; opacity: 0.8;">
                    <i class="fas fa-users"></i> ${classInfo}
                </div>
            </div>
            ${actionButtons}
        `;
        container.appendChild(card);
    });
}

// ... (ฟังก์ชัน viewActivity, editActivity, confirmDelete, cancelDelete เหมือนเดิม) ...
window.viewActivity = function(id) {
    window.location.href = `Check_activities.html?activityId=${id}`;
};

window.editActivity = function(id, event) {
    event.stopPropagation();
    window.location.href = `Edit_activity.html?activityId=${id}`;
};

window.confirmDelete = function(id, name, event) {
    event.stopPropagation();
    activityToDeleteId = id;
    document.getElementById('activityToDeleteName').textContent = name;
    document.getElementById('confirmDialog').style.display = 'flex';
};

document.getElementById('cancelDelete').addEventListener('click', () => {
    document.getElementById('confirmDialog').style.display = 'none';
    activityToDeleteId = null;
});

document.getElementById('confirmDelete').addEventListener('click', async () => {
    if (!activityToDeleteId) return;
    try {
        const res = await fetch(CONFIG.API_ACTION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: activityToDeleteId })
        });
        const result = await res.json();
        if (result.status === 'success') {
            document.getElementById('confirmDialog').style.display = 'none';
            fetchActivities();
        } else {
            alert('เกิดข้อผิดพลาด: ' + result.message);
        }
    } catch (err) {
        alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
});