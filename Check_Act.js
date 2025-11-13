// เปลี่ยน YOUR_SUPABASE_URL และ YOUR_SUPABASE_ANON_KEY ด้วยค่าจริงของคุณ
const SUPABASE_URL = 'https://pdqzkejlefozxquptoco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcXprZWpsZWZvenhxdXB0b2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDIyODAsImV4cCI6MjA3NzkxODI4MH0.EojnxNcGPj7eGlf7FAJOgMuEXIW54I2NQwB_L2Wj9DU'; // Key ของคุณ

// สร้าง Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
async function fetchActivities(){
    const { data: activities, error } = await supabaseClient
            .from('activity')
            .select(`
                id,
                name,
                start_time,
                end_time,
                is_recurring,
                major:major_id (name, level),
                check:activity_check (id,student_id,status,date
            )
            `)
            .order('start_time', { ascending: true });
        if (error) {
            console.error('Error fetching activities:', error.message);
            container.innerHTML = '<p>ไม่สามารถดึงรายการกิจกรรมได้</p>';
            return;
        }
        alert(`ดึงข้อมูลกิจกรรมสำเร็จ! พบทั้งหมด ${activities.length} กิจกรรม`);

    console.log('Activities:', activities);
}
document.addEventListener('DOMContentLoaded', async () => {
    await fetchActivities();
});
