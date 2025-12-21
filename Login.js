/* JavaScript/Login.js (เวอร์ชัน XAMPP / PHP) */

const loginForm = document.getElementById('login');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); 

    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const submitBtn = loginForm.querySelector('button');

    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'กำลังตรวจสอบ...';
    submitBtn.disabled = true;

    try {
        // --- ส่งข้อมูลไปที่ login.php ---
        const response = await fetch('login.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: usernameInput,
                password: passwordInput
            })
        });

        if (!response.ok) {
            throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อ Server');
        }

        const result = await response.json();

        // --- ตรวจสอบผลลัพธ์จาก PHP ---
        if (result.status === 'success') {
            // ✅ Login สำเร็จ
            console.log("Login Success:", result);
            
            const userRole = result.role;
            const userName = result.name;
            const refId = result.ref_id;

            // บันทึก Session
            sessionStorage.setItem('is_logged_in', 'true'); 
            sessionStorage.setItem('user_role', userRole); 
            sessionStorage.setItem('user_name', userName);
            if (refId) sessionStorage.setItem('ref_id', refId);

            alert(`ยินดีต้อนรับ: ${userName} (${userRole})`);

            // เปลี่ยนหน้า (Routing)
            const roleCheck = userRole.toLowerCase();
            if (roleCheck === 'admin') {
                window.location.href = 'Admin/Home.html';
            } else if (roleCheck === 'teacher') {
                window.location.href = 'Teacher/Home.html';
            } else if (roleCheck === 'leader') {
                window.location.href = 'Leader/Home.html'; 
            } else { 
                window.location.href = 'Student/Home.html';
            }

        } else {
            // ❌ Login ไม่สำเร็จ (PHP ส่ง status error มา)
            throw new Error(result.message || "ข้อมูลไม่ถูกต้อง");
        }

    } catch (err) {
        console.error(err);
        alert('เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
});