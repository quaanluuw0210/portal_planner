/**
 * Trích xuất LMID (dãy số >= 10 ký tự) từ thẻ <a>
 */
function extractLmid(aElement) {
    if (!aElement) return null;
    if (aElement.getAttribute("lmid")) return aElement.getAttribute("lmid");
    if (aElement.dataset && aElement.dataset.lmid) return aElement.dataset.lmid;

    const onclick = aElement.getAttribute("onclick") || "";
    const href = aElement.getAttribute("href") || "";
    const targetText = `${onclick} ${href}`;

    const match = targetText.match(/\d{10,}/);
    return match ? match[0] : null;
}

/**
 * Parse chuỗi lịch thô dạng T2(3.5-5)-P.cs2:PMT_D201 hoặc T6(8.5-10)-P.Thông báo sau
 */
export function parseScheduleTime(scheduleRaw) {
    if (!scheduleRaw) return null;
    const cleanRaw = scheduleRaw.trim();
    if (!cleanRaw) return null;

    const pattern = /T(\d+)\(([\d\.]+)-([\d\.]+)\)(?:-(.+))?/;
    const match = cleanRaw.match(pattern);

    if (!match) return null;

    const day = parseInt(match[1], 10);
    const start_slot = parseFloat(match[2]);
    const end_slot = parseFloat(match[3]);
    let room = match[4] ? match[4].trim() : "Thông báo sau";
    if (room.startsWith("P.")) room = room.substring(2);

    const half_slots = [];
    for (let slot = start_slot; slot <= end_slot; slot += 0.5) {
        half_slots.push(Math.round(slot * 10) / 10);
    }

    return { day, start_slot, end_slot, room, half_slots };
}

/**
 * Gọi API Handler lấy JSON (Fetch cả LopBaiTap lẫn LopThucHanh)
 */
async function fetchLopSubGroup(lmid) {
    if (!lmid) return [];

    const urlBT = `/Modules/SVDangKyHocPhan/HandlerSVDKHP.ashx?method=LopBaiTap&lmid=${lmid}&dot=1`;
    const urlTH = `/Modules/SVDangKyHocPhan/HandlerSVDKHP.ashx?method=LopThucHanh&lmid=${lmid}&dot=1`;

    try {
        // Gửi song song 2 request cho cả Bài Tập và Thực Hành
        const [resBT, resTH] = await Promise.allSettled([
            fetch(urlBT).then(r => r.json()),
            fetch(urlTH).then(r => r.json())
        ]);

        const jsonBT = resBT.status === "fulfilled" ? resBT.value : {};
        const jsonTH = resTH.status === "fulfilled" ? resTH.value : {};

        // Gộp kết quả từ cả LopMoBTs và LopMoTHs
        const rawList = [
            ...(jsonBT.LopMoBTs || jsonBT.LopMoTHs || (Array.isArray(jsonBT) ? jsonBT : [])),
            ...(jsonTH.LopMoTHs || jsonTH.LopMoBTs || (Array.isArray(jsonTH) ? jsonTH : []))
        ];

        // Lọc trùng theo Mã Nhóm (Tránh trường hợp 1 API trả về lặp)
        const uniqueItems = [];
        const seenGroups = new Set();

        for (const item of rawList) {
            const groupCode = item.Nhom || item.TenNhom || "";
            if (groupCode && !seenGroups.has(groupCode)) {
                seenGroups.add(groupCode);
                uniqueItems.push(item);
            }
        }

        return uniqueItems.map(item => {
            const rawSchedule = item.LichHoc || "";
            const rawMax = String(item.SiSo || "0").replace(/[^\d]/g, "");
            const rawEnrolled = String(item.DaDK || item.DangKy || "0").replace(/[^\d]/g, "");

            return {
                group_code: item.Nhom || item.TenNhom || "NhomPhu",
                max_capacity: parseInt(rawMax, 10) || 0,
                current_enrolled: parseInt(rawEnrolled, 10) || 0,
                schedule_raw: rawSchedule,
                schedule: parseScheduleTime(rawSchedule)
            };
        }).filter(item => item.schedule !== null);

    } catch (err) {
        console.warn("Lỗi fetch JSON cho lmid:", lmid, err);
        return [];
    }
}

export async function parsePortalTable(doc = document) {
    const rows = doc.querySelectorAll("tr");
    const rawCoursePromises = [];

    for (const row of rows) {
        const cols = row.querySelectorAll("td");
        if (cols.length < 11) continue;

        const course_code = cols[0].textContent.trim();
        if (!course_code || course_code.includes("Mã") || course_code === "Mã MH") continue;

        const course_name = cols[1].textContent.trim();
        const class_code = cols[2].textContent.trim(); // Ví dụ: 24_5
        const credits = parseInt(cols[3].textContent.trim(), 10) || 0;
        const max_capacity = parseInt(cols[4].textContent.trim(), 10) || 0;
        const current_enrolled = parseInt(cols[5].textContent.trim(), 10) || 0;

        if (max_capacity > 0 && current_enrolled >= max_capacity) continue;

        const schedule_raw_lt = cols[7].textContent.trim();
        const lt_schedule = parseScheduleTime(schedule_raw_lt);

        if (!lt_schedule) continue;

        // Bắt LMID ở cột TH (8) hoặc BT (9)
        const subLink = cols[8]?.querySelector("a") || cols[9]?.querySelector("a");
        const lmid = extractLmid(subLink);

        rawCoursePromises.push((async () => {
            let subGroups = [];
            if (lmid) {
                subGroups = await fetchLopSubGroup(lmid);
            }

            // NẾU CÓ NHÓM PHỤ (BT/TH) -> Gom thành danh sách tổ hợp gắn vào Lớp Gốc
            if (subGroups && subGroups.length > 0) {
                const availableSubGroups = subGroups.filter(sub =>
                    sub.max_capacity === 0 || sub.current_enrolled < sub.max_capacity
                );

                return [{
                    course_code,
                    course_name,
                    class_code, // Giữ nguyên mã lớp gốc: 24_5
                    credits,
                    type: "LT+TH/BT",
                    schedule: lt_schedule,
                    schedule_raw: schedule_raw_lt,
                    // Danh sách các lựa chọn nhóm phụ đi kèm để Scheduler tự chọn
                    sub_groups: availableSubGroups.map(sub => ({
                        group_code: sub.group_code,
                        full_class_code: `${class_code}_${sub.group_code}`,
                        schedules: [lt_schedule, sub.schedule], // Lịch LT + Lịch TH/BT tương ứng
                        schedule_raw: `LT: ${schedule_raw_lt} | TH/BT: ${sub.schedule_raw}`
                    }))
                }];
            }

            // NẾU CHỈ CÓ LÝ THUYẾT THUẦN
            return [{
                course_code,
                course_name,
                class_code,
                credits,
                type: "LT",
                schedule: lt_schedule,
                schedules: [lt_schedule],
                schedule_raw: schedule_raw_lt,
                sub_groups: []
            }];
        })());
    }

    const results = await Promise.all(rawCoursePromises);
    const courses = results.flat();

    if (typeof window !== "undefined") {
        window.allCourses = courses;
    }

    console.log("✅ QUÉT GỌN DỮ LIỆU THÀNH CÔNG! Số lớp chính hiển thị UI:", courses.length);
    return courses;
}

if (typeof window !== "undefined") {
    window.parsePortalTable = parsePortalTable;
}