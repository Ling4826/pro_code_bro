<?php
// db.php
$host = 'localhost';
$db_name = 'pbntc_db'; // ตรวจสอบชื่อ DB ให้ตรงกับใน phpMyAdmin
$username = 'root';
$password = '';

try {
    $conn = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}
?>