<?php
// api_get_term_summary.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php'; // ไฟล์นี้ประกาศตัวแปร $pdo

try {
    // รับค่า Filter
    $semester = filter_input(INPUT_GET, 'semester', FILTER_VALIDATE_INT);
    $year = filter_input(INPUT_GET, 'year', FILTER_SANITIZE_STRING);

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
            LEFT JOIN activity_check ac ON s.id = ac.student_id
            LEFT JOIN activity a ON ac.activity_id = a.id
            WHERE 1=1 ";

    $params = [];

    if ($year) {
        $sql .= " AND ac.academic_year = ?";
        $params[] = $year;
    }
    if ($semester) {
        $sql .= " AND ac.semester = ?";
        $params[] = $semester;
    }

    $sql .= " GROUP BY s.id, s.name, c.year, c.class_number, m.name, m.level";
    
    // 🔥 แก้ไขจุดผิด: เปลี่ยน $conn เป็น $pdo ให้ตรงกับ db.php
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($results, JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
} catch (Exception $e) {
    // ดักจับ Error อื่นๆ ทั่วไป
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>