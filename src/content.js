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

                        // Áp dụng constraint trên tất cả các buổi học
                        const sessions = (course.schedules && course.schedules.length > 0)
                            ? course.schedules : (course.schedule ? [course.schedule] : []);

                        let violated = false;
                        for (const s of sessions) {
                            if (!s) continue;
                            if (constraints.avoidDays && constraints.avoidDays.includes(s.day)) { violated = true; break; }
                            if (constraints.preferSession === 'morning' && s.end_slot > 5) { violated = true; break; }
                            if (constraints.preferSession === 'afternoon' && s.start_slot < 6) { violated = true; break; }
                            if (constraints.avoidSlot1 && s.half_slots && s.half_slots.includes(1)) { violated = true; break; }
                            if (constraints.avoidEvening && s.half_slots && s.half_slots.some(sl => sl >= 11)) { violated = true; break; }
                        }
                        if (violated) return;

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