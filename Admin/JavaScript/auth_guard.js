/* auth_guard.js */

(function() {
    // 1. ตรวจสอบสถานะ Login จาก SessionStorage
    const isLoggedIn = sessionStorage.getItem('is_logged_in');
    
    // หน้าปัจจุบัน
    const currentPage = window.location.pathname;
    
    // ถ้ายังไม่ Login และไม่ได้อยู่ที่หน้า index.html (หน้า Login)
    if (isLoggedIn !== 'true' && !currentPage.includes('index.html')) {
        alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
        // ถอยกลับไปหน้า Login (ปรับ path ตาม structure จริงของคุณ)
        window.location.href = '../index.html'; 
    }
})();

// ฟังก์ชัน Logout
function logout() {
    if(confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
        sessionStorage.clear();
        window.location.href = '../index.html';
    }
}

// ผูกปุ่ม Logout อัตโนมัติ (ถ้ามีในหน้าเว็บ)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.logout, #logoutBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
});