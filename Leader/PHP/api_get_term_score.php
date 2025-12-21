<?php
// api_get_term_score.php
header('Content-Type: application/json');
require_once 'db.php';

try {
    // ดึงข้อมูล term_score + student + class + major + activity_check
    // เนื่องจากโครงสร้าง Supabase ซับซ้อน (Nested JSON) แต่ PHP จะดึงแบบ Flat Table (JOIN)
    // เราจะดึงข้อมูลหลักมาก่อน แล้วค่อยไปหา activity_check แยก หรือดึงรวมกันแล้วมาวนลูป
    
    // เพื่อประสิทธิภาพใน PHP เราจะดึงข้อมูลที่สรุปมาแล้วจาก term_score ตรงๆ
    // (สมมติว่าตาราง term_score มีข้อมูลครบ หรือถ้าจะคำนวณสดต้อง Query อีกแบบ)
    
    $sql = "SELECT 
                ts.*,
                s.name as student_name, s.id as student_code,
                c.year, c.class_number,
                m.name as major_name, m.level as major_level
            FROM term_score ts
            JOIN student s ON ts.student_id = s.id
            JOIN class c ON s.class_id = c.id
            JOIN major m ON c.major_id = m.id
            ORDER BY ts.academic_year DESC, ts.semester DESC";

    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // แต่หน้าเว็บต้องการ Detail การเข้าแถว/กิจกรรม (จำนวนครั้ง) ซึ่งอยู่ใน activity_check
    // เราต้องดึง activity_check ของนักเรียนแต่ละคนมาคำนวณเพิ่ม (หรือทำ Subquery)
    
    // เพื่อความง่าย ผมจะจำลองโครงสร้างให้เหมือนที่ JS คุณรอรับ
    $finalData = [];
    
    foreach ($results as $row) {
        // หาจำนวนครั้งที่เข้าแถวและกิจกรรมของนักเรียนคนนี้
        $sqlCount = "SELECT 
                        SUM(CASE WHEN a.activity_type = 'flag_ceremony' THEN 1 ELSE 0 END) as flag_total,
                        SUM(CASE WHEN a.activity_type = 'flag_ceremony' AND ac.status = 'Attended' THEN 1 ELSE 0 END) as flag_attended,
                        SUM(CASE WHEN a.activity_type = 'activity' THEN 1 ELSE 0 END) as dept_total,
                        SUM(CASE WHEN a.activity_type = 'activity' AND ac.status = 'Attended' THEN 1 ELSE 0 END) as dept_attended
                     FROM activity_check ac
                     JOIN activity a ON ac.activity_id = a.id
                     WHERE ac.student_id = :sid AND ac.semester = :sem AND ac.academic_year = :year";
        
        $stmtCount = $conn->prepare($sqlCount);
        $stmtCount->execute([
            ':sid' => $row['student_id'], 
            ':sem' => $row['semester'], 
            ':year' => $row['academic_year']
        ]);
        $counts = $stmtCount->fetch(PDO::FETCH_ASSOC);

        $finalData[] = [
            'id' => $row['id'],
            'semester' => $row['semester'],
            'academic_year' => $row['academic_year'],
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
                // ส่งข้อมูลจำนวนครั้งไปด้วย เพื่อให้ JS คำนวณ % ได้
                'counts' => $counts 
            ]
        ];
    }

    echo json_encode($finalData);

} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>