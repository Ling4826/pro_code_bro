<?php

require 'db.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

switch ($action) {

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
        http_response_code(400);
        echo json_encode(['message' => 'Invalid action']);
        break;
}

/* =====================================================
   FUNCTIONS
   ===================================================== */

function getMajors(PDO $pdo)
{
    try {
        $stmt = $pdo->query("
            SELECT id, name, level
            FROM major
            ORDER BY level, name
        ");
        echo json_encode($stmt->fetchAll());
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => $e->getMessage()
        ]);
    }
}


function getClasses(PDO $pdo)
{
    $level   = $_GET['level']   ?? null;
    $majorId = $_GET['majorId'] ?? null;
    $year    = $_GET['year']    ?? null;

    $sql = "
        SELECT c.id, c.class_name
        FROM class c
        JOIN major m ON c.major_id = m.id
        WHERE 1 = 1
    ";

    $params = [];

    if (!empty($majorId)) {
        $sql .= " AND c.major_id = ?";
        $params[] = (int)$majorId;
    } elseif (!empty($level)) {
        $sql .= " AND m.level = ?";
        $params[] = $level;
    }

    if (!empty($year)) {
        $sql .= " AND c.year = ?";
        $params[] = (int)$year;
    }

    $sql .= " ORDER BY c.class_name";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode($stmt->fetchAll());
}

function createActivity(PDO $pdo)
{
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid JSON']);
        return;
    }

    // basic validation
    $required = ['activityName','activityType','activityDate','startTime','endTime','semester','classId'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['message' => "Missing field: {$field}"]);
            return;
        }
    }

    $pdo->beginTransaction();

    try {
        // -----------------------------
        // 1. Insert activity
        // -----------------------------
        $stmt = $pdo->prepare("
            INSERT INTO activity
            (
                name,
                activity_type,
                start_time,
                end_time,
                class_id,
                for_student,
                for_leader,
                for_teacher,
                is_recurring,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, 1, 1, 0, ?, 1)
        ");

        $start = "{$data['activityDate']} {$data['startTime']}";
        $end   = "{$data['activityDate']} {$data['endTime']}";

        $stmt->execute([
            $data['activityName'],
            $data['activityType'],
            $start,
            $end,
            (int)$data['classId'],
            !empty($data['recurringDays']) ? 1 : 0
        ]);

        $activityId = $pdo->lastInsertId();

        // -----------------------------
        // 2. Get students in class
        // -----------------------------
        $stmt = $pdo->prepare("
            SELECT id
            FROM student
            WHERE class_id = ?
        ");
        $stmt->execute([(int)$data['classId']]);
        $students = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (count($students) === 0) {
            throw new Exception('ไม่พบนักเรียนในห้องนี้');
        }

        // -----------------------------
        // 3. Insert activity_check
        // -----------------------------
        $academicYear = date('Y') + 543;

        $stmt = $pdo->prepare("
            INSERT INTO activity_check
            (
                activity_id,
                student_id,
                status,
                date,
                semester,
                academic_year
            )
            VALUES (?, ?, NULL, ?, ?, ?)
        ");

        foreach ($students as $studentId) {
            $stmt->execute([
                $activityId,
                $studentId,
                $data['activityDate'],
                (int)$data['semester'],
                $academicYear
            ]);
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'activity_id' => $activityId,
            'student_count' => count($students)
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            'message' => $e->getMessage()
        ]);
    }
}
