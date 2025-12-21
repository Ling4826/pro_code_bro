<?php
// api_get_activity_detail.php
header('Content-Type: application/json');
require_once 'db.php';

$activity_id = $_GET['id'] ?? null;

if (!$activity_id) {
    echo json_encode(['status' => 'error', 'message' => 'No activity ID provided']);
    exit();
}

try {
    // 1. ดึงรายละเอียดกิจกรรม
    $sqlActivity = "SELECT 
                        a.*, 
                        c.year, c.class_number, 
                        m.id as major_id, m.name as major_name, m.level as major_level
                    FROM activity a
                    LEFT JOIN class c ON a.class_id = c.id
                    LEFT JOIN major m ON c.major_id = m.id
                    WHERE a.id = :id";
    $stmt = $conn->prepare($sqlActivity);
    $stmt->bindParam(':id', $activity_id);
    $stmt->execute();
    $activity = $stmt->fetch(PDO::FETCH_ASSOC);

    // 2. ดึงรายชื่อเช็คชื่อ (Activity Check)
    $sqlCheck = "SELECT 
                    ac.id, ac.status, ac.date, ac.semester, ac.academic_year,
                    s.id as student_id, s.name as student_name
                 FROM activity_check ac
                 JOIN student s ON ac.student_id = s.id
                 WHERE ac.activity_id = :id
                 ORDER BY s.id ASC";
    $stmtCheck = $conn->prepare($sqlCheck);
    $stmtCheck->bindParam(':id', $activity_id);
    $stmtCheck->execute();
    $checks = $stmtCheck->fetchAll(PDO::FETCH_ASSOC);

    // จัดโครงสร้างให้ JS ใช้ง่าย
    $response = [
        'activity' => [
            'id' => $activity['id'],
            'name' => $activity['name'],
            'activity_type' => $activity['activity_type'],
            'start_time' => $activity['start_time'],
            'end_time' => $activity['end_time'],
            'is_recurring' => $activity['is_recurring'],
            'class_id' => $activity['class_id'],
            'class' => [
                'year' => $activity['year'],
                'class_number' => $activity['class_number'],
                'major' => [
                    'id' => $activity['major_id'],
                    'name' => $activity['major_name'],
                    'level' => $activity['major_level']
                ]
            ]
        ],
        'checks' => $checks
    ];

    echo json_encode($response);

} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>