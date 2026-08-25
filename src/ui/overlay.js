
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

            const labelEl = shadowRoot.getElementById("course-total-label");
            labelEl.textContent = `${uniqueCodes.length} môn học (${allCourses.length} lớp)`;

            // Xóa nút xem chi tiết lớp hết chỗ cũ nếu có
            const oldBtn = shadowRoot.getElementById("btn-show-full-classes");
            if (oldBtn) oldBtn.remove();

            const fullMain = allCourses.fullMainClassesCount || 0;
            const fullSub = allCourses.fullSubClassesCount || 0;
            if (fullMain > 0 || fullSub > 0) {
                const headerEl = shadowRoot.getElementById("course-list-header");
                const btn = document.createElement("button");
                btn.id = "btn-show-full-classes";
                btn.className = "btn-view-full-classes";
                btn.innerHTML = `⚠️ Đã ẩn ${fullMain + fullSub} lớp hết chỗ <span>[Xem chi tiết]</span>`;
                btn.onclick = () => {
                    showFullClassesModal(allCourses.fullClasses || []);
                };
                headerEl.appendChild(btn);
            }

            shadowRoot.getElementById("course-selection-wrapper").style.display = "flex";

            // Hiện cột phải (tiêu chí + ghim)
            shadowRoot.getElementById("section-constraints").style.display = "flex";
            shadowRoot.getElementById("section-solve-action").style.display = "block";

            renderCourseList(uniqueCodes);
            renderPinClasses();

            let alertText = `Quét thành công ${allCourses.length} lớp (${uniqueCodes.length} môn)!`;
            if (fullMain > 0 || fullSub > 0) {
                alertText += ` (Đã bỏ qua ${fullMain + fullSub} lớp hết chỗ)`;
            }
            showAlert(alertText, "success");

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
            // Tự động kích hoạt tải ảnh thời khóa biểu về máy
            downloadScheduleImage(currentSched, activeScheduleIndex + 1);

            const saved = await storageObj.getSavedSchedules();
            const serializedSched = JSON.stringify(currentSched.map(c => ({ course_code: c.course_code, class_code: c.class_code })));
            const exists = saved.some(s => JSON.stringify(s.map(c => ({ course_code: c.course_code, class_code: c.class_code }))) === serializedSched);

            if (exists) {
                showAlert("Đã tải ảnh TKB! (TKB này đã được lưu vào danh sách từ trước)", "info");
                return;
            }
            saved.push(currentSched);
            await storageObj.saveSavedSchedules(saved);
            showAlert(`Đã lưu vào danh sách & Tải xuống ảnh Phương án ${activeScheduleIndex + 1}!`, "success");
        } catch (err) {
            console.error(err);
            showAlert("Có lỗi xảy ra khi lưu thời khóa biểu!", "error");
        }
    };

    // Hàm tạo và xuất file ảnh thời khóa biểu (PNG) sử dụng HTML5 Canvas
    function downloadScheduleImage(sched, planNumber) {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 850;
        const ctx = canvas.getContext("2d");

        // 1. Tạo hình nền trắng sạch
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Vẽ viền trang trí cho ảnh xuất ra
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

        // 2. Vẽ Tiêu đề TKB
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`THỜI KHÓA BIỂU ĐÃ XẾP - PHƯƠNG ÁN ${planNumber}`, canvas.width / 2, 30);

        ctx.font = "italic 13px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText("Tạo tự động bởi HCMUS Schedule Auto Planner Extension", canvas.width / 2, 60);

        // Cấu hình vị trí và kích thước lưới
        const startX = 85;
        const startY = 100;
        const gridWidth = canvas.width - startX - 45;
        const gridHeight = canvas.height - startY - 45;
        const colWidth = gridWidth / 6; // 6 cột đại diện từ Thứ 2 -> Thứ 7
        const rowHeight = gridHeight / 12; // 12 tiết học cơ bản

        // Vẽ Tên Thứ (Cột)
        const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
        ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#1e293b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        weekdays.forEach((day, index) => {
            const x = startX + index * colWidth + colWidth / 2;
            const y = startY - 20;
            ctx.fillText(day, x, y);
        });

        // Vẽ Lưới tọa độ
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;

        // Vẽ các cột dọc
        for (let i = 0; i <= 6; i++) {
            const x = startX + i * colWidth;
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, startY + gridHeight);
            ctx.stroke();
        }

        // Vẽ các dòng ngang & Nhãn Tiết học bên trái
        ctx.font = "600 12px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#475569";
        ctx.textAlign = "right";

        for (let i = 0; i <= 12; i++) {
            const y = startY + i * rowHeight;
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(startX + gridWidth, y);
            ctx.stroke();

            if (i < 12) {
                ctx.fillText(`Tiết ${i + 1}`, startX - 12, y + rowHeight / 2);
            }
        }

        // 3. Phân bổ màu sắc ngẫu nhiên solid đẹp mắt cho các môn
        const uniqueCourseCodes = [...new Set(sched.map(c => c.course_code))];
        const colorMap = {};
        const canvasColors = ['#4f46e5', '#059669', '#d97706', '#9333ea', '#e11d48', '#0891b2', '#ea580c', '#0d9488'];
        uniqueCourseCodes.forEach((code, idx) => {
            colorMap[code] = canvasColors[idx % canvasColors.length];
        });

        // Helper: Tự động xuống dòng cho tên môn học dài
        function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
            const words = text.split(" ");
            let line = "";
            const lines = [];

            for (let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + " ";
                let metrics = context.measureText(testLine);
                let testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + " ";
                } else {
                    line = testLine;
                }
            }
            lines.push(line);

            // Bắt đầu vẽ từ tâm theo chiều dọc
            const totalHeight = lines.length * lineHeight;
            let currentY = y - totalHeight / 2 + lineHeight / 2;

            lines.forEach(l => {
                context.fillText(l.trim(), x, currentY);
                currentY += lineHeight;
            });
        }

        // 4. Vẽ các lớp học (LT + TH) lên lưới lịch học
        sched.forEach(course => {
            const sessionList = (course.schedules && course.schedules.length > 0)
                ? course.schedules
                : (course.schedule ? [course.schedule] : []);

            const color = colorMap[course.course_code];

            sessionList.forEach((sch, sIdx) => {
                if (!sch || !sch.day || sch.day < 2 || sch.day > 7) return;

                const colIndex = sch.day - 2; // Ngày 2 -> Cột 0
                const startRow = sch.start_slot - 1; // Tiết 1 -> Dòng 0
                const duration = sch.end_slot - sch.start_slot + 1; // Số tiết chiếm dụng

                // Tính toán vị trí hình chữ nhật đại diện lớp học
                const x = startX + colIndex * colWidth + 3;
                const y = startY + startRow * rowHeight + 3;
                const w = colWidth - 6;
                const h = duration * rowHeight - 6;

                // Vẽ box lớp học bo tròn các góc
                ctx.fillStyle = color;
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(x, y, w, h, 6);
                } else {
                    ctx.rect(x, y, w, h);
                }
                ctx.fill();

                // Viết chữ mô tả môn học
                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const tag = sessionList.length > 1 ? (sIdx === 0 ? " [LT]" : " [TH]") : "";
                const displayTitle = `${course.course_name}${tag}`;

                // Tên môn học (Bo font chữ to/đậm)
                ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
                drawWrappedText(ctx, displayTitle, x + w / 2, y + h / 2 - 12, w - 8, 13);

                // Mã lớp học + Phòng học (Font nhỏ hơn nằm bên dưới)
                ctx.font = "500 10px system-ui, -apple-system, sans-serif";
                ctx.fillText(`Lớp: ${course.class_code}`, x + w / 2, y + h - 23);
                ctx.fillText(`Phòng: ${sch.room || "Thông báo sau"}`, x + w / 2, y + h - 11);
            });
        });

        // 5. Kết xuất ảnh ra DataURL và tự động download về thiết bị
        try {
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = `TKB_HCMUS_PhuongAn_${planNumber}.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error("Lỗi khi tạo ảnh TKB:", e);
        }
    }

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

    function showFullClassesModal(fullClasses) {
        if (shadowRoot.getElementById("sub-modal-root")) return;

        const subModal = document.createElement("div");
        subModal.id = "sub-modal-root";
        subModal.className = "sub-modal-backdrop";

        let tableRows = "";
        if (fullClasses.length === 0) {
            tableRows = `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">Không có thông tin lớp hết chỗ</td></tr>`;
        } else {
            fullClasses.forEach(item => {
                tableRows += `
                    <tr>
                        <td><b>${item.course_code}</b></td>
                        <td>${item.course_name}</td>
                        <td><span class="badge badge-credits" style="background:#f1f5f9;color:#475569;">${item.class_code}</span></td>
                        <td><span class="badge ${item.type.includes('chính') ? 'badge-type-lt' : 'badge-type-th'}">${item.type}</span></td>
                        <td style="color:#ef4444;font-weight:600;">${item.reason}</td>
                    </tr>
                `;
            });
        }

        subModal.innerHTML = `
            <div class="sub-modal-container">
                <div class="sub-modal-header">
                    <h4 class="sub-modal-title">⚠️ Danh sách lớp học đã đầy chỗ</h4>
                    <button class="sub-modal-close" id="btn-close-sub-modal">&times;</button>
                </div>
                <div class="sub-modal-body">
                    <table class="full-classes-table">
                        <thead>
                            <tr>
                                <th>Mã môn</th>
                                <th>Tên môn</th>
                                <th>Mã lớp</th>
                                <th>Phân loại</th>
                                <th>Lý do bỏ qua</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        subModal.querySelector("#btn-close-sub-modal").onclick = () => {
            subModal.remove();
        };

        subModal.onclick = (e) => {
            if (e.target === subModal) {
                subModal.remove();
            }
        };

        shadowRoot.querySelector(".modal-container-full").appendChild(subModal);
    }
}