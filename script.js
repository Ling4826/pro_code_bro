// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ตัวแปรสำหรับเก็บ ID ของกิจกรรมที่กำลังจะถูกลบ
let activityIdToDelete = null;

/**
 * ฟังก์ชันดึงรายการสาขาเพื่อ populate dropdown filter
 */
async function fetchDepartments() {
    const filter = document.getElementById('departmentFilter');
    const { data, error } = await supabaseClient
        .from('major')
        .select('id, name')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching departments:', error.message);
        return;
    }

    data.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        filter.appendChild(option);
    });
}

/**
 * 1. ฟังก์ชันดึงข้อมูลกิจกรรมและแสดงผลใน Activity Card
 */
async function fetchAndRenderActivities() {
    const container = document.getElementById('activityCardContainer');
    container.innerHTML = ''; // ล้างข้อมูลเดิม

    // ดึงข้อมูลจาก activity พร้อม Join สาขา
    const { data: activities, error } = await supabaseClient
        .from('activity')
        .select(`
            id,
            name,
            start_time,
            end_time,
            is_recurring,
            major:major_id (name, level)
        `)
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Error fetching activities:', error.message);
        container.innerHTML = '<p>ไม่สามารถดึงรายการกิจกรรมได้</p>';
        return;
    }

    if (activities.length === 0) {
         container.innerHTML = '<p>ไม่พบกิจกรรมที่ถูกบันทึกไว้</p>';
         return;
    }

    activities.forEach(activity => {
        const startTime = new Date(activity.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        const endTime = new Date(activity.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        const date = new Date(activity.start_time).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        // ข้อมูลสาขา
        const departmentName = activity.major?.name || 'ไม่ระบุสาขา';
        const departmentLevel = activity.major?.level || 'ไม่ระบุระดับ';
        const recurringDays = activity.is_recurring ? 'N' : '0';

        const cardHTML = `
            <div class="activity-card" data-id="${activity.id}" data-name="${activity.name}" data-dept-id="${activity.department?.id}">
                <div class="card-title">กิจกรรม ${activity.name}</div>
                <div class="card-detail">วัน <span>${date}</span> เวลา <span>${startTime} - ${endTime}</span></div>
                <div class="card-detail">สาขา <span>${departmentName}</span> ระดับ <span>${departmentLevel}</span></div>
                <div class="card-detail">จัดขึ้นทุกๆ <span>${recurringDays}</span> วัน</div>
                
                <div class="card-actions">
                    <i class="fas fa-pencil-alt edit-btn" title="แก้ไข"></i>
                    <i class="fas fa-trash-alt delete-btn" title="ลบ"></i>
                </div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });

    attachCardEventListeners();
}

/**
 * 2. ฟังก์ชันแนบ Event Listeners ให้กับปุ่มแก้ไขและลบ (โค้ดเดิม)
 */
function attachCardEventListeners() {
    // ... (โค้ดเดิมสำหรับจัดการปุ่ม Delete และ Edit) ...
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const card = event.target.closest('.activity-card');
            activityIdToDelete = card.dataset.id;
            const activityName = card.dataset.name;
            showConfirmModal(activityName);
        });
    });
    
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const card = event.target.closest('.activity-card');
            const activityId = card.dataset.id;
            alert(`กำลังนำทางไปแก้ไขกิจกรรม ID: ${activityId}`);
            window.location.href = `Edit.html?activityId=${activityId}`;
        });
    });
}

/**
 * 3. จัดการ Modal ยืนยันการลบ (โค้ดเดิม)
 */
const confirmDialog = document.getElementById('confirmDialog');
const activityNameSpan = document.getElementById('activityToDeleteName');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
// ต้องแน่ใจว่า modal-header มี class close-btn ใน HTML
const closeModalBtn = confirmDialog ? document.querySelector('.modal-header .close-btn') : null;

function showConfirmModal(name) {
    activityNameSpan.textContent = name;
    confirmDialog.style.display = 'flex';
}

function hideConfirmModal() {
    confirmDialog.style.display = 'none';
    activityIdToDelete = null;
}

if (confirmDialog) {
    cancelDeleteBtn.addEventListener('click', hideConfirmModal);
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideConfirmModal);
    }
    
    // Event Listener สำหรับยืนยันการลบ (โค้ดเดิม)
    confirmDeleteBtn.addEventListener('click', async () => {
        if (activityIdToDelete) {
            const { error } = await supabaseClient
                .from('activity')
                .delete()
                .eq('id', activityIdToDelete);

            if (error) {
                alert(`เกิดข้อผิดพลาดในการลบ: ${error.message}`);
            } else {
                alert('ลบกิจกรรมเรียบร้อยแล้ว!');
                fetchAndRenderActivities();
            }
        }
        hideConfirmModal();
    });
}


// โหลดข้อมูลเมื่อหน้าเว็บพร้อม
document.addEventListener('DOMContentLoaded', () => {
    // ดึงสาขามาใส่ filter และดึงกิจกรรมมาแสดง
    fetchDepartments();
    fetchAndRenderActivities();
});