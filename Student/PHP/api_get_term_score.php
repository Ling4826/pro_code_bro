<?php
// api_get_term_score.php
header('Content-Type: application/json');
require_once 'db.php';

try {
    // 1. รับค่า student_id ที่ส่งมาจาก JS (เพื่อกรองเฉพาะคนนั้น)
    $student_id = $_GET['student_id'] ?? null;

    // 2. เตรียม SQL (เพิ่ม WHERE student_id)
    // หมายเหตุ: ต้องมีตาราง term_score ใน Database ด้วยนะครับ
    $sql = "SELECT 
                ts.*,
                s.name as student_name, s.id as student_code,
                c.year, c.class_number,
                m.name as major_name, m.level as major_level
            FROM term_score ts
            JOIN student s ON ts.student_id = s.id
            JOIN class c ON s.class_id = c.id
            JOIN major m ON c.major_id = m.id";

    if ($student_id) {
        $sql .= " WHERE ts.student_id = :sid";
    }

    $sql .= " ORDER BY ts.academic_year DESC, ts.semester DESC";

    $stmt = $conn->prepare($sql);
    
    if ($student_id) {
        $stmt->bindParam(':sid', $student_id);
    }
    
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $finalData = [];

    foreach ($results as $row) {
        // ดึงข้อมูลการนับ (Attendance Counts) จาก activity_check
        $sqlCount = "SELECT 
                        COUNT(*) as dept_total,
                        SUM(CASE WHEN ac.status = 'Attended' THEN 1 ELSE 0 END) as dept_attended
                     FROM activity_check ac
                     JOIN activity a ON ac.activity_id = a.id
                     WHERE ac.student_id = :sid 
                       AND ac.semester = :sem 
                       AND ac.academic_year = :year";
        
        $stmtCount = $conn->prepare($sqlCount);
        $stmtCount->execute([
            ':sid' => $row['student_code'], // ใช้ student_code จากตาราง student
            ':sem' => $row['semester'], 
            ':year' => $row['academic_year']
        ]);
        $counts = $stmtCount->fetch(PDO::FETCH_ASSOC);

        // จัด Format JSON ให้ JS เอาไปใช้ง่ายๆ
        $finalData[] = [
            'id' => $row['id'],
            'semester' => $row['semester'],
            'academic_year' => $row['academic_year'],
            'flag_percent' => $row['flag_percent'],     // คะแนนกิจกรรมหน้าเสาธง
            'activity_percent' => $row['activity_percent'], // คะแนนกิจกรรมชมรม/แผนก
            'result' => $row['result'],                 // ผลการประเมิน (ผ่าน/ไม่ผ่าน)
            'student' => [
                'id' => $row['student_code'],
                'name' => $row['student_name'],
                'class' => [
                    'year' => $row['year'],
                    'class_number' => $row['class_number'],
                    'major' => [
                        'name' => $row['major_name'],
                        'level' => $row['major_level']
                    ]
                ],
                // ส่งข้อมูลจำนวนครั้งไปด้วย
                'counts' => $counts 
            ]
        ];
    }

    echo json_encode($finalData);

} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>