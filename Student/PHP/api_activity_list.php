<?php
// ไฟล์: PHP/api_activity_list.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

try {
    // รับค่าตัวกรอง
    $studentId = filter_input(INPUT_GET, 'student_id', FILTER_SANITIZE_STRING); // <--- รับรหัสนักเรียน
    
    $search = filter_input(INPUT_GET, 'search', FILTER_SANITIZE_STRING);
    $level = filter_input(INPUT_GET, 'level', FILTER_SANITIZE_STRING);
    $majorId = filter_input(INPUT_GET, 'major_id', FILTER_VALIDATE_INT);
    $classYear = filter_input(INPUT_GET, 'class_year', FILTER_VALIDATE_INT);
    $classRoom = filter_input(INPUT_GET, 'class_room', FILTER_VALIDATE_INT);

    // SQL เริ่มต้น
    $sql = "SELECT 
                a.id,
                a.name,
                a.activity_type,
                a.start_time,
                a.end_time,
                a.class_id,
                a.is_recurring,
                c.class_name,
                c.class_number,
                c.year,
                m.name as major_name,
                m.level as major_level
            FROM activity a
            LEFT JOIN class c ON a.class_id = c.id
            LEFT JOIN major m ON c.major_id = m.id
            WHERE 1=1 ";

    $params = [];

    // --- กรณีระบุตัวตนว่าเป็นนักเรียน (student_id) ---
    if (!empty($studentId)) {
        // 1. หาห้องเรียนของนักเรียนคนนั้นก่อน
        $stmtStudent = $pdo->prepare("SELECT class_id FROM student WHERE id = ?");
        $stmtStudent->execute([$studentId]);
        $studentClassId = $stmtStudent->fetchColumn();

        if ($studentClassId) {
            // 2. กรองเฉพาะ: กิจกรรมห้องตัวเอง OR กิจกรรมส่วนกลาง (class_id IS NULL)
            $sql .= " AND (a.class_id = ? OR a.class_id IS NULL)";
            $params[] = $studentClassId;
        } else {
            // ถ้านักเรียนไม่มีห้อง (เช่น ข้อมูลผิดพลาด) ให้เห็นแค่กิจกรรมส่วนกลาง
            $sql .= " AND a.class_id IS NULL";
        }
    } 
    // --- กรณีไม่ได้ระบุ student_id (อาจารย์/Admin) ให้ใช้ตัวกรองปกติ ---
    else {
        if (!empty($level)) {
            $sql .= " AND (m.level = ? OR a.class_id IS NULL)";
            $params[] = $level;
        }
        if (!empty($majorId)) {
            $sql .= " AND (m.id = ? OR a.class_id IS NULL)";
            $params[] = $majorId;
        }
        if (!empty($classYear)) {
            $sql .= " AND (c.year = ? OR a.class_id IS NULL)";
            $params[] = $classYear;
        }
        if (!empty($classRoom)) {
            $sql .= " AND (c.class_number = ? OR a.class_id IS NULL)";
            $params[] = $classRoom;
        }
    }

    // ค้นหาชื่อกิจกรรม (ใช้ได้ทั้งนักเรียนและอาจารย์)
    if (!empty($search)) {
        $sql .= " AND a.name LIKE ?";
        $params[] = "%$search%";
    }

    // เรียงลำดับ: กิจกรรมล่าสุดขึ้นก่อน
    $sql .= " ORDER BY a.start_time DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['status' => 'success', 'data' => $activities]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>