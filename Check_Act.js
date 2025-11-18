// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU'; // Key ของคุณ

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CACHE_KEY = "activitiesCache";
const CACHE_TTL = 5 * 60 * 1000; // 5 นาที
const CACHE_KEY_STUDENTS = "studentsCache";
const CACHE_KEY_CLASSES = "classesCache";
let allStudents = new Set();
let allClassesByMajorYear = {}; // { "majorId_year": Set(classId) }

async function fetchActivities() {
    // เช็ก cache ก่อน
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const parsed = JSON.parse(cached);
        const now = new Date().getTime();
        if (now - parsed.timestamp < CACHE_TTL) {
            console.log("ใช้ cache จาก localStorage");
            const activities = parsed.data;

            document.getElementById("exportExcelBtn")
                .addEventListener("click", () => exportToExcel(activities));

            LoadDate(activities);
            await Promise.all([
                Promise.resolve().then(() => setupFilters(activities)),
                Promise.resolve().then(() => RenderTable(activities))
            ]);
            return;
        } else {
            console.log("หมดอายุ cache, ดึงข้อมูลใหม่");
        }
    }
    const start = performance.now();
    // ถ้าไม่มี cache หรือหมดอายุ ให้ fetch จริง
    const { data: activities, error } = await supabaseClient
        .from('activity')
        .select(`
            id,
            name,
            start_time,
            end_time,
            is_recurring,
            class:class_id (
                id,
                class_name,
                year,
                class_number,
                major:major_id (
                    id,
                    name,
                    level
                )
            ),
            check:activity_check (
                id,
                student_id,
                status,
                date,
                semester,
                academic_year
            )
        `)
        .order('start_time', { ascending: true });
        const end = performance.now();
        console.log(`fetchData ใช้เวลา ${(end - start).toFixed(3)} ms`);
    if (error) {
        console.error('Error fetching activities:', error.message);
        container.innerHTML = '<p>ไม่สามารถดึงรายการกิจกรรมได้</p>';
        return;
    }

    console.log("Activities:", activities);

    // เก็บ cache ลง localStorage
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: new Date().getTime(),
        data: activities
    }));

    document.getElementById("exportExcelBtn")
        .addEventListener("click", () => exportToExcel(activities));

    LoadDate(activities);
    await Promise.all([
        Promise.resolve().then(() => setupFilters(activities)),
        Promise.resolve().then(() => RenderTable(activities))
    ]);
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit'
    });
}
async function loadCache() {
    // โหลด student จาก cache หรือ Supabase
    const cachedStudents = localStorage.getItem(CACHE_KEY_STUDENTS);
    if (cachedStudents) {
        const parsed = JSON.parse(cachedStudents);
        allStudents = new Set(parsed.map(s => JSON.stringify(s))); // store {id,class_id} as string
        console.log("Loaded students from cache");
    } else {
        const { data: students } = await supabaseClient
            .from('student')
            .select('id, class_id');
        allStudents = new Set(students.map(s => JSON.stringify(s)));
        localStorage.setItem(CACHE_KEY_STUDENTS, JSON.stringify(students));
        console.log("Fetched students from Supabase");
    }

    // โหลด class จาก cache หรือ Supabase
    const cachedClasses = localStorage.getItem(CACHE_KEY_CLASSES);
    if (cachedClasses) {
        const parsed = JSON.parse(cachedClasses);
        allClassesByMajorYear = {};
        parsed.forEach(c => {
            const key = `${c.major_id}_${c.year}`;
            if (!allClassesByMajorYear[key]) allClassesByMajorYear[key] = new Set();
            allClassesByMajorYear[key].add(c.id);
        });
        console.log("Loaded classes from cache");
    } else {
        const { data: classes } = await supabaseClient
            .from('class')
            .select('id, major_id, year');
        allClassesByMajorYear = {};
        classes.forEach(c => {
            const key = `${c.major_id}_${c.year}`;
            if (!allClassesByMajorYear[key]) allClassesByMajorYear[key] = new Set();
            allClassesByMajorYear[key].add(c.id);
        });
        localStorage.setItem(CACHE_KEY_CLASSES, JSON.stringify(classes));
        console.log("Fetched classes from Supabase");
    }
}
function LoadDate(activities) {
    const daySelect = document.getElementById('daySelect');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');

    const days = new Set();
    const months = new Set();
    const years = new Set();

    activities.forEach(act => {
        const d = new Date(act.start_time);
        days.add(d.getDate());
        months.add(d.getMonth() + 1);
        years.add(d.getFullYear() + 543);
    });

    // ล้างก่อน
    daySelect.innerHTML = '';
    monthSelect.innerHTML = '';
    yearSelect.innerHTML = '';

    // สร้าง option
    days.forEach(d => daySelect.innerHTML += `<option value="${d}">${d}</option>`);
    months.forEach(m => monthSelect.innerHTML += `<option value="${m}">${m}</option>`);
    years.forEach(y => yearSelect.innerHTML += `<option value="${y}">${y}</option>`);
}

