/* ====== CONFIG ====== */
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let termScoreRows = [];
async function fetchTermScore() {
  const { data, error } = await supabaseClient
    .from('term_score')
    .select(`
      id,
      semester,
      academic_year,
      flag_ceremony_percentage,
      department_activity_percentage,
      total_score,
      is_passed,

      student:student_id (
        id,
        name,
        class:class_id (
          id,
          year,
          major:major_id (
            id,
            name,
            level,
            teacher_major (
              teacher:teacher_id (
                id,
                name
              )
            )
          )
        ),
        activity_check (
          id,
          activity_id,
          status,
          date,
          semester,
          academic_year
        )
      ),

      major:major_id (
        id,
        name,
        level
      )
    `);

  if (error) {
    console.error("ERROR >", error);
    return null;
  }

termScoreRows = data.map(row => {
    const student = row.student;
    const major = student?.class?.major;

    const advisorList =
      major?.teacher_major?.map(tm => tm.teacher.name) || [];

    const activityCount =
      row.activity_check?.filter(a => a.status === "Attended").length || 0;

    return {
      id: row.id,
      student_id: student?.id ?? "-",
      studentName: student?.name ?? "-",
      majorName: major?.name ?? "-",
      advisors: advisorList.join(", ") || "-",

      attendedActivity: activityCount,
      internshipActivity: 0, // ยังไม่มีข้อมูลฝึกงานใน schema เธอ

      exActivity: row.flag_ceremony_percentage,
      exInternship: row.department_activity_percentage,

      activityResult: row.is_passed ? "ผ่าน" : "ไม่ผ่าน",
      internshipResult: row.department_activity_percentage >= 50 ? "ผ่าน" : "ไม่ผ่าน"
    };
  });
   const majorMap = new Map();
    termScoreRows.forEach(r => {
    if (r.majorName && !majorMap.has(r.majorName)) majorMap.set(r.majorName, { name: r.majorName });
    });
    fetchOptionsFromDepartment(Array.from(majorMap.values()));
    renderFilteredTable()
}
function searchStudentByName(rows) {
    const name = document.querySelector('input[type="text"]').value;
  if (!name) return rows;
  const lowerName = name.toLowerCase();
  return rows.filter(row => row.studentName.toLowerCase().includes(lowerName));
}

function fetchOptionsFromDepartment(data) {
  if (!Array.isArray(data)) return;
  const departmentSelect = document.getElementById("department");
  departmentSelect.innerHTML = "<option>เลือกสาขา</option>";
  data.forEach(major => {
    const option = document.createElement("option");
    option.value = major.name;
    option.textContent = major.name;
    departmentSelect.appendChild(option);
  });
}

// ฟังก์ชันกรองตามสาขา
function filterByDepartment(rows) {
  const departmentSelect = document.getElementById("department");
  const department = departmentSelect.value;
  if (!department || department === "เลือกสาขา") return rows;
  return rows.filter(row => row.majorName === department);
}

// ฟังก์ชันกรองตามระดับ
function filterByLevel(rows) {
  const levelSelect = document.getElementById("level");
  const level = levelSelect.value;
  if (!level || level === "เลือกระดับ") return rows;
  return rows.filter(row => {
    if (level === "ปวช.") return row.majorName.includes("ปวช.");
    if (level === "ปวส.") return row.majorName.includes("ปวส.");
    return true;
  });
}

function getFilteredRows() {
  let rows = [...termScoreRows];

  // กรองตาม department
  const department = document.getElementById("department").value;
  if (department && department !== "เลือกสาขา") {
    rows = rows.filter(r => r.majorName === department);
  }

  // กรองตาม level
  const level = document.getElementById("level").value;
  if (level && level !== "เลือกระดับ") {
    if (level === "ปวช.") rows = rows.filter(r => r.majorName.includes("ปวช."));
    else if (level === "ปวส.") rows = rows.filter(r => r.majorName.includes("ปวส."));
  }

  // กรองตามชื่อ
  const name = document.querySelector('input[type="text"]').value.toLowerCase();
  if (name) {
    rows = rows.filter(r => r.studentName.toLowerCase().includes(name));
  }

  return rows;
}
function renderFilteredTable() {
  const filtered = getFilteredRows();
  const tbody = document.getElementById("score-body");
  tbody.innerHTML = filtered.map(row => `
    <tr>
      <td>${row.student_id}</td>
      <td>${row.studentName}</td>
      <td>${row.majorName}</td>
      <td>${row.advisors}</td>
      <td>${row.attendedActivity}</td>
      <td>${row.internshipActivity}</td>
      <td>${row.exActivity}</td>
      <td>${row.exInternship}</td>
      <td>${row.activityResult}</td>
      <td>${row.internshipResult}</td>
    </tr>
  `).join("");
}

document.getElementById("department").addEventListener("change", renderFilteredTable);
document.getElementById("level").addEventListener("change", renderFilteredTable);
document.querySelector('input[type="text"]').addEventListener("input", renderFilteredTable);
// เรียกใช้ฟังก์ชันเพื่อแสดงตารางเมื่อโหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded",async() => {
    await fetchTermScore();
});