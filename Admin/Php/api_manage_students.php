<?php
// api_manage_students.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

try {
    // ==================================================
    // 1. GET: ดึงข้อมูล (Majors / Classes / Students)
    // ==================================================
    if ($method === 'GET') {
        
        // A. ดึงสาขา (สำหรับ Dropdown)
        if ($action === 'get_majors') {
            $stmt = $pdo->query("SELECT id, name, level FROM major ORDER BY level, name");
            echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        // B. ดึงห้องเรียน (สำหรับ Dropdown)
        if ($action === 'get_classes') {
            $sql = "SELECT c.id, c.year, c.class_number, c.major_id 
                    FROM class c 
                    JOIN major m ON c.major_id = m.id";
            // (คุณอาจเพิ่ม WHERE กรองตาม level ได้ถ้าต้องการ แต่ดึงหมดแล้วไป Filter หน้าบ้านก็ได้ถ้าข้อมูลไม่เยอะ)
            $stmt = $pdo->query($sql);
            echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        // C. ดึงรายชื่อนักเรียน (Search/Filter)
        if ($action === 'get_students') {
            $majorName = $_GET['majorName'] ?? '';
            $level     = $_GET['level'] ?? '';
            $year      = $_GET['year'] ?? '';
            $classNum  = $_GET['classNumber'] ?? '';

            $sql = "SELECT s.id, s.name, s.role,
                           c.id as class_id, c.year, c.class_number,
                           m.name as major_name, m.level as major_level
                    FROM student s
                    JOIN class c ON s.class_id = c.id
                    JOIN major m ON c.major_id = m.id
                    WHERE 1=1 ";
            
            $params = [];

            if ($majorName) {
                $sql .= " AND m.name = ?";
                $params[] = $majorName;
            }
            if ($level) {
                $sql .= " AND m.level = ?";
                $params[] = $level;
            }
            if ($year) {
                $sql .= " AND c.year = ?";
                $params[] = $year;
            }
            if ($classNum) {
                $sql .= " AND c.class_number = ?";
                $params[] = $classNum;
            }

            $sql .= " ORDER BY s.id ASC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }
    }

    // ==================================================
    // 2. POST: อัปเดต Role (Student <-> Leader)
    // ==================================================
    if ($method === 'POST' && $action === 'update_role') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $studentId = $input['studentId'] ?? '';
        $newRole   = $input['role'] ?? 'Student'; // 'Student' or 'Leader'

        if (!$studentId) throw new Exception('ไม่พบรหัสนักศึกษา');

        // ตรวจสอบโควต้าหัวหน้าห้อง (ถ้าจะเปลี่ยนเป็น Leader)
        if ($newRole === 'Leader') {
            // 1. หา class_id ของนักเรียนคนนี้ก่อน
            $stmtClass = $pdo->prepare("SELECT class_id FROM student WHERE id = ?");
            $stmtClass->execute([$studentId]);
            $classId = $stmtClass->fetchColumn();

            if ($classId) {
                // 2. นับจำนวน Leader ในห้องนั้น (ไม่รวมตัวเอง)
                $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM student WHERE class_id = ? AND role = 'Leader' AND id != ?");
                $stmtCount->execute([$classId, $studentId]);
                $leaderCount = $stmtCount->fetchColumn();

                if ($leaderCount >= 2) {
                    throw new Exception("ห้องเรียนนี้เต็มโควต้าหัวหน้าแล้ว (จำกัด 2 คน)");
                }
            }
        }

        // อัปเดตข้อมูล
        $sql = "UPDATE student SET role = ? WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$newRole, $studentId]);

        echo json_encode(['status' => 'success', 'message' => 'อัปเดตสถานะเรียบร้อยแล้ว']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500); // Server Error
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>