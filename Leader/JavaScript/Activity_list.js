// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ตัวแปรเก็บข้อมูล User
const userRole = sessionStorage.getItem('user_role')?.toLowerCase();
const userRefId = sessionStorage.getItem('ref_id');

let departmentSelect;
let levelSelect;
let studentYearSelect;
let classNumberSelect;
let activityNameInput;

let allMajors = [];
let allClasses = [];
let cachedActivities = [];
let studentMajorId = null; // เก็บ ID สาขาของนักเรียน

// ==========================================================
// === 1. LOADERS / POPULATORS ===
// ==========================================================

async function fetchUserContext() {
    // ถ้าเป็นนักเรียน ให้ไปดึงข้อมูล Class/Major มาก่อน เพื่อใช้กรองกิจกรรม
    if (userRole === 'student' && userRefId) {
        const { data, error } = await supabaseClient
            .from('student')
            .select(`
                class:class_id (
                    major_id
                )
            `)
            .eq('id', userRefId)
            .single();
            
        if (!error && data?.class?.major_id) {
            studentMajorId = data.class.major_id;
            console.log("Logged in as Student, Major ID:", studentMajorId);
        }
    }
}

async function populateFilters() {
    // โหลด Filter ปกติ
    const { data: majors } = await supabaseClient.from('major').select('id, name, level');
    allMajors = majors || [];

    const { data: classes } = await supabaseClient.from('class').select('major_id, year, class_number');
    allClasses = classes || [];

    const uniqueLevels = [...new Set(allMajors.map(m => m.level?.trim()).filter(Boolean))];
    levelSelect.innerHTML = '<option value="">เลือกระดับ</option>';
    uniqueLevels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        levelSelect.appendChild(option);
    });

    updateMajorFilter();
    updateYearFilter();
    updateClassNumberFilter();
}

// ... (ฟังก์ชัน updateYearFilter, updateMajorFilter, updateClassNumberFilter ใช้ของเดิมได้เลย) ...
// เพื่อประหยัดพื้นที่ ผมขอละไว้ในที่นี้ แต่ในไฟล์จริงต้องมีนะครับ

function updateYearFilter() {
    const selectedLevel = levelSelect.value;
    const previousYear = studentYearSelect.value;
    studentYearSelect.innerHTML = '<option value="">เลือกชั้นปี</option>';

    if (!selectedLevel || !allMajors.length || !allClasses.length) return;

    const majorIds = allMajors
        .filter(m => m.level.trim() === selectedLevel.trim())
        .map(m => m.id);

    const uniqueYears = [...new Set(
        allClasses
            .filter(c => majorIds.includes(c.major_id))
            .map(c => c.year)
    )].sort((a, b) => a - b);

    uniqueYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `ปี ${year}`;
        if (year.toString() === previousYear) {
            option.selected = true;
        }
        studentYearSelect.appendChild(option);
    });
}

function updateMajorFilter() {
    const selectedLevel = levelSelect.value;
    const previousMajor = departmentSelect.value;
    
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    if (!selectedLevel) return;

    const filteredMajors = allMajors.filter(m => 
        m.level && m.level.trim() === selectedLevel.trim()
    );
    if (filteredMajors.length === 0) return;

    const uniqueMajorNames = [...new Set(filteredMajors.map(m => m.name))];

    uniqueMajorNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (name === previousMajor) {
            option.selected = true;
        }
        departmentSelect.appendChild(option);
    });
}

function updateClassNumberFilter() {
    const selectedYear = studentYearSelect.value;
    const selectedMajorName = departmentSelect.value;
    const selectedLevel = levelSelect.value;
    const previousClassNumber = classNumberSelect.value;

    classNumberSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    const major = allMajors.find(m => m.name === selectedMajorName && m.level?.trim() === selectedLevel?.trim());
    const targetMajorId = major ? major.id : null;

    if (targetMajorId && selectedYear) {
        const filteredClasses = allClasses.filter(c => 
            c.major_id === targetMajorId && 
            c.year.toString() === selectedYear
        );

        const uniqueClassNumbers = [...new Set(filteredClasses.map(c => c.class_number))]
            .sort((a, b) => a - b);

        uniqueClassNumbers.forEach(number => {
            const option = document.createElement('option');
            option.value = number;
            option.textContent = `ห้อง ${number}`;
            if (number.toString() === previousClassNumber) {
                option.selected = true;
            }
            classNumberSelect.appendChild(option);
        });
    }
}


