<?php
// api_save_attendance.php
header('Content-Type: application/json');
require_once 'db.php';

// รับ JSON Data จาก JavaScript
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(['status' => 'error', 'message' => 'No data received']);
    exit();
}

try {
    $conn->beginTransaction();

    $date = $data['date'];
    $semester = $data['semester'];
    $academic_year = $data['academic_year'];
    $records = $data['records']; // Array ของ { id: recordId, status: 'Attended' }

    $sql = "UPDATE activity_check 
            SET status = :status, date = :date, semester = :semester, academic_year = :academic_year 
            WHERE id = :id";
    
    $stmt = $conn->prepare($sql);

    foreach ($records as $record) {
        $stmt->execute([
            ':status' => $record['status'],
            ':date' => $date,
            ':semester' => $semester,
            ':academic_year' => $academic_year,
            ':id' => $record['id']
        ]);
    }

    $conn->commit();
    echo json_encode(['status' => 'success', 'message' => 'Saved successfully']);

} catch (PDOException $e) {
    $conn->rollBack();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>