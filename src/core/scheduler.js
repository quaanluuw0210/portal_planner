/**
 * Kiểm tra xem 2 buổi học có bị cấn/trùng tiết nhau không
 */
function isSlotOverlap(s1, s2) {
    if (!s1 || !s2 || s1.day !== s2.day) return false;

    // Nếu có mảng half_slots thì so sánh qua half_slots
    if (Array.isArray(s1.half_slots) && Array.isArray(s2.half_slots)) {
        return s1.half_slots.some(slot => s2.half_slots.includes(slot));
    }

    // Fallback so sánh khoảng tiết start_slot -> end_slot
    return Math.max(s1.start_slot, s2.start_slot) <= Math.min(s1.end_slot, s2.end_slot);
}

/**
 * Kiểm tra xem danh sách lịch mới có bị trùng với Thời khóa biểu hiện tại không
 */
function hasScheduleConflict(existingSchedules, newSchedules) {
    const safeExisting = Array.isArray(existingSchedules) ? existingSchedules : [];
    const safeNew = Array.isArray(newSchedules) ? newSchedules : [];

    for (const existing of safeExisting) {
        for (const newSch of safeNew) {
            if (isSlotOverlap(existing, newSch)) {
                return true; // Bị trùng lịch!
            }
        }
    }
    return false;
}

/**
 * Lấy danh sách mảng lịch chuẩn hóa từ một đối tượng môn học
 */
function extractCourseSchedules(course) {
    if (Array.isArray(course.schedules) && course.schedules.length > 0) {
        return course.schedules;
    }
    if (course.schedule) {
        return [course.schedule];
    }
    return [];
}

/**
 * Thuật toán Backtracking tự ghép Lớp phụ thích hợp
 */
export function generateSchedules(selectedCoursesGrouped) {
    if (!Array.isArray(selectedCoursesGrouped) || selectedCoursesGrouped.length === 0) {
        return [];
    }

    const validSchedules = [];

    // Chuẩn hóa input: Đảm bảo phần tử trong mảng là mảng các lựa chọn môn
    const normalizedGroups = selectedCoursesGrouped.map(item => {
        return Array.isArray(item) ? item : [item];
    });

    function backtrack(groupIndex, currentSchedule, currentOccupiedSchedules) {
        if (groupIndex >= normalizedGroups.length) {
            validSchedules.push([...currentSchedule]);
            return;
        }

        const currentGroupOptions = normalizedGroups[groupIndex];

        for (const course of currentGroupOptions) {
            if (!course) continue;

            // TRƯỜNG HỢP 1: Môn có Nhóm phụ đi kèm (BT/TH)
            if (Array.isArray(course.sub_groups) && course.sub_groups.length > 0) {
                for (const sub of course.sub_groups) {
                    const subSchedules = Array.isArray(sub.schedules) ? sub.schedules : [];

                    if (!hasScheduleConflict(currentOccupiedSchedules, subSchedules)) {
                        const courseOption = {
                            ...course,
                            class_code: sub.full_class_code || `${course.class_code}_${sub.group_code}`,
                            schedules: subSchedules,
                            schedule_raw: sub.schedule_raw || course.schedule_raw
                        };

                        backtrack(
                            groupIndex + 1,
                            [...currentSchedule, courseOption],
                            [...currentOccupiedSchedules, ...subSchedules]
                        );
                    }
                }
            }
            // TRƯỜNG HỢP 2: Môn Lý thuyết thuần
            else {
                const courseSchedules = extractCourseSchedules(course);

                if (!hasScheduleConflict(currentOccupiedSchedules, courseSchedules)) {
                    const courseOption = {
                        ...course,
                        schedules: courseSchedules
                    };

                    backtrack(
                        groupIndex + 1,
                        [...currentSchedule, courseOption],
                        [...currentOccupiedSchedules, ...courseSchedules]
                    );
                }
            }
        }
    }

    backtrack(0, [], []);
    return validSchedules;
}