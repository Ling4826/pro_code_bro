/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';
const supabaseCilent = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const activityId = params.get('activityId');

/* ====== HELPERS ====== */
const $ = sel => document.querySelector(sel);
let allMajors = [];
let allClassesData = [];
let globalIsoDate;
let globalSemester;
let globalAcademicYear;

function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? '';
}

function formatTimeISO(d) {
    if (!d) return '';
    const dateObj = new Date(d);
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/* ====== LOADERS / RENDER ====== */

async function fetchAllMajorsAndClasses() {
    const { data: majors, error: majorError } = await supabaseCilent
        .from('major')
        .select('id, name, level');
    if (majorError) { console.error('Error fetching majors:', majorError.message); return; }
    allMajors = majors;

    const { data: classes, error: classError } = await supabaseCilent
        .from('class')
        .select('id, class_name, major_id, year, class_number');
    if (classError) { console.error('Error fetching classes:', classError.message); return; }
    allClassesData = classes;
}

// 1. อัปเดต Dropdown สาขา (ใส่ logic เลือกค่าอัตโนมัติ)
function updateDepartmentOptions(selectedLevel, currentMajorId = null) {
    const departmentSelect = document.getElementById('department');
    if (!departmentSelect) return;
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';

    if (!selectedLevel) return;

    const filteredMajors = allMajors.filter(m => m.level === selectedLevel);
    filteredMajors.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        // Logic เลือกค่าทันที
        if (currentMajorId && m.id.toString() === currentMajorId.toString()) {
            option.selected = true;
        }
        departmentSelect.appendChild(option);
    });
}

// 2. อัปเดต Dropdown ปี
function updateYearOptions(selectedLevel, currentYear = null) {
    const yearSelect = document.getElementById('studentYear');
    if (!yearSelect) return;
    yearSelect.innerHTML = '<option value="">เลือกปี</option>';

    if (!selectedLevel) return;

    let years = [];
    if (selectedLevel === 'ปวช.') years = [1, 2, 3];
    else if (selectedLevel === 'ปวส.') years = [1, 2];

    years.forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        if (currentYear && y.toString() === currentYear.toString()) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    });
}

// 3. อัปเดต Dropdown ห้อง
async function fetchStudentClass(currentClassId = null) {
    const majorId = document.getElementById('department').value;
    const year = document.getElementById('studentYear').value;
    const classSelect = document.getElementById('studentClass');
    if (!classSelect) return;
    classSelect.innerHTML = '<option value="">เลือกห้อง</option>';

    if (!majorId || !year) return;

    const filteredClasses = allClassesData.filter(c =>
        c.major_id.toString() === majorId.toString() && c.year.toString() === year.toString()
    );

    filteredClasses.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.class_name ? c.class_name : `ห้อง ${c.class_number}`;
        if (currentClassId && c.id.toString() === currentClassId.toString()) {
            option.selected = true;
        }
        classSelect.appendChild(option);
    });
}

function attachRadioToggleBehavior(container = document) {
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
        if (radio.dataset.listenerAttached === "true") return;
        radio.addEventListener('click', function (event) {
            if (this.dataset.waschecked === "true") {
                event.preventDefault();
                const that = this;
                setTimeout(() => {
                    that.checked = false;
                    that.dataset.waschecked = "false";
                }, 0);
            } else {
                const group = container.querySelectorAll(`input[name="${this.name}"]`);
                group.forEach(r => r.dataset.waschecked = "false");
                this.dataset.waschecked = "true";
            }
        });
        radio.dataset.listenerAttached = "true";
    });
}

