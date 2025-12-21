<?php
// api_get_activities.php
header('Content-Type: application/json');
require_once 'db.php';

try {
    // รับค่า student_id (ref_id) ที่ส่งมา (ถ้าต้องการกรองเฉพาะของคนนั้น)
    $student_id = $_GET['student_id'] ?? null;

    $sql = "SELECT 
                a.*,
                c.year, c.class_number,
                m.name as major_name, m.level as major_level
            FROM activity a
            LEFT JOIN class c ON a.class_id = c.id
            LEFT JOIN major m ON a.major_id = m.id
            LEFT JOIN class cm ON c.major_id = m.id 
            -- (เผื่อกรณี a.major_id เป็น null แต่ไปผูกกับ class)
            ORDER BY a.start_time ASC";

    // หมายเหตุ: ถ้าต้องการกรองเฉพาะกิจกรรมที่นักเรียนคนนี้มีชื่อใน activity_check
    // ต้อง Join กับ activity_check เพิ่มเติม

    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // จัดโครงสร้างข้อมูลให้เหมือน Supabase เดิม เพื่อให้แก้ JS น้อยที่สุด
    $formattedData = [];
    foreach ($activities as $row) {
        $formattedData[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'is_recurring' => $row['is_recurring'],
            'activity_type' => $row['activity_type'],
            'class' => [
                'id' => $row['class_id'],
                'year' => $row['year'],
                'class_number' => $row['class_number'],
                'major' => [
                    'name' => $row['major_name'],
                    'level' => $row['major_level']
                ]
            ]
        ];
    }

    echo json_encode($formattedData);

} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>