// ==========================================================
// === 2. FETCH & RENDER ACTIVITY ===
// ==========================================================

async function fetchActivities() {
    const container = document.getElementById('activityCardContainer');
    container.innerHTML = 'กำลังโหลดกิจกรรม...';

    // ดึงกิจกรรมมาทั้งหมดก่อน
    let query = supabaseClient
        .from('activity')
        .select(`
            id,
            name,
            start_time,
            end_time,
            is_recurring,
            class:class_id (
                id,
                class_number,
                year,
                major:major_id (id, name, level)
            )
        `)
        .order('start_time', { ascending: true });
        
    const { data: activities, error } = await query;

    if (error) {
        console.error('Error fetching activities:', error.message);
        container.innerHTML = `<p>ไม่สามารถดึงรายการกิจกรรมได้</p>`;
        return;
    }

    // 🛡️ กรองกิจกรรมสำหรับนักเรียน
    let filteredActivities = activities;
    
    if (userRole === 'student' && studentMajorId) {
        // กรองเอาเฉพาะกิจกรรมที่เป็นของ "ทุกสาขา" (major_id ใน class เป็น null?) 
        // หรือกิจกรรมที่ตรงกับสาขาของนักเรียน
        filteredActivities = activities.filter(act => {
            const actMajorId = act.class?.major?.id;
            // ถ้ากิจกรรมไม่มี class/major ระบุ (คือกิจกรรมส่วนกลาง) -> ให้เห็นได้
            if (!actMajorId) return true;
            
            // ถ้ามีระบุสาขา ต้องตรงกับสาขาของนักเรียน
            return actMajorId === studentMajorId;
        });
    }

    cachedActivities = filteredActivities;
    
    RenderActivityCards(filteredActivities, container);
    filterActivities(filteredActivities);
}

