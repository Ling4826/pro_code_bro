/* ====== CONFIG ====== */
let termScoreRows = [];

// === MAIN FETCH FUNCTION ===
async function fetchTermScore() {
    const tbody = document.getElementById("score-body");
    tbody.innerHTML = `
        <tr><td colspan="8" style="padding: 20px; color: #666; text-align:center;">กำลังดึงข้อมูล...</td></tr>
    `;

    // 1. ดึง Ref ID (รหัสนักเรียน) ของคนที่ล็อกอินอยู่
    const refId = sessionStorage.getItem('ref_id');
    if (!refId) {
        alert("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        window.location.href = '../index.html';
        return;
    }

    try {
        // ✅ แก้ไข Path: ใช้ ../PHP/ เพื่อถอยออกจากโฟลเดอร์ Student ไปหาโฟลเดอร์ PHP
        // ✅ ส่ง param: ?student_id=... เพื่อบอก PHP ว่าขอข้อมูลของใคร
        const response = await fetch(`../PHP/api_get_term_score.php?student_id=${refId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status} - หาไฟล์ไม่เจอ หรือ Server มีปัญหา`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        if (data.length === 0) {
             tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">ไม่พบข้อมูลผลการประเมิน</td></tr>`;
             return;
        }

        // 2. แปลงข้อมูลให้อยู่ในรูปแบบที่ตารางต้องการ
        termScoreRows = data.map(item => ({
            id: item.id,
            studentCode: item.student.id,
            studentName: item.student.name,
            academicYear: item.academic_year,
            semester: item.semester,
            major: item.student.class.major.name,
            
            // ข้อมูลเปอร์เซ็นต์
            percentFlag: parseFloat(item.flag_percent || 0),
            percentActivity: parseFloat(item.activity_percent || 0),
            result: item.result,

            // ข้อมูลสำหรับ Popup (Modal)
            deptTotal: item.student.counts?.dept_total || 0,
            deptAttended: item.student.counts?.dept_attended || 0
        }));

        // 3. แสดงผลลงตาราง
        renderTable(termScoreRows);
        
        // (สำหรับนักเรียน ไม่จำเป็นต้องสร้างตัวกรอง Level/Class ซับซ้อนเหมือนอาจารย์)

    } catch (err) {
        console.error('Fetch error:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="color: red; text-align:center;">
                    เกิดข้อผิดพลาด: ${err.message}<br>
                    <small>ลองตรวจสอบว่ามีไฟล์ api_get_term_score.php ในโฟลเดอร์ PHP หรือยัง</small>
                </td>
            </tr>
        `;
    }
}

// === RENDER TABLE ===
function renderTable(rows) {
    const tbody = document.getElementById("score-body");
    tbody.innerHTML = "";

    rows.forEach(row => {
        const tr = document.createElement("tr");

        // กำหนดสีของสถานะ (ผ่าน/ไม่ผ่าน)
        let statusClass = "status-pending";
        let statusText = row.result || "รอประเมิน";
        
        if (row.result === 'Pass' || row.result === 'ผ่าน') {
            statusClass = "status-pass";
            statusText = "ผ่าน";
        } else if (row.result === 'Fail' || row.result === 'ไม่ผ่าน') {
            statusClass = "status-fail";
            statusText = "ไม่ผ่านกิจกรรม";
        }

        tr.innerHTML = `
            <td>${row.academicYear}</td>
            <td>${row.semester}</td>
            <td>${row.studentCode}</td>
            <td style="text-align:left;">${row.studentName}</td>
            <td>${row.percentFlag}%</td>
            <td>${row.percentActivity}%</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn-view" onclick="openStudentModal('${row.id}')">
                    <i class="fas fa-search"></i> ดูรายละเอียด
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// === MODAL LOGIC ===
function openStudentModal(rowId) {
    const row = termScoreRows.find(r => r.id == rowId);
    if (!row) return;

    // --- การ์ดซ้าย: เข้าแถว ---
    document.getElementById('flagPercent').textContent = `${row.percentFlag}%`;
    const flagIcon = document.getElementById('flagIcon');
    const flagCard = document.getElementById('flagCard');
    
    if (row.percentFlag >= 80) {
        flagIcon.className = "fas fa-check";
        flagCard.className = "card-detail card-blue";
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
    if (event.target === modal) {
        closeStudentModal();
    }
}

// เริ่มทำงานเมื่อโหลดหน้าเสร็จ
document.addEventListener("DOMContentLoaded", () => {
    fetchTermScore();
});