async function loadAttendanceTable(activityIdLocal) {
    const tableBody = document.querySelector('.attendance-table tbody');
    tableBody.innerHTML = '';

    try {
        const { data, error } = await supabaseCilent
            .from('activity_check')
            .select('id,semester,student:student_id (id,name),status,date,academic_year')
            .eq('activity_id', activityIdLocal)
            .order('student_id', { ascending: true });

        if (error) throw error;
        const statusMap = { 'Attended': 'present', 'Absent': 'absent', 'Excused': 'late' };

        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">ไม่พบรายชื่อนักเรียน</td></tr>';
            return;
        }

        data.forEach((record) => {
            const indexId = record.id;
            const studentName = record.student?.name || '-';
            const studentId = record.student?.id || '-';
            const status = statusMap[record.status] || '';

            const tr = document.createElement('tr');
            tr.dataset.recordId = record.id;
            const radioName = `status_${record.id}`;

            tr.innerHTML = `
                <td style="text-align:left; padding-left:8px">${studentName}</td>
                <td>${studentId}</td>
                <td>
                    <input type="radio" name="${radioName}" id="present_${indexId}" value="present" ${status === 'present' ? 'checked' : ''}>
                    <label for="present_${indexId}" class="present-btn"></label>
                </td>
                <td>
                    <input type="radio" name="${radioName}" id="absent_${indexId}" value="absent" ${status === 'absent' ? 'checked' : ''}>
                    <label for="absent_${indexId}" class="absent-btn"></label>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        attachRadioToggleBehavior(tableBody);
    } catch (err) {
        console.error('loadAttendanceTable error', err);
    }
}

/* ====== ACTIONS ====== */

async function loadActivity() {
    if (!activityId) {
        console.warn('No activityId in URL');
        return;
    }

    try {
        // 1. ดึงข้อมูล Activity
        const { data: activity, error } = await supabaseCilent
            .from('activity')
            .select(`
                id, 
                name, 
                activity_type, 
                start_time, 
                end_time, 
                is_recurring, 
                class_id,
                major_id,
                class:class_id ( 
                    year, 
                    class_number,
                    major:major_id ( id, name, level ) 
                )
            `)
            .eq('id', activityId)
            .single();

        if (error) throw error;

        // 2. Prepare Data for Dropdowns
        let initialLevel, initialMajorId, initialYear, initialClassId;

        // กรณีที่ 1: มีห้องเรียน (Class)
        if (activity.class && activity.class.major) {
            initialLevel = activity.class.major.level;
            initialMajorId = activity.class.major.id;
            initialYear = activity.class.year;
            initialClassId = activity.class_id;
        } 
        // กรณีที่ 2: ไม่มีห้อง แต่มีสาขา (Major)
        else if (activity.major_id) {
            // ต้องรอ fetch major เพื่อหา level (ทำใน step 6)
            initialMajorId = activity.major_id;
        }

        // 3. Activity Check Data
        const { data: activity_check, error: actErr } = await supabaseCilent
            .from('activity_check')
            .select('date,semester')
            .eq('activity_id', activityId)
            .limit(1);

        let initialDate = activity.start_time;
        let initialSemester = null;
        if (!actErr && activity_check && activity_check.length > 0) {
            initialDate = activity_check[0].date;
            initialSemester = activity_check[0].semester;
        }

        // 4. Set Text Inputs
        setValue('activityName', activity.name || '');
        setValue('recurringDays', activity.is_recurring ? 1 : 0);
        setValue('semester', initialSemester || '');

        // 4.1 Set Activity Type (เพิ่มส่วนนี้เพื่อให้ Dropdown เปลี่ยน)
        let typeToSet = activity.activity_type;
        if (!typeToSet && activity.name) {
             // Auto-detect Fallback
             if (activity.name.includes('เสาธง') || activity.name.includes('ธงชาติ') || activity.name.includes('เข้าแถว')) {
                 typeToSet = 'flag_ceremony';
             } else {
                 typeToSet = 'activity';
             }
        }
        const typeSelect = document.getElementById('activityType');
        if (typeSelect) {
            typeSelect.value = typeToSet;
            // ถ้าค่ายังไม่เปลี่ยน (อาจเพราะ Case sensitive) ให้ลองวนหา
            if (!typeSelect.value) {
                 Array.from(typeSelect.options).forEach(opt => {
                     if (opt.value.toLowerCase() === String(typeToSet).toLowerCase()) {
                         typeSelect.value = opt.value;
                     }
                 });
            }
        }

        // 5. Config Flatpickr (เอา disabled: true ออกแล้ว!)
        if (window.flatpickr) {
            const defaultDate = initialDate ? new Date(initialDate) : null;
            flatpickr("#activityDate", {
                dateFormat: "d/m/Y", locale: "th", defaultDate: defaultDate
            });

            const defaultStartTime = activity.start_time ? formatTimeISO(activity.start_time) : null;
            flatpickr("#startTime", {
                enableTime: true, noCalendar: true, time_24hr: true, dateFormat: "H:i",
                altInput: true, altFormat: "H:i น.", locale: "th", defaultDate: defaultStartTime
            });

            const defaultEndTime = activity.end_time ? formatTimeISO(activity.end_time) : null;
            flatpickr("#endTime", {
                enableTime: true, noCalendar: true, time_24hr: true, dateFormat: "H:i",
                altInput: true, altFormat: "H:i น.", locale: "th", defaultDate: defaultEndTime
            });
        }

        // 6. Load Dropdowns
        await fetchAllMajorsAndClasses();

        // 6.1 ถ้ามี major_id แต่ไม่มี level (กรณีไม่มี class) ให้หา level จาก allMajors
        if (!initialLevel && initialMajorId) {
            const foundMajor = allMajors.find(m => m.id === initialMajorId);
            if (foundMajor) initialLevel = foundMajor.level;
        }

        // 6.2 Apply Values
        setValue('level', initialLevel);
        updateDepartmentOptions(initialLevel, initialMajorId);
        updateYearOptions(initialLevel, initialYear);
        await fetchStudentClass(initialClassId);

        // 7. Load Table
        await loadAttendanceTable(activityId);
        
        globalSemester = initialSemester;
        const tempDate = new Date(initialDate);
        globalIsoDate = tempDate.toISOString().split('T')[0];
        globalAcademicYear = tempDate.getFullYear() + 543;

    } catch (err) {
        console.error('loadActivity error', err);
        // alert("เกิดข้อผิดพลาด: " + err.message); // Comment out เพื่อไม่ให้กวน user ถ้า error เล็กน้อย
    }
}

/* ====== INIT ====== */
document.addEventListener('DOMContentLoaded', async () => {
    // แก้ไข: โหลดข้อมูลทันที
    await loadActivity();

    const form = document.getElementById('createActivityForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const rows = Array.from(document.querySelectorAll('.attendance-table tbody tr'));
                const statusMap = { present: 'Attended', absent: 'Absent', late: 'Excused' };

                for (const row of rows) {
                    const recordId = row.dataset.recordId;
                    if (!recordId) continue;
                    const checked = row.querySelector('input[type="radio"]:checked');
                    const statusValue = checked ? checked.value : null;
                    const supaStatus = statusMap[statusValue] || null;

                    const { error } = await supabaseCilent
                        .from('activity_check')
                        .update({
                            status: supaStatus,
                            date: globalIsoDate,
                            semester: globalSemester,
                            academic_year: globalAcademicYear
                        })
                        .eq('id', recordId);
                    if (error) throw error;
                }
                alert('บันทึกเรียบร้อย!');
                window.location.href = 'Activity_list.html';
            } catch (err) {
                console.error('submit error', err);
                alert('Error: ' + err.message);
            }
        });
    }
});