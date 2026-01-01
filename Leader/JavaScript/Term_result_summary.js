/* ====== CONFIG ====== */
const CONFIG = {
    // ⚠️ ตรวจสอบ Path ตรงนี้:
    // ถ้าไฟล์ HTML อยู่ในโฟลเดอร์เดียวกับ Activity_list ให้ใช้ 'PHP/...'
    // ถ้าไฟล์ HTML อยู่ในโฟลเดอร์ย่อย (เช่น pages/) ให้ใช้ '../PHP/...'
    API_SUMMARY: 'PHP/api_get_term_summary.php',
    API_MASTER: 'PHP/Create_activities.php' 
};

let termScoreRows = [];

// ==========================================
// 1. INIT
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    // 1.1 โหลดตัวเลือก (Dropdown) ไว้โชว์ข้อมูล
    await fetchMasterData();
    
    // 1.2 ผูก Event ให้ Dropdown
    setupEventListeners();

    // 1.3 โหลดข้อมูลตาราง (สำคัญ)
    fetchTermScore(); 
});

// ==========================================
// 2. FETCH DROPDOWN DATA
// ==========================================
async function fetchMasterData() {
    try {
        const res = await fetch(`${CONFIG.API_MASTER}?action=get_majors`);
        if(!res.ok) return; // เงียบไว้ถ้าโหลดไม่ได้ (อาจจะเป็นนักเรียน)
        
        const result = await res.json();
        if (result.status === 'success') {
            allMajors = result.data;
            populateLevelDropdown();
        }
    } catch (err) {
        console.error("Error fetching majors:", err);
    }
}

// ... (ฟังก์ชัน populateLevelDropdown, handleLevelChange, resetClassDropdowns, fetchClassesForDropdown, populateYearAndRoom, setupEventListeners เหมือนเดิม ไม่ต้องแก้) ...
// เพื่อประหยัดพื้นที่ ผมขอข้ามส่วน Dropdown Logic เดิมไปนะครับ (ใช้ของเดิมได้เลย)
// ถ้าต้องการฉบับเต็มบอกได้ครับ

// ฟังก์ชันเติมตัวเลือก Level (ใส่ไว้กัน Error)
function populateLevelDropdown() {
    const levelSelect = document.getElementById('level');
    if(!levelSelect) return;
    const levels = [...new Set(allMajors.map(m => m.level))].sort();
    levelSelect.innerHTML = '<option value="">ทุกระดับ</option>';
    levels.forEach(lvl => levelSelect.innerHTML += `<option value="${lvl}">${lvl}</option>`);
    levelSelect.disabled = false;
}
function handleLevelChange() { /* ...ใช้โค้ดเดิม... */ }
function resetClassDropdowns() { /* ...ใช้โค้ดเดิม... */ }
function fetchClassesForDropdown() { /* ...ใช้โค้ดเดิม... */ }
function populateYearAndRoom(classes) { /* ...ใช้โค้ดเดิม... */ }
function setupEventListeners() {
    document.getElementById('level')?.addEventListener('change', handleLevelChange);
    document.getElementById('department')?.addEventListener('change', fetchClassesForDropdown);
    document.getElementById('studentYear')?.addEventListener('change', fetchTermScore);
    document.getElementById('classNumber')?.addEventListener('change', fetchTermScore);
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        setTimeout(() => fetchTermScore(), 500);
    });
}


// ==========================================
// 3. FETCH TABLE DATA (ส่วนสำคัญ)
// ==========================================
async function fetchTermScore() {
    const tbody = document.getElementById("score-body");
    tbody.innerHTML = `<tr><td colspan="8" style="padding: 20px; text-align: center; color: #666;">กำลังโหลดข้อมูล...</td></tr>`;

    // 1. ดึง Ref ID (รหัสนักเรียน)
    const refId = sessionStorage.getItem('ref_id');

    // 2. เตรียม Parameter
    const params = new URLSearchParams({
        level: document.getElementById('level')?.value || '',
        major_id: document.getElementById('department')?.value || '',
        class_year: document.getElementById('studentYear')?.value || '',
        class_room: document.getElementById('classNumber')?.value || '',
        search: document.getElementById('searchInput')?.value || ''
    });

    // 3. ถ้าเป็นนักเรียน (มี ref_id) ให้ส่งไป PHP ด้วย
    if (refId) {
        params.append('student_id', refId);
        // PHP จะเช็ค student_id แล้วไปหาเพื่อนในห้องเดียวกันมาให้
    }

    try {
        const response = await fetch(`${CONFIG.API_SUMMARY}?${params}`);
        
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        
        const data = await response.json();
        
        if (data.status === 'error') throw new Error(data.message);
        
        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: #999;">ไม่พบข้อมูล</td></tr>`;
            return;
        }

        termScoreRows = data; 
        renderTable(data);

    } catch (error) {
        console.error("Fetch Error:", error);
        // เช็คกรณี Path ผิด
        const errorMsg = error.message.includes('404') 
            ? 'หาไฟล์ PHP ไม่เจอ (ตรวจสอบ Path ใน CONFIG)' 
            : error.message;
            
        tbody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">เกิดข้อผิดพลาด: ${errorMsg}</td></tr>`;
    }
}

