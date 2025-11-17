// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU'; // Key ของคุณ

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
async function fetchActivities() {
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

    if (error) {
        console.error('Error fetching activities:', error.message);
        container.innerHTML = '<p>ไม่สามารถดึงรายการกิจกรรมได้</p>';
        return;
    }

    console.log("Activities:", activities);

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

function filtersDate( activities,selectedDay, selectedMonth, selectedYear) {
    return(activities.filter(act => {
        const d = new Date(act.start_time);

        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear() + 543; // แปลงเป็น พ.ศ.

        // ถ้า select เป็นค่า null/empty ให้ไม่กรองตามค่านั้น
        const matchDay = selectedDay ? day === parseInt(selectedDay) : true;
        const matchMonth = selectedMonth ? month === parseInt(selectedMonth) : true;
        const matchYear = selectedYear ? year === parseInt(selectedYear) : true;
        return matchDay && matchMonth && matchYear;
    }));
}
function setupFilters(activities) {
    const daySelect = document.getElementById('daySelect');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');

    const applyFilter = () => {
        const filtered = filtersDate(
            activities,
            daySelect.value,
            monthSelect.value,
            yearSelect.value
        );
        RenderTable(filtered);
    };

    daySelect.addEventListener('change', applyFilter);
    monthSelect.addEventListener('change', applyFilter);
    yearSelect.addEventListener('change', applyFilter);
}


async function RenderTable(activities) {
    const container = document.getElementById('activityCheckTableBody');
    container.innerHTML = "";

    // สร้าง promise สำหรับทุก activity
    const rows = await Promise.all(activities.map(async (act) => {
        const startTime = formatTime(act.start_time);
        const endTime = formatTime(act.end_time);

        const major = act.class?.major?.name ?? null;
        const level = act.class?.major?.level ?? null;
        const year = act.class?.year ?? null;
        const className = act.class?.class_name ?? null;

        let totalStudents = 0;
        let attendedCount = 0;
        let displayText = "";

        if (!major || !level || !year) {
            // ทั้งโรงเรียน
            const { data: allStudents } = await supabaseClient
                .from('student')
                .select('id');
            totalStudents = (allStudents || []).length;
            attendedCount = act.check
                ? act.check.filter(c => c.status === "Attended").length
                : 0;
            displayText = `${attendedCount}/${totalStudents} คน (${totalStudents > 0 ? Math.round((attendedCount / totalStudents)*100) : 0}%)`;
        } else {
            // ตาม major + year
            const { data: classList } = await supabaseClient
                .from('class')
                .select('id')
                .eq('major_id', act.class.major.id)
                .eq('year', year);

            const classIds = classList?.map(c => c.id) || [];
            const { data: students } = await supabaseClient
                .from('student')
                .select('id')
                .in('class_id', classIds);

            totalStudents = students?.length || 0;
            attendedCount = act.check
                ? act.check.filter(c =>
                    students?.some(s => s.id === c.student_id)
                ).length
                : 0;
            displayText = `${attendedCount} / ${totalStudents} คน`;
        }

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
            <td>${displayText}</td>
        </tr>
        `;
    }));

    // append rows ทีเดียว
    container.innerHTML = rows.join('');
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
    // แปลงข้อมูลให้อยู่ในรูปที่อ่านง่าย
    const exportData = activities.map(act => ({
        "ชื่อกิจกรรม": act.name,
        "เวลาเริ่ม": formatTime(act.start_time),
        "เวลาสิ้นสุด": formatTime(act.end_time),
        "แผนก": act.major?.name ?? "ทั้งโรงเรียน",
        "ระดับ": act.major?.level ?? "-",
        "วันเริ่ม (ISO)": act.start_time,
        "วันสิ้นสุด (ISO)": act.end_time,
        "สถานะเช็กชื่อ": act.check?.length > 0 ? "เช็กแล้ว" : "ยังไม่เช็ก"
    }));

    // สร้าง worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // สร้าง workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activities");

    // ดาวน์โหลดไฟล์
    XLSX.writeFile(workbook, "activities.xlsx");
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
    await initCount();     // ตั้งค่า lastCount ก่อน
    await fetchActivities();
    setInterval(autoCheckUpdates, 5000);  // เริ่มตรวจอัปเดตหลังตั้งค่าแล้ว
});


