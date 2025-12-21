// =======================================
// CONFIG
// =======================================
const API_URL = '../Php/Create_activities.php';

// =======================================
// CREATE ACTIVITY
// =======================================
async function handleCreateActivity(event) {
    event.preventDefault();
    const form = event.target;

    const payload = {
        activityName: form.activityName.value.trim(),
        activityType: form.activityType.value,
        activityDate: form.activityDate.value,
        startTime: form.startTime.value,
        endTime: form.endTime.value,
        semester: parseInt(form.semester.value, 10),
        recurringDays: parseInt(form.recurringDays.value || 0, 10),
        classId: form.studentClass.value,
        level: form.level.value || "",
        majorId: form.department.value || "",
        studentYear: form.studentYear.value || ""
    };

    // ---------------------------
    // BASIC VALIDATION
    // ---------------------------
    if (
        !payload.activityName ||
        !payload.activityType ||
        !payload.activityDate ||
        !payload.startTime ||
        !payload.endTime ||
        !payload.semester ||
        !payload.classId
    ) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=create_activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!res.ok) throw result;

        alert(`✅ สร้างกิจกรรมสำเร็จ เพิ่มนักเรียน ${result.student_count} คน`);
        form.reset();

        // reset dropdown ห้อง
        document.getElementById('studentClass').innerHTML =
            '<option value="">เลือกห้องเรียน</option>';

    } catch (err) {
        console.error(err);
        alert(err.message || 'เกิดข้อผิดพลาด');
    }
}

// =======================================
// FETCH MAJORS
// =======================================
async function fetchAllMajors() {
    const res = await fetch(`${API_URL}?action=get_majors`);
    if (!res.ok) throw new Error('โหลดข้อมูลสาขาไม่สำเร็จ');
    return await res.json();
}

// =======================================
// FETCH CLASSES
// =======================================
async function fetchClasses(level, majorId, year) {
    const params = new URLSearchParams({
        action: 'get_classes',
        level: level || '',
        majorId: majorId || '',
        year: year || ''
    });

    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error('โหลดข้อมูลห้องเรียนไม่สำเร็จ');
    return await res.json();
}

// =======================================
// UPDATE CLASS DROPDOWN
// =======================================
async function updateClassDropdown() {
    const level = document.getElementById('level').value;
    const majorId = document.getElementById('department').value;
    const year = document.getElementById('studentYear').value;

    const classSelect = document.getElementById('studentClass');
    classSelect.innerHTML = '<option value="">เลือกห้องเรียน</option>';

    if (!level && !majorId && !year) return;

    try {
        const classes = await fetchClasses(level, majorId, year);

        if (classes.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'ไม่พบห้องเรียน';
            option.disabled = true;
            classSelect.appendChild(option);
            return;
        }

        classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.class_name;
            classSelect.appendChild(option);
        });
    } catch (err) {
        console.error(err);
        alert('ไม่สามารถโหลดห้องเรียนได้');
    }
}

// =======================================
// HANDLE LEVEL CHANGE
// =======================================
function handleLevelChange(selectedLevel, majors) {
    const departmentSelect = document.getElementById('department');
    const yearSelect = document.getElementById('studentYear');

    // reset
    departmentSelect.innerHTML = '<option value="">เลือกสาขา</option>';
    yearSelect.innerHTML = '<option value="">เลือกปี</option>';

    if (!selectedLevel) return;

    // filter majors by level
    majors
        .filter(m => m.level === selectedLevel)
        .forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.name;
            departmentSelect.appendChild(option);
        });

    // year by level (hardcode)
    let years = [];
    if (selectedLevel === 'ปวช.') years = [1, 2, 3];
    if (selectedLevel === 'ปวส.') years = [1, 2];

    years.forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
    });

    departmentSelect.addEventListener('change', updateClassDropdown);
    yearSelect.addEventListener('change', updateClassDropdown);

    updateClassDropdown();
}

// =======================================
// INIT
// =======================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // load majors
        const majors = await fetchAllMajors();

        const levelSelect = document.getElementById('level');
        if (levelSelect) {
            levelSelect.addEventListener('change', () => {
                handleLevelChange(levelSelect.value, majors);
            });
        }

        // form submit
        const form = document.getElementById('createActivityForm');
        if (form) {
            form.addEventListener('submit', handleCreateActivity);
        }

    } catch (err) {
        console.error(err);
        alert('ไม่สามารถโหลดข้อมูลเริ่มต้นได้');
    }
});
