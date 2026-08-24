
/**
 * Initializes the Schedule Planner Overlay as a full-screen modal interface inside the provided shadow host.
 * 
 * @param {HTMLElement} host - The shadow host container element.
 * @param {Function} parseFn - Function to parse the portal course table.
 * @param {Function} solveFn - Function to run backtracking solver.
 * @param {Object} storageObj - Storage wrapper (getUserPreferences, saveUserPreferences, etc).
 */
export async function initShadowOverlay(host, parseFn, solveFn, storageObj) {
    if (!host) {
        console.error("HCMUS Auto Planner: Host element không tồn tại!");
        return;
    }

    let shadowRoot = host.shadowRoot;
    if (!shadowRoot) {
        shadowRoot = host.attachShadow({ mode: 'open' });
    } else {
        return shadowRoot;
    }

    const cssUrl = chrome.runtime.getURL('assets/styles/injected.css');

    const colors = [
        { bg: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
        { bg: 'linear-gradient(135deg, #10b981, #059669)' },
        { bg: 'linear-gradient(135deg, #f59e0b, #d97706)' },
        { bg: 'linear-gradient(135deg, #a855f7, #9333ea)' },
        { bg: 'linear-gradient(135deg, #f43f5e, #e11d48)' },
        { bg: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
        { bg: 'linear-gradient(135deg, #f97316, #ea580c)' },
        { bg: 'linear-gradient(135deg, #14b8a6, #0d9488)' }
    ];

    // Template 1 Cột Full Màn Hình
    shadowRoot.innerHTML = `
        <link rel="stylesheet" href="${cssUrl}">
        <div class="backdrop">
            <div class="modal-container-full">
                <!-- Header Cố Định -->
                <div class="modal-header-full">
                    <h3 class="brand-title">📅 HCMUS Auto Planner</h3>
                    <button class="modal-close-btn" id="btn-close">&times;</button>
                </div>
                
                <div id="alert-container" style="display: none; padding: 10px 24px 0 24px;"></div>

                <!-- SCREEN 1: BƯỚC CẤU HÌNH & CHỌN MÔN (Phủ rộng 100%) -->
                <div id="screen-setup" class="screen-view">
                    <div class="setup-wrapper">
                        <!-- Bước 1: Quét và chọn môn -->
                        <div class="widget-section">
                            <h4 class="section-title">Bước 1: Quét & Chọn môn học</h4>
                            <button class="btn btn-primary" id="btn-scan" style="width: auto; padding: 10px 24px;">🔍 Quét dữ liệu trang này</button>
                            
                            <div id="course-selection-wrapper" style="display: none; margin-top: 16px; flex-direction: column; gap: 12px;">
                                <input type="text" id="course-search" class="constraint-select" placeholder="🔍 Tìm kiếm tên môn hoặc mã môn học..." style="max-width: 400px;">
                                <div class="course-checkbox-grid" id="course-list"></div>
                            </div>
                        </div>

                        <!-- Bước 2: Tiêu chí lọc & Ghim lớp -->
                        <div class="widget-section" id="section-constraints" style="display: none; margin-top: 20px;">
                            <h4 class="section-title">Bước 2: Tiêu chí lọc & Ghim lớp</h4>
                            
                            <div class="constraints-row">
                                <label class="constraint-checkbox-label">
                                    <span class="checkbox-container">
                                        <input type="checkbox" id="chk-avoid-slot1">
                                        <span class="checkmark"></span>
                                    </span>
                                    Bỏ tiết 1 (7h30)
                                </label>

                                <label class="constraint-checkbox-label">
                                    <span class="checkbox-container">
                                        <input type="checkbox" id="chk-avoid-evening">
                                        <span class="checkmark"></span>
                                    </span>
                                    Bỏ tiết tối
                                </label>

                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label class="section-title" style="margin: 0; font-size: 0.85rem;">Ca học ưu tiên:</label>
                                    <select id="select-session" class="constraint-select" style="width: auto;">
                                        <option value="none">Không ưu tiên</option>
                                        <option value="morning">Ca sáng (kết thúc <= tiết 5)</option>
                                        <option value="afternoon">Ca chiều (bắt đầu >= tiết 6)</option>
                                    </select>
                                </div>
                            </div>

                            <div style="margin-top: 16px;">
                                <label class="section-title" style="font-size: 0.85rem; margin-bottom: 8px; display: block;">Tránh thứ trong tuần:</label>
                                <div class="weekday-selector" id="weekday-picker">
                                    <button class="weekday-btn" data-day="2">T2</button>
                                    <button class="weekday-btn" data-day="3">T3</button>
                                    <button class="weekday-btn" data-day="4">T4</button>
                                    <button class="weekday-btn" data-day="5">T5</button>
                                    <button class="weekday-btn" data-day="6">T6</button>
                                    <button class="weekday-btn" data-day="7">T7</button>
                                </div>
                            </div>

                            <div style="margin-top: 16px;">
                                <label class="section-title" style="font-size: 0.85rem; margin-bottom: 8px; display: block;">Ghim mã lớp cố định:</label>
                                <div id="pin-classes-container" class="pin-grid">
                                    <span style="color: #64748b; font-size: 0.85rem; font-style: italic;">Chọn môn học ở Bước 1 để ghim mã lớp</span>
                                </div>
                            </div>
                        </div>

                        <!-- Action Button -->
                        <div class="widget-section" id="section-solve-action" style="display: none; margin-top: 24px;">
                            <button class="btn btn-primary btn-large" id="btn-solve">📅 Bắt đầu xếp thời khóa biểu</button>
                        </div>
                    </div>
                </div>

                <!-- SCREEN 2: BẢNG LỊCH HỌC FULL MÀN HÌNH (Ẩn mặc định) -->
                <div id="screen-results" class="screen-view" style="display: none;">
                    <div class="results-toolbar">
                        <button class="btn btn-outline" id="btn-back-setup">↺ Bỏ chọn / Chọn lại môn học</button>
                        <div class="options-nav" id="options-nav-pills"></div>
                        <button class="btn btn-primary" id="btn-save-current" style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 8px 16px;">💾 Lưu TKB này</button>
                    </div>

                    <div class="calendar-wrapper-full">
                        <div class="calendar-grid" id="calendar-grid">
                            <div class="grid-header" style="grid-column: 1; grid-row: 1;">Tiết</div>
                            <div class="grid-header" style="grid-column: 2; grid-row: 1;">Thứ 2</div>
                            <div class="grid-header" style="grid-column: 3; grid-row: 1;">Thứ 3</div>
                            <div class="grid-header" style="grid-column: 4; grid-row: 1;">Thứ 4</div>
                            <div class="grid-header" style="grid-column: 5; grid-row: 1;">Thứ 5</div>
                            <div class="grid-header" style="grid-column: 6; grid-row: 1;">Thứ 6</div>
                            <div class="grid-header" style="grid-column: 7; grid-row: 1;">Thứ 7</div>
                        </div>
                    </div>

                    <div class="option-details-panel">
                        <h5 style="margin: 0 0 10px 0; color: #1e293b; font-size: 0.9rem; font-weight: 700;">Chi tiết lớp học của phương án đang chọn</h5>
                        <div id="details-list" class="details-grid-container"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Render Grid Calendar Cells
    const grid = shadowRoot.getElementById("calendar-grid");
    for (let s = 1; s <= 12; s++) {
        const label = document.createElement("div");
        label.className = "slot-label";
        label.style.gridColumn = "1";
        label.style.gridRow = `${2 + (s - 1) * 2} / ${2 + s * 2}`;
        label.textContent = `Tiết ${s}`;
        grid.appendChild(label);
    }
    for (let r = 2; r <= 25; r++) {
        for (let c = 2; c <= 7; c++) {
            const bgCell = document.createElement("div");
            bgCell.className = "grid-bg-cell";
            bgCell.style.gridColumn = String(c);
            bgCell.style.gridRow = String(r);
            grid.appendChild(bgCell);
        }
    }

    // States
    let allCourses = [];
    let selectedCodes = [];
    let avoidDays = [];
    let preferSession = 'none';
    let avoidSlot1 = false;
    let avoidEvening = false;
    let forcedClasses = {};

    let currentSchedules = [];
    let activeScheduleIndex = 0;

    function showAlert(message, type = "info") {
        const container = shadowRoot.getElementById("alert-container");
        container.style.display = "block";
        container.innerHTML = `
            <div class="message message-${type}">
                <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'} ${message}</span>
            </div>
        `;
    }

    // Load preferences
    const prefs = await storageObj.getUserPreferences();
    avoidDays = prefs.avoidDays || [];
    preferSession = prefs.preferSession || 'none';
    avoidSlot1 = prefs.avoidSlot1 || false;
    avoidEvening = prefs.avoidEvening || false;
    forcedClasses = prefs.forcedClasses || {};

    shadowRoot.getElementById("chk-avoid-slot1").checked = avoidSlot1;
    shadowRoot.getElementById("chk-avoid-evening").checked = avoidEvening;
    shadowRoot.getElementById("select-session").value = preferSession;

    shadowRoot.querySelectorAll("#weekday-picker .weekday-btn").forEach(btn => {
        const day = parseInt(btn.getAttribute("data-day"), 10);
        if (avoidDays.includes(day)) btn.classList.add("active");
    });

    async function savePreferences() {
        await storageObj.saveUserPreferences({ avoidDays, preferSession, avoidSlot1, avoidEvening, forcedClasses });
    }

    // Bind Events
    shadowRoot.getElementById("btn-close").onclick = () => { host.style.display = "none"; };

    // Nút Bỏ chọn/Xếp lại -> Quay về Màn hình 1
    shadowRoot.getElementById("btn-back-setup").onclick = () => {
        shadowRoot.getElementById("screen-results").style.display = "none";
        // BUG FIX: screen-view dùng display:flex, không phải block
        shadowRoot.getElementById("screen-setup").style.display = "flex";
    };

    // BUG FIX: Dùng parseFn (dependency được inject vào) thay vì gọi parsePortalTable trực tiếp
    // (parsePortalTable không tồn tại trong scope này - nó là async export từ parser.js)
    shadowRoot.getElementById("btn-scan").onclick = async () => {
        try {
            showAlert("Đang quét dữ liệu Portal, vui lòng chờ...", "info");

            // BUG FIX: Gọi parseFn (đã được inject qua tham số hàm), không phải parsePortalTable
            allCourses = await parseFn(document);

            // Gán ra window toàn cục để debug qua Console
            if (typeof window !== "undefined") window.allCourses = allCourses;

            console.log("HCMUS Planner - Dữ liệu đã nạp:", allCourses);

            if (!allCourses || allCourses.length === 0) {
                showAlert("Không tìm thấy dữ liệu lớp học trên trang này!", "error");
                return;
            }

            // BUG FIX: renderCourseList nhận mảng unique course_code (string[]), không phải allCourses (object[])
            const uniqueCodes = [...new Set(allCourses.map(c => c.course_code))];

            // Hiển thị các section còn ẩn
            shadowRoot.getElementById("course-selection-wrapper").style.display = "flex";
            shadowRoot.getElementById("section-constraints").style.display = "block";
            shadowRoot.getElementById("section-solve-action").style.display = "block";

            renderCourseList(uniqueCodes);
            renderPinClasses();
            showAlert(`Quét thành công ${allCourses.length} tổ hợp lớp (${uniqueCodes.length} môn)!`, "success");

        } catch (e) {
            console.error("Lỗi khi quét dữ liệu:", e);
            showAlert("Xảy ra lỗi trong quá trình quét dữ liệu!", "error");
        }
    };

    shadowRoot.getElementById("course-search").oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = shadowRoot.querySelectorAll("#course-list .course-item");
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? "flex" : "none";
        });
    };

    shadowRoot.getElementById("chk-avoid-slot1").onchange = (e) => { avoidSlot1 = e.target.checked; savePreferences(); };
    shadowRoot.getElementById("chk-avoid-evening").onchange = (e) => { avoidEvening = e.target.checked; savePreferences(); };
    shadowRoot.getElementById("select-session").onchange = (e) => { preferSession = e.target.value; savePreferences(); };

    shadowRoot.querySelectorAll("#weekday-picker .weekday-btn").forEach(btn => {
        const day = parseInt(btn.getAttribute("data-day"), 10);
        btn.onclick = () => {
            btn.classList.toggle("active");
            if (btn.classList.contains("active")) {
                if (!avoidDays.includes(day)) avoidDays.push(day);
            } else {
                avoidDays = avoidDays.filter(d => d !== day);
            }
            savePreferences();
        };
    });

    // Solve & Chuyển View
    shadowRoot.getElementById("btn-solve").onclick = () => {
        if (selectedCodes.length === 0) {
            showAlert("Vui lòng chọn ít nhất 1 môn ở Bước 1!", "error");
            return;
        }

        const constraints = { avoidDays, preferSession: preferSession === 'none' ? null : preferSession, avoidSlot1, avoidEvening };
        const result = solveFn(allCourses, selectedCodes, constraints, forcedClasses);

        if (result.error || !result.schedules || result.schedules.length === 0) {
            showAlert(result.error || "Không tìm thấy phương án xếp lịch phù hợp!", "error");
        } else {
            showAlert(`Tìm thấy ${result.schedules.length} phương án xếp lịch phù hợp!`, "success");
            currentSchedules = result.schedules;
            activeScheduleIndex = 0;

            // Chuyển sang Màn hình 2 Full
            shadowRoot.getElementById("screen-setup").style.display = "none";
            shadowRoot.getElementById("screen-results").style.display = "flex";

            renderOptionsPills();
            renderActiveSchedule(currentSchedules[0]);
        }
    };

    shadowRoot.getElementById("btn-save-current").onclick = async () => {
        if (currentSchedules.length === 0 || activeScheduleIndex < 0) return;
        const currentSched = currentSchedules[activeScheduleIndex];

        try {
            const saved = await storageObj.getSavedSchedules();
            const serializedSched = JSON.stringify(currentSched.map(c => ({ course_code: c.course_code, class_code: c.class_code })));
            const exists = saved.some(s => JSON.stringify(s.map(c => ({ course_code: c.course_code, class_code: c.class_code }))) === serializedSched);

            if (exists) {
                showAlert("Thời khóa biểu này đã được lưu trước đó!", "info");
                return;
            }
            saved.push(currentSched);
            await storageObj.saveSavedSchedules(saved);
            showAlert(`Lưu thành công Phương án ${activeScheduleIndex + 1}!`, "success");
        } catch (err) {
            console.error(err);
            showAlert("Có lỗi xảy ra khi lưu thời khóa biểu!", "error");
        }
    };

    // Renderers
    function renderCourseList(uniqueCodes) {
        const container = shadowRoot.getElementById("course-list");
        container.innerHTML = "";

        uniqueCodes.forEach(code => {
            const matches = allCourses.filter(c => c.course_code === code);
            const sample = matches[0];

            const item = document.createElement("div");
            item.className = "course-item";
            if (selectedCodes.includes(code)) item.classList.add("selected");

            // BUG FIX: type có thể là 'LT', 'LT+BT' — dùng .includes() để phù hợp mọi biến thể
            const hasLT = matches.some(m => m.type && m.type.includes('LT'));
            const hasTH = matches.some(m => m.type && (m.type.includes('TH') || m.type.includes('BT')));

            item.innerHTML = `
                <label class="checkbox-container">
                    <input type="checkbox" class="chk-course" value="${code}" ${selectedCodes.includes(code) ? "checked" : ""}>
                    <span class="checkmark"></span>
                </label>
                <div class="course-label">
                    <div><b>${code}</b> - ${sample.course_name}</div>
                    <div class="badge-group">
                        <span class="badge badge-credits">${sample.credits} TC</span>
                        ${hasLT ? '<span class="badge badge-type-lt">LT</span>' : ''}
                        ${hasTH ? '<span class="badge badge-type-th">TH/BT</span>' : ''}
                    </div>
                </div>
            `;

            const chk = item.querySelector(".chk-course");
            chk.onchange = () => {
                if (chk.checked) {
                    if (!selectedCodes.includes(code)) selectedCodes.push(code);
                    item.classList.add("selected");
                } else {
                    selectedCodes = selectedCodes.filter(c => c !== code);
                    item.classList.remove("selected");
                    delete forcedClasses[code];
                }
                renderPinClasses();
                savePreferences();
            };

            container.appendChild(item);
        });
    }

    function renderPinClasses() {
        const container = shadowRoot.getElementById("pin-classes-container");
        container.innerHTML = "";

        if (selectedCodes.length === 0) {
            container.innerHTML = `<span style="color: #64748b; font-size: 0.85rem; font-style: italic;">Chọn môn học ở Bước 1 để ghim mã lớp</span>`;
            return;
        }

        selectedCodes.forEach(code => {
            const matches = allCourses.filter(c => c.course_code === code);
            const sampleName = matches[0]?.course_name || "";
            const classCodes = [...new Set(matches.map(c => c.class_code))];

            const section = document.createElement("div");
            section.style.display = "flex";
            section.style.flexDirection = "column";
            section.style.gap = "4px";

            const title = document.createElement("span");
            title.style.fontSize = "0.85rem";
            title.style.fontWeight = "600";
            title.textContent = `📌 ${code} - ${sampleName}`;
            section.appendChild(title);

            const btnGroup = document.createElement("div");
            btnGroup.style.display = "flex";
            btnGroup.style.gap = "6px";
            btnGroup.style.flexWrap = "wrap";

            classCodes.forEach(classCode => {
                const btn = document.createElement("button");
                btn.className = "weekday-btn";
                btn.style.width = "auto";
                btn.style.padding = "4px 10px";
                btn.textContent = classCode;

                if (forcedClasses[code] && forcedClasses[code].includes(classCode)) {
                    btn.classList.add("active");
                }

                btn.onclick = () => {
                    btn.classList.toggle("active");
                    if (btn.classList.contains("active")) {
                        if (!forcedClasses[code]) forcedClasses[code] = [];
                        if (!forcedClasses[code].includes(classCode)) forcedClasses[code].push(classCode);
                    } else {
                        if (forcedClasses[code]) {
                            forcedClasses[code] = forcedClasses[code].filter(c => c !== classCode);
                            if (forcedClasses[code].length === 0) delete forcedClasses[code];
                        }
                    }
                    savePreferences();
                };

                btnGroup.appendChild(btn);
            });

            section.appendChild(btnGroup);
            container.appendChild(section);
        });
    }

    function renderOptionsPills() {
        const nav = shadowRoot.getElementById("options-nav-pills");
        nav.innerHTML = "";

        currentSchedules.forEach((_, idx) => {
            const pill = document.createElement("button");
            pill.className = "option-pill" + (idx === activeScheduleIndex ? " active" : "");
            pill.textContent = `P.Án ${idx + 1}`;

            pill.onclick = () => {
                activeScheduleIndex = idx;
                renderActiveSchedule(currentSchedules[idx]);
                nav.querySelectorAll(".option-pill").forEach((p, pIdx) => p.classList.toggle("active", pIdx === idx));
            };

            nav.appendChild(pill);
        });
    }

    function renderActiveSchedule(sched) {
        // Clear old event cards
        grid.querySelectorAll(".event-card").forEach(c => c.remove());

        // Assign colors dynamically for course codes
        const uniqueCourseCodes = [...new Set(sched.map(c => c.course_code))];
        const colorMap = {};
        uniqueCourseCodes.forEach((code, index) => {
            colorMap[code] = colors[index % colors.length];
        });

        // 1. Draw ALL sessions (LT + BT/TH) on calendar grid
        sched.forEach(course => {
            // Lấy toàn bộ danh sách buổi học trong mảng schedules
            const sessionList = (course.schedules && course.schedules.length > 0)
                ? course.schedules
                : (course.schedule ? [course.schedule] : []);

            sessionList.forEach((sch, sIdx) => {
                if (!sch || !sch.day || !sch.start_slot || !sch.end_slot) return;

                const gridRowStart = 2 + Math.floor((sch.start_slot - 1) * 2);
                const gridRowEnd = 2 + Math.ceil(sch.end_slot * 2);

                const card = document.createElement("div");
                card.className = "event-card";
                card.style.gridColumn = String(sch.day);
                card.style.gridRow = `${gridRowStart} / ${gridRowEnd}`;
                card.style.background = colorMap[course.course_code].bg;

                // Thêm nhãn nhãn phân biệt LT và BT/TH nếu môn có nhiều buổi
                const tag = sessionList.length > 1 ? (sIdx === 0 ? " [LT]" : " [TH/BT]") : "";

                card.innerHTML = `
                    <div class="event-title" title="${course.course_name}">${course.course_name}${tag}</div>
                    <div class="event-meta">
                        <span>Lớp: <b>${course.class_code}</b></span>
                        <span>Phòng: <b>${sch.room || "Thông báo sau"}</b></span>
                    </div>
                `;

                grid.appendChild(card);
            });
        });

        // 2. Populate bottom details list
        const detailsList = shadowRoot.getElementById("details-list");
        detailsList.innerHTML = "";

        sched.forEach(course => {
            const detailCard = document.createElement("div");
            detailCard.className = "detail-card";

            // BUG FIX: Lấy thông tin phòng học và thời gian từ schedule (có thể null)
            const mainSch = course.schedule;
            const timeStr = mainSch
                ? `Thứ ${mainSch.day === 8 ? 'CN' : mainSch.day} (Tiết ${mainSch.start_slot}–${mainSch.end_slot})`
                : "Thông báo sau";
            const roomStr = mainSch ? (mainSch.room || "Thông báo sau") : "Thông báo sau";

            detailCard.innerHTML = `
                <div class="detail-card-header">
                    <span style="font-weight: 700;">${course.course_code} - ${course.course_name}</span>
                    <span class="badge ${course.type && (course.type.includes('TH') || course.type.includes('BT')) ? 'badge-type-th' : 'badge-type-lt'}">${course.type}</span>
                </div>
                <div class="detail-card-body">
                    <div>Mã lớp: <b>${course.class_code}</b></div>
                    <div>Lịch học: <b>${timeStr}</b></div>
                    <div>Phòng học: <b>${roomStr}</b></div>
                    <div>Tín chỉ: <b>${course.credits} TC</b></div>
                    <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">Chi tiết: ${course.schedule_raw || ''}</div>
                </div>
            `;

            detailsList.appendChild(detailCard);
        });
    }
}