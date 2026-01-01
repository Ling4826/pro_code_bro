<?php
// PHP/db.php
header("Access-Control-Allow-Origin: *"); // เพิ่มบรรทัดนี้กันเหนียว
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$host = 'localhost';
$db_name = 'pbntc_db'; // ต้องตรงกับชื่อ Database ในข้อ 2
$username = 'root';    // XAMPP ปกติ user คือ root
$password = '';        // XAMPP ปกติ password คือค่าว่าง

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    // ส่ง Error เป็น JSON เพื่อให้ JS อ่านรู้เรื่อง
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}
?>