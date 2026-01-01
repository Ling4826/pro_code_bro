<?php
// Create_activities.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        // กรณี get_majors และ get_classes ไม่ได้ใช้แล้วแต่เก็บไว้ก็ได้ ไม่เสียหาย
        case 'get_majors':
            getMajors($pdo);
            break;
        case 'get_classes':
            getClasses($pdo);
            break;

        case 'create_activity':
            createActivity($pdo);
            break;

        default:
            throw new Exception('Invalid action parameter');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

// ------------------------------------------------------------------
// Functions
// ------------------------------------------------------------------

function getMajors($pdo) {
    $stmt = $pdo->prepare("SELECT id, name, level FROM major ORDER BY level, name");
    $stmt->execute();
    $majors = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['status' => 'success', 'data' => $majors]);
}

function getClasses($pdo) {
    // ฟังก์ชันนี้อาจไม่ได้ใช้แล้วถ้าเราเหมารวม แต่เก็บไว้กัน Error
    $level   = filter_input(INPUT_GET, 'level', FILTER_SANITIZE_STRING);
    $majorId = filter_input(INPUT_GET, 'majorId', FILTER_VALIDATE_INT);
    $year    = filter_input(INPUT_GET, 'year', FILTER_VALIDATE_INT);

    $sql = "SELECT c.id, c.class_name, c.class_number 
            FROM class c
            JOIN major m ON c.major_id = m.id
            WHERE 1=1";
    $params = [];

    if ($majorId) {
        $sql .= " AND c.major_id = ?";
        $params[] = $majorId;
    } elseif ($level) {
        $sql .= " AND m.level = ?";
        $params[] = $level;
    }

    if ($year) {
        $sql .= " AND c.year = ?";
        $params[] = $year;
    }

    $sql .= " ORDER BY c.class_number ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $classes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['status' => 'success', 'data' => $classes]);
}

function createActivity($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['activityName']) || empty($input['semester'])) {
        throw new Exception('กรุณากรอกข้อมูลชื่อกิจกรรมและเทอมให้ครบถ้วน');
    }

    $pdo->beginTransaction();

    try {
        // --- แก้ไขจุดที่ 1: ลบ created_by ออกจาก SQL ---
        $sql = "INSERT INTO activity 
                (name, activity_type, start_time, end_time, class_id, is_recurring) 
                VALUES (:name, :type, :start, :end, :class_id, :recurring)";
        
        $stmt = $pdo->prepare($sql);
        
        $date = $input['activityDate']; 
        $startTime = "{$date} {$input['startTime']}:00";
        $endTime   = "{$date} {$input['endTime']}:00";
        
        // รับค่า classId (ถ้าไม่มีให้เป็น NULL)
        $classId = !empty($input['classId']) ? $input['classId'] : null;

        $stmt->execute([
            ':name'       => $input['activityName'],
            ':type'       => $input['activityType'],
            ':start'      => $startTime,
            ':end'        => $endTime,
            ':class_id'   => $classId, 
            ':recurring'  => !empty($input['recurringDays']) ? 1 : 0
            // ลบ ':created_by' ออกไปแล้ว
        ]);

        $activityId = $pdo->lastInsertId();

        // 2. ดึงนักเรียน
        if ($classId) {
            // กรณีระบุห้อง
            $stmtUsers = $pdo->prepare("SELECT id FROM student WHERE class_id = ?");
            $stmtUsers->execute([$classId]);
        } else {
            // *** กรณีไม่ระบุห้อง (เหมารวมทั้งวิทยาลัย) ***
            $stmtUsers = $pdo->prepare("SELECT id FROM student");
            $stmtUsers->execute();
        }
        
        $students = $stmtUsers->fetchAll(PDO::FETCH_COLUMN);

        if (count($students) === 0) {
            throw new Exception("ไม่พบรายชื่อนักเรียนในระบบ");
        }

        // 3. สร้าง Activity Check (Bulk Insert)
        $sqlCheck = "INSERT INTO activity_check (activity_id, student_id, status, date, semester, academic_year) 
                     VALUES (?, ?, NULL, ?, ?, ?)";
        $stmtCheck = $pdo->prepare($sqlCheck);
        
        $academicYear = $input['academicYear'] ?? (date('Y') + 543);

        foreach ($students as $studentId) {
            $stmtCheck->execute([
                $activityId,
                $studentId,
                $date,
                $input['semester'],
                $academicYear
            ]);
        }

        $pdo->commit();
        echo json_encode([
            'status' => 'success', 
            'message' => "สร้างกิจกรรมสำเร็จ (เพิ่มนักเรียนทั้งหมด " . count($students) . " คน)"
        ]);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}
?>