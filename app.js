// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';

// สร้าง Supabase Client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ตัวแปรสำหรับเก็บ ID ของกิจกรรมที่กำลังจะถูกลบ
let activityIdToDelete = null;

// =========================================================
// ********** ฟังก์ชันสำหรับหน้าสร้างกิจกรรม (create_activity.html) **********
// =========================================================

async function handleCreateActivity(event) {
    event.preventDefault();

    const form = event.target;
    
    // 1. ดึงค่าจากฟอร์ม
    const activityName = form.activityName.value;
    const activityDate = form.activityDate.value;
    const startTime = form.startTime.value;
    const endTime = form.endTime.value;
    const departmentId = form.department.value;
    const recurringDays = parseInt(form.recurringDays.value, 10);
    
    if (!activityName || !activityDate || !startTime || !endTime || !departmentId) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
    }

    try {
        // 3. แปลงวันที่และเวลา
        const [day, month, thaiYear] = activityDate.split('/').map(Number);
        const gregorianYear = thaiYear - 543;
        
        const startDate = new Date(gregorianYear, month - 1, day, parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]));
        const endDate = new Date(gregorianYear, month - 1, day, parseInt(endTime.split(':')[0]), parseInt(endTime.split(':')[1]));
        
        if (startDate >= endDate) {
             alert('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
             return;
        }

        const activityData = {
            name: activityName,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            for_student: true, 
            for_leader: true,
            for_teacher: false,
            is_recurring: recurringDays > 0,
            created_by: 1, // สมมติ Admin
            department_id: parseInt(departmentId, 10)
        };
        
        // 5. Insert ข้อมูลลงใน Supabase
        const { error } = await supabase
            .from('activity')
            .insert([activityData]);

        if (error) {
            console.error('Supabase Insert Error:', error.message);
            alert(`สร้างกิจกรรมไม่สำเร็จ: ${error.message}`);
        } else {
            alert(`สร้างกิจกรรม "${activityName}" สำเร็จแล้ว!`);
            form.reset();
            // window.location.href = 'edit_delete_activity.html'; // นำทางไปหน้ารายการ
        }

    } catch (e) {
        console.error('Data Processing Error:', e);
        alert('เกิดข้อผิดพลาดในการประมวลผลวันที่/เวลา');
    }
}


// =========================================================
// ********** ฟังก์ชันสำหรับหน้าแก้ไข/ลบกิจกรรม (edit_delete_activity.html) **********
// =========================================================

/**
 * ฟังก์ชันดึงรายการแผนกเพื่อ populate dropdown filter (Department)
 */
async function fetchDepartmentsForFilter() {
    const filter = document.getElementById('departmentFilter');
    if (!filter) return; // ออกหากไม่ใช่หน้าที่มี filter

    const { data, error } = await supabase
        .from('department')
        .select('id, name')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching departments:', error.message);
        return;
    }

    // ล้างและเพิ่ม Option แผนก
    data.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        filter.appendChild(option);
    });
}

/**
 * ฟังก์ชันดึงข้อมูลกิจกรรมและแสดงผลใน Activity Card
 */
async function fetchAndRenderActivities() {
    const container = document.getElementById('activityCardContainer');
    if (!container) return; // ออกหากไม่ใช่หน้าแสดง Card

    container.innerHTML = '<p>กำลังโหลดกิจกรรม...</p>';

    const { data: activities, error } = await supabase
        .from('activity')
        .select(`
            id,
            name,
            start_time,
            end_time,
            is_recurring,
            department:department_id (name, level)
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

    container.innerHTML = ''; // ล้างสถานะโหลด

    activities.forEach(activity => {
        const startTime = new Date(activity.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        const endTime = new Date(activity.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        const date = new Date(activity.start_time).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        const departmentName = activity.department?.name || 'ไม่ระบุแผนก';
        const departmentLevel = activity.department?.level || 'ไม่ระบุระดับ';
        const recurringDays = activity.is_recurring ? 'N' : '0';

        const cardHTML = `
            <div class="activity-card" data-id="${activity.id}" data-name="${activity.name}" data-dept-id="${activity.department?.id}">
                <div class="card-title">กิจกรรม ${activity.name}</div>
                <div class="card-detail">วัน <span>${date}</span> เวลา <span>${startTime} - ${endTime}</span></div>
                <div class="card-detail">แผนก <span>${departmentName}</span> ระดับ <span>${departmentLevel}</span></div>
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
 * จัดการ Modal และ Event Listener สำหรับการลบ
 */
function attachCardEventListeners() {
    // ต้องแน่ใจว่าองค์ประกอบ Modal มีอยู่ใน DOM
    const confirmDialog = document.getElementById('confirmDialog');
    const activityNameSpan = document.getElementById('activityToDeleteName');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const closeModalBtn = confirmDialog ? document.querySelector('.modal-header .close-btn') : null;

    const showConfirmModal = (name) => {
        activityNameSpan.textContent = name;
        confirmDialog.style.display = 'flex';
    };

    const hideConfirmModal = () => {
        confirmDialog.style.display = 'none';
        activityIdToDelete = null;
    };

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const card = event.target.closest('.activity-card');
            activityIdToDelete = card.dataset.id;
            const activityName = card.dataset.name;
            showConfirmModal(activityName);
        });
    });
    
    // Event Listener สำหรับปุ่มยืนยันการลบ
    if (confirmDialog) {
        cancelDeleteBtn.addEventListener('click', hideConfirmModal);
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', hideConfirmModal);
        }
        
        confirmDeleteBtn.addEventListener('click', async () => {
            if (activityIdToDelete) {
                const { error } = await supabase
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
}


// =========================================================
// ********** DOM Content Loaded (เรียกใช้ฟังก์ชันตามหน้า) **********
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // หน้าสร้างกิจกรรม (create_activity.html)
    if (path.includes('create_activity.html')) {
        const form = document.getElementById('createActivityForm');
        if (form) {
            form.addEventListener('submit', handleCreateActivity);
        }
    }

    // หน้าแก้ไข / ลบกิจกรรม (edit_delete_activity.html)
    if (path.includes('edit_delete_activity.html')) {
        fetchDepartmentsForFilter();
        fetchAndRenderActivities();
    }
    
    // หน้าสรุปผล (summary.html) - ต้องเพิ่มฟังก์ชันดึงข้อมูลในภายหลัง
    // if (path.includes('summary.html')) { ... }
});