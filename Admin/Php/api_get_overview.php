<?php
// api_get_overview.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

try {
    // Query นี้จะดึงกิจกรรม + ข้อมูล Class + นับจำนวนการเช็คชื่อ (Total & Attended)
    $sql = "SELECT 
                a.id, 
                a.name, 
                a.start_time, 
                a.end_time,
                c.class_name, 
                c.year, 
                c.class_number,
                m.name AS major_name, 
                m.level AS major_level,
                
                -- นับจำนวนนักเรียนทั้งหมดในกิจกรรมนี้
                COUNT(ac.id) AS total_students,
                
                -- นับจำนวนคนที่สถานะเป็น 'Attended'
                SUM(CASE WHEN ac.status = 'Attended' THEN 1 ELSE 0 END) AS attended_count,
                
                -- เช็คว่ามีการเริ่มเช็คชื่อไปบ้างหรือยัง (ถ้ามี status ไม่เป็น null เลย แสดงว่าเริ่มแล้ว)
                SUM(CASE WHEN ac.status IS NOT NULL THEN 1 ELSE 0 END) AS checked_count

            FROM activity a
            LEFT JOIN class c ON a.class_id = c.id
            LEFT JOIN major m ON c.major_id = m.id
            LEFT JOIN activity_check ac ON a.id = ac.activity_id
            GROUP BY a.id, a.name, a.start_time, a.end_time, c.class_name, c.year, c.class_number, m.name, m.level
            ORDER BY a.start_time DESC"; // เรียงจากใหม่ไปเก่า

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // แปลงข้อมูลตัวเลขให้เป็น Int เพื่อความปลอดภัยใน JS
    $formatted = array_map(function($row) {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'major_name' => $row['major_name'],
            'major_level' => $row['major_level'],
            'year' => $row['year'],
            'class_number' => $row['class_number'],
            'class_name' => $row['class_name'],
            'total_students' => (int)$row['total_students'],
            'attended_count' => (int)$row['attended_count'],
            'checked_count'  => (int)$row['checked_count']
        ];
    }, $results);

    echo json_encode($formatted, JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>