function setupFilters(activities) {
    const daySelect = document.getElementById('daySelect');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');

    // ค่าเริ่มต้นเป็นค่าว่างทั้งหมด
    daySelect.value = "";
    monthSelect.value = "";
    yearSelect.value = "";

    function applyFilter() {
        const dVal = daySelect.value;
        const mVal = monthSelect.value;
        const yVal = yearSelect.value;

        const filtered = activities.filter(act => {
            const d = new Date(act.start_time);

            const day = d.getDate();
            const month = d.getMonth() + 1;
            const year = d.getFullYear() + 543;

            const matchDay = dVal ? day === parseInt(dVal) : true;
            const matchMonth = mVal ? month === parseInt(mVal) : true;
            const matchYear = yVal ? year === parseInt(yVal) : true;

            return matchDay && matchMonth && matchYear;
        });

        RenderTable(filtered);
    }

    // applyFilter จะรันเฉพาะเมื่อมีการเปลี่ยนค่า select
    daySelect.addEventListener('change', applyFilter);
    monthSelect.addEventListener('change', applyFilter);
    yearSelect.addEventListener('change', applyFilter);

    // เรียก RenderTable ครั้งแรกแบบไม่กรอง
    RenderTable(activities);
}



function RenderTable(activities) {
    const start = performance.now();
    const container = document.getElementById('activityCheckTableBody');
    container.innerHTML = "";

    const rows = activities.map(act => {
        const startTime = formatTime(act.start_time);
        const endTime = formatTime(act.end_time);

        const major = act.class?.major?.name ?? null;
        const level = act.class?.major?.level ?? null;
        const year = act.class?.year ?? null;
        const className = act.class?.class_name ?? null;

        let totalStudents = 0;
        let attendedCount = 0;

        if (!major || !level || !year) {
            // ทั้งโรงเรียน
            totalStudents = allStudents.size;
            attendedCount = act.check
                ? act.check.filter(c => c.status === "Attended").length
                : 0;
        } else {
            const key = `${act.class.major.id}_${year}`;
            const classIds = allClassesByMajorYear[key] ?? new Set();

            // students ใน classIds
            const students = Array.from(allStudents)
                .map(s => JSON.parse(s))
                .filter(s => classIds.has(s.class_id))
                .map(s => s.id);

            totalStudents = students.length;
            attendedCount = act.check
                ? act.check.filter(c => students.includes(c.student_id)).length
                : 0;
        }

        const percent = totalStudents > 0
            ? Math.round((attendedCount / totalStudents) * 100)
            : 0;

        const statusChecks =
            !act.check || act.check.length === 0
                ? "ยังไม่เช็ก"
                : attendedCount === totalStudents
                    ? "เช็กครบ"
                    : "ยังไม่ครบ";

        return `
        <tr>
            <td>${act.name}</td>
            <td>${startTime} - ${endTime}</td>
            <td>${major ?? 'ทั้งโรงเรียน'}</td>
            <td>${level ?? '-'}</td>
            <td>${year ?? '-'}</td>
            <td>${className ?? '-'}</td>
            <td class="status-cell ${statusChecks === "เช็กครบ" ? "checked" : "unchecked"}">
                ${statusChecks}
            </td>
            <td>${attendedCount} / ${totalStudents} คน (${percent}%)</td>
        </tr>`;
    });

    container.innerHTML = rows.join('');
    const end = performance.now();
    console.log(`RenderTable (cached + Set) ใช้เวลา ${(end - start).toFixed(3)} ms`);
}

async function autoCheckUpdates() {
    const { data, error } = await supabaseClient
        .from('activity')
        .select('id', { count: 'exact' });

    if (error) return console.error(error);

    if (data.length !== lastCount) {
        console.log("มีข้อมูลอัปเดต → โหลดใหม่");
        lastCount = data.length;
        fetchActivities();
    }
}
function exportToExcel(activities) {
    alert("กำลังพัฒนาฟีเจอร์นี้...");
}
async function initCount() {
    const { data, error } = await supabaseClient
        .from('activity')
        .select('id', { count: 'exact' });

    if (!error) {
        lastCount = data.length; // ตั้งค่าเริ่มต้น
        console.log("Initial count:", lastCount);
    }
}
document.addEventListener('DOMContentLoaded', async () => {
    await initCount();
    await loadCache();     // ตั้งค่า lastCount ก่อน
    await fetchActivities();
    setInterval(autoCheckUpdates, 5000);  // เริ่มตรวจอัปเดตหลังตั้งค่าแล้ว
});


