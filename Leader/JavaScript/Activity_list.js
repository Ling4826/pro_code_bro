// Activity_list.js

// ❌ ไม่ต้องใช้ Supabase Config แล้ว
// const SUPABASE_URL = ... (ลบทิ้ง)
// const SUPABASE_ANON_KEY = ... (ลบทิ้ง)
// const supabaseClient = ... (ลบทิ้ง)

let cachedActivities = [];

// ==========================================================
// === 1. FETCH & RENDER ACTIVITY ===
// ==========================================================

async function fetchActivities() {
    const container = document.getElementById('activityCardContainer');
    container.innerHTML = '<div style="text-align:center; padding:20px;">กำลังโหลดกิจกรรม...</div>';
    
    // ดึง Ref ID (รหัสนักเรียน/อาจารย์) จาก Session
    const refId = sessionStorage.getItem('ref_id');
    
    try {
        // ✅ เปลี่ยนมาใช้ fetch ไปที่ไฟล์ PHP แทน
        // ส่ง student_id ไปด้วย เพื่อให้ PHP รู้ว่าใครล็อกอิน (เผื่ออนาคตใช้กรอง)
        const response = await fetch(`PHP/api_get_activities.php?student_id=${refId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const activities = await response.json();

        // ตรวจสอบว่า PHP ส่ง error กลับมาไหม
        if (activities.status === 'error') {
            throw new Error(activities.message);
        }

        cachedActivities = activities;
        
        initFilters(); // เริ่มต้นตัวกรอง
        updateFilters(); // แสดงผล
        
    } catch (error) {
        console.error('Error fetching activities:', error);
        container.innerHTML = `<p style="text-align:center; color:red;">ไม่สามารถดึงรายการกิจกรรมได้<br>(${error.message})</p>`;
    }
}

function RenderActivityCards(activities, container) {
    container.innerHTML = '';

    if (activities.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%; color:#666;">ไม่พบรายการกิจกรรม</p>';
        return;
    }
    
    const DEFAULT_MAJOR = 'ทุกสาขา';
    const DEFAULT_LEVEL = 'ทุกระดับ';
    const DEFAULT_YEAR = 'ทุกปี';
    const DEFAULT_CLASS_NUM = 'ทุกห้อง';
    const ALL_CLASSES = 'ทุกชั้นเรียน'; 

    activities.forEach(activity => {
        // แปลงวันที่
        const date = new Date(activity.start_time).toLocaleDateString('th-TH', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        }).replace(/\//g, '/');
        
        // แปลงเวลา
        const startTime = new Date(activity.start_time).toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'Asia/Bangkok' 
        });
        
        const endTime = new Date(activity.end_time).toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'Asia/Bangkok' 
        });
        
        // ดึงข้อมูล Class และ Major (จาก JSON ที่ PHP จัด format มาให้)
        const classData = activity.class;
        const majorData = classData?.major;
        
        let classDetailText;
        if (classData && classData.id) {
            classDetailText = `ปี ${classData.year || DEFAULT_YEAR} ห้อง ${classData.class_number || DEFAULT_CLASS_NUM}`;
        } else {
            classDetailText = ALL_CLASSES;
        }

        const departmentName = majorData?.name || DEFAULT_MAJOR;
        const departmentLevel = majorData?.level || DEFAULT_LEVEL;
        
        // จำลองเลขเทอม (หรือจะดึงจาก DB ก็ได้ถ้ามี field นี้)
        const mockSemester = (activity.id % 2) + 1;
        const recurringDays = activity.is_recurring ? 'N' : '0';

        const cardHTML = `
            <div class="activity-card" 
                data-id="${activity.id}" 
                data-name="${activity.name}" 
                > 
                <div class="card-title">${activity.name}</div>
                
                <div class="card-detail">วันที่ ${date}</div>
                <div class="card-detail">เวลา ${startTime} น. - ${endTime} น.</div>
                
                <div class="card-detail">สาขา: ${departmentName}</div>
                <div class="card-detail">ระดับ: ${departmentLevel}</div>
                <div class="card-detail">ชั้นเรียน: ${classDetailText}</div> 
                <div class="card-detail">จัดขึ้นทุก ${recurringDays} วัน</div>
                <div class="card-detail">เทอม: ${mockSemester}</div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });

    attachCardEventListeners();
}

