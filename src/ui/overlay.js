
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

    // Template 2-cột Full Màn Hình (Cột trái: chọn môn | Cột phải: tiêu chí)
    shadowRoot.innerHTML = `
        <link rel="stylesheet" href="${cssUrl}">
        <div class="backdrop">
            <div class="modal-container-full">
                <!-- Header Cố Định -->
                <div class="modal-header-full">
                    <div style="display:flex; align-items:center; gap:14px;">
                        <h3 class="brand-title">📅 HCMUS Auto Planner</h3>
                        <span id="selected-count-badge" style="display:none; background:#4f46e5; color:#fff;
                            font-size:0.8rem; font-weight:700; padding:3px 10px; border-radius:20px;">
                            0 môn đã chọn
                        </span>
                    </div>
                    <button class="modal-close-btn" id="btn-close">&times;</button>
                </div>

                <div id="alert-container" style="display:none; padding:8px 24px 0;"></div>

                <!-- SCREEN 1: Layout 2 cột -->
                <div id="screen-setup" class="screen-view screen-setup-2col">

                    <!-- CỘT TRÁI: Chọn môn -->
                    <div class="setup-left">
                        <!-- Scan + Search row -->
                        <div class="scan-row">
                            <button class="btn btn-scan" id="btn-scan">
                                🔍 Quét dữ liệu Portal
                            </button>
                            <div class="search-wrapper" id="search-wrapper" style="display:none;">
                                <span class="search-icon">⌕</span>
                                <input type="text" id="course-search" class="search-input"
                                       placeholder="Tìm môn theo tên hoặc mã môn...">
                            </div>
                        </div>

                        <!-- Thanh chip Môn đã chọn (hiện khi có môn được tick) -->
                        <div id="selected-bar" class="selected-bar" style="display:none;">
                            <span class="selected-bar-label">Đã chọn:</span>
                            <div class="selected-chips" id="selected-chips"></div>
                        </div>
                        <!-- Placeholder trước khi quét -->
                        <div id="course-placeholder" class="course-placeholder">
                            <div class="placeholder-icon">🎓</div>
                            <div class="placeholder-text">Nhấn <b>Quét dữ liệu Portal</b> để tải danh sách môn học từ trang đăng ký</div>
                        </div>

                        <!-- Course card grid (hiển thị sau khi quét) -->
                        <div id="course-selection-wrapper" style="display:none; flex-direction:column; gap:0; flex:1; min-height:0;">
                            <div class="course-list-header" id="course-list-header">
                                <span id="course-total-label">0 môn học</span>
                            </div>
                            <div class="course-card-grid" id="course-list"></div>
                        </div>
                    </div>

                    <!-- CỘT PHẢI: Tiêu chí + Ghim + CTA -->
                    <div class="setup-right" id="section-constraints" style="display:none;">

                        <!-- Tiêu chí lọc -->
                        <div class="right-section">
                            <h4 class="right-section-title">⚙️ Tiêu chí lọc</h4>

                            <div class="filter-check-group">
                                <label class="filter-check-item">
                                    <input type="checkbox" id="chk-avoid-slot1" class="native-chk">
                                    <span class="chk-box"></span>
                                    <span class="chk-label">Bỏ tiết 1 <small>(7:30)</small></span>
                                </label>
                                <label class="filter-check-item">
                                    <input type="checkbox" id="chk-avoid-evening" class="native-chk">
                                    <span class="chk-box"></span>
                                    <span class="chk-label">Bỏ tiết tối <small>(≥ tiết 11)</small></span>
                                </label>
                            </div>

                            <div class="filter-field">
                                <label class="filter-label">Ca học ưu tiên</label>
                                <select id="select-session" class="filter-select">
                                    <option value="none">Không ưu tiên</option>
                                    <option value="morning">☀️ Ca sáng (kết thúc ≤ tiết 5)</option>
                                    <option value="afternoon">🌤️ Ca chiều (bắt đầu ≥ tiết 6)</option>
                                </select>
                            </div>

                            <div class="filter-field">
                                <label class="filter-label">Tránh thứ trong tuần</label>
                                <div class="weekday-selector" id="weekday-picker">
                                    <button class="weekday-btn" data-day="2">T2</button>
                                    <button class="weekday-btn" data-day="3">T3</button>
                                    <button class="weekday-btn" data-day="4">T4</button>
                                    <button class="weekday-btn" data-day="5">T5</button>
                                    <button class="weekday-btn" data-day="6">T6</button>
                                    <button class="weekday-btn" data-day="7">T7</button>
                                </div>
                            </div>
                        </div>

                        <!-- Ghim mã lớp -->
                        <div class="right-section">
                            <h4 class="right-section-title">📌 Ghim mã lớp cố định</h4>
                            <div id="pin-classes-container" class="pin-grid">
                                <span class="pin-empty-msg">Tích chọn môn học ở bên trái để ghim mã lớp</span>
                            </div>
                        </div>

                        <!-- CTA Solve -->
                        <div id="section-solve-action" style="display:none; margin-top:auto; padding-top:12px;">
                            <button class="btn btn-solve" id="btn-solve">
                                ⚡ Xếp lịch ngay
                            </button>
                        </div>

                    </div>

                </div><!-- /screen-setup -->

                <!-- SCREEN 2: 2-cột: Lịch (trái) + Chi tiết (phải) -->
                <div id="screen-results" class="screen-view screen-results-2col" style="display: none;">

                    <!-- Toolbar -->
                    <div class="results-toolbar">
                        <button class="btn btn-outline" id="btn-back-setup">↺ Chọn lại môn & tiêu chí</button>
                        <div class="options-nav" id="options-nav-pills"></div>
                        <button class="btn btn-primary" id="btn-save-current"
                                style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:8px 16px;">💾 Lưu TKB này</button>
                    </div>

                    <!-- Body: Calendar + Sidebar -->
                    <div class="results-body">

                        <!-- LỊCH HỌC: chiếm toàn bộ chiều cao, không scroll dọc -->
                        <div class="calendar-wrapper-full">
                            <div class="calendar-grid" id="calendar-grid">
                                <div class="grid-header" style="grid-column:1;grid-row:1;">Tiết</div>
                                <div class="grid-header" style="grid-column:2;grid-row:1;">Thứ 2</div>
                                <div class="grid-header" style="grid-column:3;grid-row:1;">Thứ 3</div>
                                <div class="grid-header" style="grid-column:4;grid-row:1;">Thứ 4</div>
                                <div class="grid-header" style="grid-column:5;grid-row:1;">Thứ 5</div>
                                <div class="grid-header" style="grid-column:6;grid-row:1;">Thứ 6</div>
                                <div class="grid-header" style="grid-column:7;grid-row:1;">Thứ 7</div>
                            </div>
                        </div>

                        <!-- CHI TIẾT SIDEBAR bên phải -->
                        <div class="results-sidebar">
                            <h5 class="sidebar-title">📋 Chi tiết phương án</h5>
                            <div id="details-list" class="details-list-vert"></div>
                        </div>

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
    shadowRoot.getElementById("btn-scan").onclick = async () => {
        try {
            showAlert("Đang quét dữ liệu Portal, vui lòng chờ...", "info");

            allCourses = await parseFn(document);

            if (typeof window !== "undefined") window.allCourses = allCourses;
            console.log("HCMUS Planner - Dữ liệu đã nạp:", allCourses);

            if (!allCourses || allCourses.length === 0) {
                showAlert("Không tìm thấy dữ liệu lớp học trên trang này!", "error");
                return;
            }

            const uniqueCodes = [...new Set(allCourses.map(c => c.course_code))];

            // Ẩn placeholder, hiện search + danh sách môn
            shadowRoot.getElementById("course-placeholder").style.display = "none";
            shadowRoot.getElementById("search-wrapper").style.display = "flex";
            shadowRoot.getElementById("course-total-label").textContent = `${uniqueCodes.length} môn học (${allCourses.length} lớp)`;
            shadowRoot.getElementById("course-selection-wrapper").style.display = "flex";

            // Hiện cột phải (tiêu chí + ghim)
            shadowRoot.getElementById("section-constraints").style.display = "flex";
            shadowRoot.getElementById("section-solve-action").style.display = "block";

            renderCourseList(uniqueCodes);
            renderPinClasses();
            showAlert(`Quét thành công ${allCourses.length} lớp (${uniqueCodes.length} môn)!`, "success");

        } catch (e) {
            console.error("Lỗi khi quét dữ liệu:", e);
            showAlert("Xảy ra lỗi trong quá trình quét dữ liệu!", "error");
        }
    };

    shadowRoot.getElementById("course-search").oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = shadowRoot.querySelectorAll("#course-list .course-card");
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

        function renderSelectedChips() {
            const bar = shadowRoot.getElementById("selected-bar");
            const chipsContainer = shadowRoot.getElementById("selected-chips");
            const badge = shadowRoot.getElementById("selected-count-badge");

            if (selectedCodes.length === 0) {
                if (bar) bar.style.display = "none";
                if (badge) badge.style.display = "none";
                return;
            }

            // Hiện bar + badge
            if (bar) bar.style.display = "flex";
            if (badge) {
                badge.style.display = "inline-block";
                badge.textContent = `${selectedCodes.length} môn đã chọn`;
            }

            // Render chip cho từng môn đã chọn
            if (!chipsContainer) return;
            chipsContainer.innerHTML = "";
            selectedCodes.forEach(code => {
                const sample = allCourses.find(c => c.course_code === code);
                const chip = document.createElement("div");
                chip.className = "selected-chip";
                chip.innerHTML = `
                    <span class="chip-code">${code}</span>
                    <span class="chip-name">${sample ? sample.course_name : ''}</span>
                    <button class="chip-remove" data-code="${code}" title="Bỏ chọn">×</button>
                `;
                chip.querySelector(".chip-remove").onclick = (e) => {
                    e.stopPropagation();
                    const c = e.currentTarget.dataset.code;
                    selectedCodes = selectedCodes.filter(x => x !== c);
                    delete forcedClasses[c];
                    // Uncheck card tương ứng
                    const chkEl = shadowRoot.querySelector(`#course-list .chk-course[value="${c}"]`);
                    if (chkEl) {
                        chkEl.checked = false;
                        chkEl.closest(".course-card")?.classList.remove("selected");
                    }
                    renderSelectedChips();
                    renderPinClasses();
                    savePreferences();
                };
                chipsContainer.appendChild(chip);
            });
        }

        // Alias cho các chỗ gọi updateSelectedBadge cũ
        function updateSelectedBadge() { renderSelectedChips(); }

        uniqueCodes.forEach(code => {
            const matches = allCourses.filter(c => c.course_code === code);
            const sample = matches[0];

            const hasLT = matches.some(m => m.type && m.type.includes('LT'));
            const hasTH = matches.some(m => m.type && (m.type.includes('TH') || m.type.includes('BT')));

            const item = document.createElement("div");
            item.className = "course-card" + (selectedCodes.includes(code) ? " selected" : "");

            item.innerHTML = `
                <div class="course-card-check">
                    <input type="checkbox" class="chk-course" value="${code}" ${selectedCodes.includes(code) ? "checked" : ""}>
                </div>
                <div class="course-card-body">
                    <div class="course-card-name">
                        <span class="course-code">${code}</span>
                        <span class="course-name-text">${sample.course_name}</span>
                    </div>
                    <div class="course-card-meta">
                        <span class="badge badge-credits">${sample.credits} TC</span>
                        ${hasLT ? '<span class="badge badge-type-lt">LT</span>' : ''}
                        ${hasTH ? '<span class="badge badge-type-th">TH/BT</span>' : ''}
                        <span class="course-class-count">${matches.length} lớp</span>
                    </div>
                </div>
            `;

            const chk = item.querySelector(".chk-course");
            // Bấm cả thẻ card cũng toggle checkbox
            item.onclick = (e) => {
                if (e.target !== chk) chk.click();
            };
            chk.onclick = (e) => e.stopPropagation();
            chk.onchange = () => {
                if (chk.checked) {
                    if (!selectedCodes.includes(code)) selectedCodes.push(code);
                    item.classList.add("selected");
                } else {
                    selectedCodes = selectedCodes.filter(c => c !== code);
                    item.classList.remove("selected");
                    delete forcedClasses[code];
                }
                updateSelectedBadge();
                renderPinClasses();
                savePreferences();
            };

            container.appendChild(item);
        });

        updateSelectedBadge();
    }

    function renderPinClasses() {
        const container = shadowRoot.getElementById("pin-classes-container");
        container.innerHTML = "";

        if (selectedCodes.length === 0) {
            container.innerHTML = `<span class="pin-empty-msg">Tích chọn môn học ở bên trái để ghim mã lớp</span>`;
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

        // 2. Populate sidebar details (vertical compact cards)
        const detailsList = shadowRoot.getElementById("details-list");
        detailsList.innerHTML = "";

        sched.forEach(course => {
            const detailCard = document.createElement("div");
            detailCard.className = "detail-card-vert";

            const mainSch = course.schedule;
            const timeStr = mainSch
                ? `Thu ${mainSch.day === 8 ? 'CN' : mainSch.day} - Tiet ${mainSch.start_slot}–${mainSch.end_slot}`
                : "Thong bao sau";
            const roomStr = mainSch ? (mainSch.room || "Thong bao sau") : "Thong bao sau";
            const isLTBT = course.type && (course.type.includes('TH') || course.type.includes('BT'));
            detailCard.style.borderLeftColor = isLTBT ? '#f59e0b' : '#6366f1';

            detailCard.innerHTML =
                '<div class="dv-header">' +
                    '<span class="dv-code">' + course.course_code + '</span>' +
                    '<span class="badge ' + (isLTBT ? 'badge-type-th' : 'badge-type-lt') + '">' + course.type + '</span>' +
                '</div>' +
                '<div class="dv-name">' + course.course_name + '</div>' +
                '<div class="dv-rows">' +
                    '<div class="dv-row"><span class="dv-icon">&#127991;</span>' + course.class_code + '</div>' +
                    '<div class="dv-row"><span class="dv-icon">&#128197;</span>' + timeStr + '</div>' +
                    '<div class="dv-row"><span class="dv-icon">&#128205;</span>' + roomStr + '</div>' +
                    '<div class="dv-row"><span class="dv-icon">&#11088;</span>' + course.credits + ' tin chi</div>' +
                '</div>';

            detailsList.appendChild(detailCard);
        });
    }
}