function RenderActivityCards(activities, container) {
    container.innerHTML = '';

    if (activities.length === 0) {
        container.innerHTML = '<p>ไม่พบกิจกรรมสำหรับคุณ</p>';
        return;
    }
    
    const DEFAULT_MAJOR = 'ทุกสาขา';
    const DEFAULT_LEVEL = 'ทุกระดับ';
    const DEFAULT_YEAR = 'ทุกปี';
    const DEFAULT_CLASS_NUM = 'ทุกห้อง';

    activities.forEach(activity => {
        const date = new Date(activity.start_time).toLocaleDateString('th-TH', { 
            day: '2-digit', month: '2-digit', year: 'numeric' 
        }).replace(/\//g, '/');
        
        const startTime = new Date(activity.start_time).toLocaleTimeString('th-TH', { 
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' 
        });
        
        const endTime = new Date(activity.end_time).toLocaleTimeString('th-TH', { 
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' 
        });
        
        const classData = activity.class;
        const majorData = classData?.major;
        const departmentName = majorData?.name || DEFAULT_MAJOR;
        const departmentLevel = majorData?.level || DEFAULT_LEVEL;
        const classYear = classData?.year || DEFAULT_YEAR;
        const classNumber = classData?.class_number || DEFAULT_CLASS_NUM;
        const mockSemester = (activity.id % 2) + 1;
        const recurringDays = activity.is_recurring ? 'N' : '0';

        const cardHTML = `
            <div class="activity-card" 
                data-id="${activity.id}" 
                data-name="${activity.name}" 
                data-dept-name="${departmentName}" 
                data-level="${departmentLevel}"
                data-year="${classYear}"
                data-classnum="${classNumber}">
                
                <div class="card-title">${activity.name}</div>
                <div class="card-detail">วันที่ ${date}</div>
                <div class="card-detail">เวลา ${startTime} น. - ${endTime} น.</div>
                <div class="card-detail">สาขา: ${departmentName}</div>
                <div class="card-detail">ระดับ: ${departmentLevel}</div>
                <div class="card-detail">ชั้นปี: ปี ${classYear} ห้อง ${classNumber}</div>
                <div class="card-detail">จัดขึ้นทุก ${recurringDays} วัน</div>
                <div class="card-detail">เทอม: ${mockSemester}</div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });

    attachCardEventListeners();
}

function attachCardEventListeners() {
    document.querySelectorAll('.activity-card').forEach(card => {
        card.addEventListener('click', () => {
            const activityId = card.dataset.id;
            window.location.href = `Check_activities.html?activityId=${activityId}`;
        });
    });
}

function handleLevelChange() { updateMajorFilter(); updateYearFilter(); updateClassNumberFilter(); filterActivities(cachedActivities); }
function handleMajorChange() { updateYearFilter(); updateClassNumberFilter(); filterActivities(cachedActivities); }
function handleYearChange() { updateClassNumberFilter(); filterActivities(cachedActivities); }

function filterActivities(activities) {
    const keyword = activityNameInput.value.toLowerCase().trim();
    const selectedLevel = levelSelect.value;
    const selectedDept = departmentSelect.value;
    const selectedYear = studentYearSelect.value;
    const selectedClassNum = classNumberSelect.value;

    let visibleCount = 0;
    const container = document.getElementById('activityCardContainer');
    
    activities.forEach(activity => {
        const card = document.querySelector(`.activity-card[data-id="${activity.id}"]`);
        if (!card) return;

        const activityName = activity.name.toLowerCase();
        const hasValidClassData = !!activity.class;
        const activityLevel = card.dataset.level || '';
        const activityDeptName = card.dataset.deptName || '';
        const activityYear = card.dataset.year || '';
        const activityClassNum = card.dataset.classnum || '';

        const matchName = activityName.includes(keyword);
        let isMatch = false;

        if (!hasValidClassData) {
            isMatch = matchName;
        } else {
            const matchLevel = selectedLevel === '' || selectedLevel === activityLevel;
            const matchDept = selectedDept === '' || selectedDept === activityDeptName;
            const matchYear = selectedYear === '' || selectedYear === activityYear;
            const matchClassNum = selectedClassNum === '' || selectedClassNum === activityClassNum;

            isMatch = matchName && matchLevel && matchDept && matchYear && matchClassNum;
        }

        card.style.display = isMatch ? 'block' : 'none';
        if (isMatch) visibleCount++;
    });

    const noResults = document.getElementById('no-results');
    if (visibleCount === 0 && !noResults) {
        container.innerHTML += '<p id="no-results" style="text-align: center; width: 100%;">ไม่พบกิจกรรมตามเงื่อนไขที่เลือก</p>';
    } else if (visibleCount > 0 && noResults) {
        noResults.remove();
    }
}

// ==========================================================
// === INIT ===
// ==========================================================
document.addEventListener('DOMContentLoaded', async () => {
    departmentSelect = document.getElementById('department');
    levelSelect = document.getElementById('level');
    studentYearSelect = document.getElementById('studentYear');
    classNumberSelect = document.getElementById('classNumber');
    activityNameInput = document.getElementById('activityNameInput');

    if (!departmentSelect || !levelSelect || !studentYearSelect || !classNumberSelect || !activityNameInput) return;

    // 1. ดึงข้อมูล User (ถ้าเป็นนักเรียน จะไปหา Major ID มาก่อน)
    await fetchUserContext();
    
    // 2. โหลด Filter
    await populateFilters();

    // 3. โหลดและกรองกิจกรรม
    await fetchActivities();

    levelSelect.addEventListener('change', handleLevelChange);
    departmentSelect.addEventListener('change', handleMajorChange);
    studentYearSelect.addEventListener('change', handleYearChange);
    classNumberSelect.addEventListener('change', () => filterActivities(cachedActivities));
    activityNameInput.addEventListener('input', () => filterActivities(cachedActivities));
});