// ฟังก์ชันวาดตาราง
function renderTable(data) {
    const tbody = document.getElementById("score-body");
    tbody.innerHTML = data.map(row => {
        const flagTotal = parseInt(row.flag_total || 0);
        const flagAttended = parseInt(row.flag_attended || 0);
        const deptTotal = parseInt(row.dept_total || 0);
        const deptAttended = parseInt(row.dept_attended || 0);

        const percentFlag = flagTotal > 0 ? (flagAttended / flagTotal) * 100 : 0;
        const percentActivity = deptTotal > 0 ? (deptAttended / deptTotal) * 100 : 0;
        const isPassed = (percentFlag >= 80) && (percentActivity >= 80);

        const passBadge = isPassed
            ? '<span class="status-badge status-pass">ผ่าน</span>'
            : '<span class="status-badge status-fail">ไม่ผ่าน</span>';

        // ไฮไลท์แถวของตัวเอง (ถ้า id ตรงกับ session)
        const myId = sessionStorage.getItem('ref_id');
        const isMe = (row.student_id == myId);
        const rowStyle = isMe ? 'background-color: #e3f2fd; font-weight:bold;' : '';

        return `
        <tr style="cursor: pointer; ${rowStyle}" onclick="openStudentModal('${row.student_id}')">
            <td>${row.student_id} ${isMe ? '(ฉัน)' : ''}</td>
            <td style="text-align: left;">${row.student_name}</td>
            <td style="text-align: left;">${row.major_name || '-'}</td>
            <td>${row.class_year || '-'}</td>
            <td>${row.class_number || '-'}</td>
            
            <td style="text-align:center;">
                <div>${flagAttended}/${flagTotal}</div>
                <div style="font-size:0.85em; color:#666;">(${percentFlag.toFixed(0)}%)</div>
            </td>     
            
            <td style="text-align:center;">
                <div>${deptAttended}/${deptTotal}</div>
                <div style="font-size:0.85em; color:#666;">(${percentActivity.toFixed(0)}%)</div>
            </td> 

            <td>${passBadge}</td>
        </tr>
        `;
    }).join("");
}

// ==========================================
// 4. MODAL POPUP (เหมือนเดิม)
// ==========================================
window.openStudentModal = function(studentId) {
    const row = termScoreRows.find(r => r.student_id == studentId);
    if (!row) return;

    const flagTotal = parseInt(row.flag_total || 0);
    const flagAttended = parseInt(row.flag_attended || 0);
    const deptTotal = parseInt(row.dept_total || 0);
    const deptAttended = parseInt(row.dept_attended || 0);
    
    const pFlag = flagTotal > 0 ? ((flagAttended/flagTotal)*100).toFixed(2) : "0.00";
    const pDept = deptTotal > 0 ? ((deptAttended/deptTotal)*100).toFixed(2) : "0.00";

    document.getElementById('modalStudentName').textContent = row.student_name;

    document.getElementById('flagTotal').textContent = `${flagTotal} ครั้ง`;
    document.getElementById('flagAttended').textContent = `${flagAttended} ครั้ง`;
    document.getElementById('flagPercent').textContent = `${pFlag}%`;
    updateCardStyle('flag', parseFloat(pFlag));

    document.getElementById('deptTotal').textContent = `${deptTotal} ครั้ง`;
    document.getElementById('deptAttended').textContent = `${deptAttended} ครั้ง`;
    document.getElementById('deptPercent').textContent = `${pDept}%`;
    updateCardStyle('dept', parseFloat(pDept));

    document.getElementById('studentModal').style.display = 'flex';
}

function updateCardStyle(prefix, percent) {
    const icon = document.getElementById(prefix + 'Icon');
    const card = document.getElementById(prefix + 'Card');
    
    if (percent >= 80) {
        icon.className = "fas fa-check";
        card.className = "card-detail card-blue";
    } else {
        icon.className = "fas fa-times";
        card.className = "card-detail card-red";
    }
}

window.closeStudentModal = function() {
    document.getElementById('studentModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('studentModal');
    if (event.target == modal) closeStudentModal();
}