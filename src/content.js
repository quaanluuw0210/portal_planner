(async () => {
    // 1. Avoid duplicate injection in frames or sub-iframes
    if (window.self !== window.top) {
        return;
    }

    // 2. Prevent multiple injections of this content script on the same page
    if (window.__hcmus_planner_injected__) return;
    window.__hcmus_planner_injected__ = true;

    let hostElement = null;

    try {
        // Resolve URLs for the modules
        const parserUrl = chrome.runtime.getURL('src/core/parser.js');
        const schedulerUrl = chrome.runtime.getURL('src/core/scheduler.js');
        const storageUrl = chrome.runtime.getURL('src/core/storage.js');
        const overlayUrl = chrome.runtime.getURL('src/ui/overlay.js');

        // Dynamically import core and UI modules
        const [parser, scheduler, storage, overlay] = await Promise.all([
            import(parserUrl),
            import(schedulerUrl),
            import(storageUrl),
            import(overlayUrl)
        ]);

        const initWidget = async () => {
            // Đảm bảo document.body đã xuất hiện
            if (!document.body) return;

            let hostElement = document.getElementById("hcmus-shadow-host");

            if (!hostElement) {
                hostElement = document.createElement("div");
                hostElement.id = "hcmus-shadow-host";
                hostElement.style.display = "none";
                document.body.appendChild(hostElement);
            }

            // Adapter: Bridge giao diện cũ (allCourses, selectedCodes, constraints, forcedClasses)
            // → API mới của generateSchedules(selectedCoursesGrouped)
            function makeSolveFn(generateFn) {
                return function solveFn(allCourses, selectedCodes, constraints = {}, forcedClasses = {}) {
                    // Helper kiểm tra xem danh sách lịch học có vi phạm ràng buộc không
                    function isViolated(sessions) {
                        if (!sessions || sessions.length === 0) return false;
                        for (const s of sessions) {
                            if (!s) continue;
                            if (constraints.avoidDays && constraints.avoidDays.includes(s.day)) return true;
                            if (constraints.preferSession === 'morning' && s.end_slot > 5) return true;
                            if (constraints.preferSession === 'afternoon' && s.start_slot < 6) return true;
                            if (constraints.avoidSlot1 && s.half_slots && s.half_slots.includes(1)) return true;
                            if (constraints.avoidEvening && s.half_slots && s.half_slots.some(sl => sl >= 11)) return true;
                        }
                        return false;
                    }

                    // 1. Nhóm các lớp theo course_code
                    const grouped = {};
                    selectedCodes.forEach(code => { grouped[code] = []; });

                    allCourses.forEach(course => {
                        const code = course.course_code;
                        if (!(code in grouped)) return;

                        // Áp dụng forcedClasses (ghim mã lớp)
                        if (forcedClasses[code] && forcedClasses[code].length > 0) {
                            if (!forcedClasses[code].includes(course.class_code)) return;
                        }

                        // A. Kiểm tra lớp lý thuyết chính
                        const mainSessions = course.schedule ? [course.schedule] : [];
                        if (isViolated(mainSessions)) return;

                        // B. Kiểm tra và lọc nhóm phụ (nếu có thực hành/bài tập đi kèm)
                        if (Array.isArray(course.sub_groups) && course.sub_groups.length > 0) {
                            const validSubs = course.sub_groups.filter(sub => {
                                return !isViolated(sub.schedules);
                            });

                            // Nếu không còn bất kỳ nhóm thực hành phụ nào thỏa mãn, loại bỏ luôn lớp chính này
                            if (validSubs.length === 0) return;

                            // Cập nhật lại danh sách nhóm phụ hợp lệ cho lớp chính
                            course.sub_groups = validSubs;
                        }

                        grouped[code].push(course);
                    });

                    // Kiểm tra môn nào rỗng lớp
                    const emptyCourse = selectedCodes.find(code => grouped[code].length === 0);
                    if (emptyCourse) {
                        return { error: `Môn "${emptyCourse}" không còn lớp nào phù hợp với tiêu chí!` };
                    }

                    // 2. Gọi generateSchedules với grouped array
                    const groupedArray = selectedCodes.map(code => grouped[code]);
                    const allResults = generateFn(groupedArray);

                    // 3. Giới hạn tối đa 50 phương án
                    return { schedules: allResults.slice(0, 100) };
                };
            }

            // Truyền hostElement đã chắc chắn tồn tại vào
            await overlay.initShadowOverlay(
                hostElement,
                parser.parsePortalTable,
                makeSolveFn(scheduler.generateSchedules),
                storage
            );
        };

        // Initialize script based on document readyState
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            await initWidget();
        } else {
            window.addEventListener('load', initWidget);
        }

        // 3. Listen for message from service worker to toggle modal overlay
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === "TOGGLE_OVERLAY" && hostElement) {
                if (hostElement.style.display === "none") {
                    hostElement.style.display = "block";
                } else {
                    hostElement.style.display = "none";
                }
                sendResponse({ success: true, status: hostElement.style.display });
            }
            return true; // Keeps the message channel open for asynchronous responses
        });

    } catch (error) {
        console.error("HCMUS Auto Planner: Failed to load entry point modules.", error);
    }
})();