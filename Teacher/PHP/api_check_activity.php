<?php
// api_check_activity.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

// ==========================================
// 1. GET: ดึงข้อมูล
// ==========================================
if ($method === 'GET') {
    try {
        // แก้: ไม่ใช้ FILTER_VALIDATE_INT เพื่อรองรับ ID ที่อาจมาเป็น String
        $activity_id = $_GET['activity_id'] ?? null;
        
        if (!$activity_id) throw new Exception('Invalid Activity ID');

        // 1.1 ดึง Header
        $sqlActivity = "SELECT 
                            a.*,
                            c.class_name, c.year, c.class_number,
                            m.id as major_id, m.name as major_name, m.level as major_level
                        FROM activity a
                        LEFT JOIN class c ON a.class_id = c.id
                        LEFT JOIN major m ON c.major_id = m.id
                        WHERE a.id = :id";
        $stmt = $pdo->prepare($sqlActivity);
        $stmt->execute([':id' => $activity_id]);
        $activity = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$activity) throw new Exception('Activity not found');

        // 1.2 ดึง Table
        $sqlStudents = "SELECT 
                            ac.id as check_id,
                            ac.status,
                            s.id as student_id,
                            s.name as student_name
                        FROM activity_check ac
                        JOIN student s ON ac.student_id = s.id
                        WHERE ac.activity_id = :id
                        ORDER BY s.id ASC";
        
        $stmt = $pdo->prepare($sqlStudents);
        $stmt->execute([':id' => $activity_id]);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'status' => 'success',
            'activity' => $activity,
            'students' => $students
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
}

// ==========================================
// 2. POST: บันทึก
// ==========================================
if ($method === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $activityId = $input['activityId'] ?? null;
        if (!$activityId) throw new Exception('Missing Activity ID');
        
        $activityData = $input['activityData'] ?? [];
        $attendanceData = $input['attendanceData'] ?? [];

        $pdo->beginTransaction();

        // 2.1 Update Header
        if (!empty($activityData)) {
            $sqlMsg = "UPDATE activity SET 
                        name = :name, 
                        activity_type = :type, 
                        start_time = :start, 
                        end_time = :end, 
                        is_recurring = :recurring 
                       WHERE id = :id";
            
            $stmt = $pdo->prepare($sqlMsg);
            $stmt->execute([
                ':name' => $activityData['name'],
                ':type' => $activityData['activity_type'],
                ':start' => $activityData['start_time'], 
                ':end' => $activityData['end_time'],
                ':recurring' => isset($activityData['is_recurring']) ? $activityData['is_recurring'] : 0,
                ':id' => $activityId
            ]);
        }

        // 2.2 Update Detail
        if (!empty($attendanceData)) {
            $sqlUpdateCheck = "UPDATE activity_check SET status = :status WHERE id = :check_id";
            $stmtCheck = $pdo->prepare($sqlUpdateCheck);

            foreach ($attendanceData as $row) {
                $stmtCheck->execute([
                    ':status' => $row['status'],
                    ':check_id' => $row['check_id']
                ]);
            }
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Saved successfully']);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
}
?>