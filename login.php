<?php
// login.php
header('Content-Type: application/json');

// 1. ตั้งค่าการเชื่อมต่อฐานข้อมูล XAMPP
$host = 'localhost';
$db_name = 'pbntc_db'; // ชื่อฐานข้อมูลที่คุณตั้งใน phpMyAdmin
$username = 'root';    // ค่า default ของ XAMPP คือ root
$password = '';        // ค่า default ของ XAMPP คือว่างไว้

try {
    $conn = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Connection failed: ' . $e->getMessage()]);
    exit();
}

// 2. รับข้อมูลที่ส่งมาจาก JavaScript
$data = json_decode(file_get_contents("php://input"));

if (!$data) {
    echo json_encode(['status' => 'error', 'message' => 'No data received']);
    exit();
}

$userInput = $data->username;
$passInput = $data->password;

// 3. ตรวจสอบว่าเป็น "นักเรียน" หรือไม่?
// (เช็ค id คู่กับ citizen_id)
$stmt = $conn->prepare("SELECT * FROM student WHERE id = :id AND citizen_id = :citizen_id");
$stmt->bindParam(':id', $userInput);
$stmt->bindParam(':citizen_id', $passInput);
$stmt->execute();
$student = $stmt->fetch(PDO::FETCH_ASSOC);

if ($student) {
    // เจอเป็นนักเรียน
    echo json_encode([
        'status' => 'success',
        'role' => $student['role'] ?? 'Student', // ถ้าไม่มี role ใน DB ให้เป็น Student
        'name' => $student['name'],
        'ref_id' => $student['id']
    ]);
    exit();
}

// 4. ถ้าไม่ใช่ ให้ตรวจสอบว่าเป็น "อาจารย์/เจ้าหน้าที่" หรือไม่?
// (เช็ค username คู่กับ ref_id ตาม Logic เดิมของคุณ)
$stmt = $conn->prepare("SELECT * FROM user_account WHERE username = :username AND ref_id = :ref_id");
$stmt->bindParam(':username', $userInput);
$stmt->bindParam(':ref_id', $passInput);
$stmt->execute();
$account = $stmt->fetch(PDO::FETCH_ASSOC);

if ($account) {
    // เจอเป็นเจ้าหน้าที่
    echo json_encode([
        'status' => 'success',
        'role' => $account['role'],
        'name' => $account['username'],
        'ref_id' => $account['ref_id']
    ]);
    exit();
}

// 5. ไม่เจออะไรเลย
echo json_encode(['status' => 'error', 'message' => 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง']);
?>