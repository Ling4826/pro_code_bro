<?php
// PHP/api_activity_actions.php
header('Content-Type: application/json; charset=utf-8');

// 1. อนุญาต CORS (สำคัญมาก)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// จัดการ Preflight Request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';

$input = json_decode(file_get_contents('php://input'), true);
$method = $_SERVER['REQUEST_METHOD'];

try {
    // ตรวจสอบว่าเป็น POST และ action คือ delete
    if ($method === 'POST' && isset($input['action']) && $input['action'] === 'delete') {
        
        $activityId = $input['id'] ?? null;
        if (!$activityId) {
            throw new Exception('ไม่พบรหัสกิจกรรม (Missing ID)');
        }

        $pdo->beginTransaction();

        // 1. ลบข้อมูลใน activity_check ก่อน (ลูก)
        $stmtCheck = $pdo->prepare("DELETE FROM activity_check WHERE activity_id = ?");
        $stmtCheck->execute([$activityId]);

        // 2. ลบข้อมูลใน activity (แม่)
        $stmtActivity = $pdo->prepare("DELETE FROM activity WHERE id = ?");
        $stmtActivity->execute([$activityId]);

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'ลบกิจกรรมเรียบร้อยแล้ว']);
        exit;
    }

    // ถ้าไม่ใช่คำสั่ง delete
    throw new Exception('Invalid action or method');

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>