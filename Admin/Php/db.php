<?php
// 1. ตั้งค่าการเชื่อมต่อฐานข้อมูล XAMPP
$host = 'localhost';
$db_name = 'pbntc_db'; // ชื่อฐานข้อมูลที่คุณตั้งใน phpMyAdmin
$username = 'root';    // ค่า default ของ XAMPP คือ root
$password = '';        // ค่า default ของ XAMPP คือว่างไว้

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Connection failed: ' . $e->getMessage()]);
    exit();
}
?>