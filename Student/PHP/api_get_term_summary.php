<?php
// PHP/api_get_term_summary.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

try {
    // 1. รับค่าตัวกรอง
    $studentId = filter_input(INPUT_GET, 'student_id', FILTER_SANITIZE_STRING); // รับรหัสนักเรียน (คนดู)
    
    $semester = filter_input(INPUT_GET, 'semester', FILTER_VALIDATE_INT);
    $year = filter_input(INPUT_GET, 'year', FILTER_SANITIZE_STRING);
    $level = filter_input(INPUT_GET, 'level', FILTER_SANITIZE_STRING);
    $majorId = filter_input(INPUT_GET, 'major_id', FILTER_VALIDATE_INT);
    $classYear = filter_input(INPUT_GET, 'class_year', FILTER_VALIDATE_INT);
    $classRoom = filter_input(INPUT_GET, 'class_room', FILTER_VALIDATE_INT);
    $search = filter_input(INPUT_GET, 'search', FILTER_SANITIZE_STRING);

    $params = [];

    // 2. เงื่อนไขสำหรับกิจกรรม (กรองปี/เทอม)
    $activityCondition = "";
    if ($year) {
        $activityCondition .= " AND ac.academic_year = ?";
        $params[] = $year;
    }
    if ($semester) {
        $activityCondition .= " AND ac.semester = ?";
        $params[] = $semester;
    }

    // 3. เริ่มเขียน SQL หลัก
    $sql = "SELECT 
                s.id AS student_id,
                s.name AS student_name,
                c.year AS class_year,
                c.class_number,
                m.name AS major_name,
                m.level AS major_level,
                
                COUNT(CASE WHEN a.activity_type = 'flag_ceremony' THEN 1 END) AS flag_total,
                COUNT(CASE WHEN a.activity_type = 'flag_ceremony' AND ac.status = 'Attended' THEN 1 END) AS flag_attended,

                COUNT(CASE WHEN a.activity_type = 'activity' THEN 1 END) AS dept_total,
                COUNT(CASE WHEN a.activity_type = 'activity' AND ac.status = 'Attended' THEN 1 END) AS dept_attended

            FROM student s
            LEFT JOIN class c ON s.class_id = c.id
            LEFT JOIN major m ON c.major_id = m.id
            
            -- JOIN ข้อมูลการเช็คชื่อ (ใส่เงื่อนไขปีเทอมตรงนี้ ข้อมูลนักเรียนจะได้ไม่หาย)
            LEFT JOIN activity_check ac ON s.id = ac.student_id $activityCondition
            LEFT JOIN activity a ON ac.activity_id = a.id
            
            WHERE 1=1 ";

    // 4. เงื่อนไขการกรอง (ส่วนสำคัญที่แก้ไข)
    
    // *** กรณีเป็นนักเรียนดู (มี student_id ส่งมา) ***
    if (!empty($studentId)) {
        // 4.1 หาห้องเรียนของนักเรียนคนนี้ก่อน
        $stmtClass = $pdo->prepare("SELECT class_id FROM student WHERE id = ?");
        $stmtClass->execute([$studentId]);
        $classId = $stmtClass->fetchColumn();

        if ($classId) {
            // 4.2 ถ้าเจอห้อง -> กรองนักเรียนทุกคนที่อยู่ห้องเดียวกัน (class_id ตรงกัน)
            $sql .= " AND s.class_id = ?";
            $params[] = $classId;
        } else {
            // 4.3 ถ้าไม่เจอห้อง (ข้อมูลผิดพลาด) -> ให้เห็นแค่ตัวเองไปก่อน
            $sql .= " AND s.id = ?";
            $params[] = $studentId;
        }
    }

    // ตัวกรองอื่นๆ (สำหรับอาจารย์)
    if (!empty($level)) {
        $sql .= " AND m.level = ?";
        $params[] = $level;
    }
    if (!empty($majorId)) {
        $sql .= " AND m.id = ?";
        $params[] = $majorId;
    }
    if (!empty($classYear)) {
        $sql .= " AND c.year = ?";
        $params[] = $classYear;
    }
    if (!empty($classRoom)) {
        $sql .= " AND c.class_number = ?";
        $params[] = $classRoom;
    }
    if (!empty($search)) {
        $sql .= " AND (s.name LIKE ? OR s.id LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    // 5. Group By และ Sort
    $sql .= " GROUP BY s.id, s.name, c.year, c.class_number, m.name, m.level";
    $sql .= " ORDER BY c.year ASC, c.class_number ASC, s.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($results, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>