// ==========================================================
// === 2. CARD EVENT LISTENERS ===
// ==========================================================

function attachCardEventListeners() {
    document.querySelectorAll('.activity-card').forEach(card => {
        card.addEventListener('click', (event) => {
            if (event.target.classList.contains('fas')) {
                return;
            }
            // ไปหน้า Check_activities (เช็คชื่อ)
            const activityId = card.dataset.id;
            window.location.href = `Check_activities.html?activityId=${activityId}`;
        });
    });
}

// ==========================================================
// === 3. FILTER LOGIC (Logic เดิม ใช้ได้เลย) ===
// ==========================================================

let currentFilters = {
    level: '',
    major: '',
    year: '',
    classNumber: '',
    search: ''
};

function getFilteredActivities(activities) {
    let filtered = [...activities];
    const { level, major, year, classNumber, search } = currentFilters;

    if (level) {
        filtered = filtered.filter(a => a.class?.major?.level === level);
    }
    if (major) {
        filtered = filtered.filter(a => a.class?.major?.name === major);
    }
    if (year) {
        // แปลงเป็น String ก่อนเทียบ เพื่อความชัวร์
        filtered = filtered.filter(a => (a.class?.year + "") === year || a.class === null); 
    }
    if (classNumber) {
        filtered = filtered.filter(a => (a.class?.class_number + "") === classNumber || a.class === null);
    }
    if (search) {
        const searchTerm = search.toLowerCase();
        filtered = filtered.filter(a => 
            a.name.toLowerCase().includes(searchTerm) ||
            (a.class?.major?.name || "").toLowerCase().includes(searchTerm) ||
            (a.class?.major?.level || "").toLowerCase().includes(searchTerm)
        );
    }
    return filtered;
}

function initFilters() {
    const activities = cachedActivities;
    
    // ดึงค่าที่ไม่ซ้ำกัน
    const uniqueMajors = [...new Set(activities.map(a => a.class?.major?.name).filter(n => n))].sort();
    const uniqueLevels = [...new Set(activities.map(a => a.class?.major?.level).filter(n => n))].sort();
    const uniqueYears = [...new Set(activities.map(a => a.class?.year).filter(n => n))].sort((a, b) => a - b);
    const uniqueClasses = [...new Set(activities.map(a => a.class?.class_number).filter(n => n))].sort((a, b) => a - b);
    
    // เติมค่าลงใน Dropdown
    fillSelect('level', uniqueLevels, 'ทุกระดับ');
    fillSelect('department', uniqueMajors, 'ทุกสาขาวิชา');
    fillSelect('studentYear', uniqueYears, 'ทุกชั้นปี', 'ปี ');
    fillSelect('classNumber', uniqueClasses, 'ทุกห้อง', 'ห้อง ');
    
    // ตั้งค่า Event Listeners
    document.getElementById('level')?.addEventListener('change', updateFilters);
    document.getElementById('department')?.addEventListener('change', updateFilters);
    document.getElementById('studentYear')?.addEventListener('change', updateFilters);
    document.getElementById('classNumber')?.addEventListener('change', updateFilters);
    document.getElementById('activityNameInput')?.addEventListener('input', updateFilters);
}

function fillSelect(elementId, items, placeholder, prefix = "") {
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = prefix + item;
        select.appendChild(option);
    });
}

function updateFilters() {
    currentFilters.level = document.getElementById('level')?.value || '';
    currentFilters.major = document.getElementById('department')?.value || '';
    currentFilters.year = document.getElementById('studentYear')?.value || '';
    currentFilters.classNumber = document.getElementById('classNumber')?.value || '';
    currentFilters.search = document.getElementById('activityNameInput')?.value || '';
    
    const filtered = getFilteredActivities(cachedActivities);
    RenderActivityCards(filtered, document.getElementById('activityCardContainer'));
}

// ==========================================================
// === 4. INITIALIZATION ===
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    fetchActivities();
});