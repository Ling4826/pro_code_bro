<?php
// PHP/api_get_activities.php
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
require_once 'db.php';

try {
    // ดึงข้อมูลกิจกรรม + Class + Major
    $sql = "SELECT 
                a.*,
                c.year, c.class_number,
                m.name AS major_name, m.level AS major_level
            FROM activity a
            LEFT JOIN class c ON a.class_id = c.id
            LEFT JOIN major m ON c.major_id = m.id
            ORDER BY a.start_time DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // จัดโครงสร้าง JSON ให้ตรงกับที่ JS ต้องการ (Nested Object)
    $data = array_map(function($row) {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'is_recurring' => $row['is_recurring'],
            'activity_type' => $row['activity_type'],
            // JS บรรทัด 135-136 ต้องการ structure แบบนี้: activity.class.major.name
            'class' => [
                'year' => $row['year'],
                'class_number' => $row['class_number'],
                'major' => [
                    'name' => $row['major_name'],
                    'level' => $row['major_level']
                ]
            ]
        ];
    }, $rows);

    echo json_encode($data);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>