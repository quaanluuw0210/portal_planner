chrome.action.onClicked.addListener(async (tab) => {
    if (!tab || !tab.id) return;

    // Bỏ qua trang hệ thống chrome://
    if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://"))) {
        return;
    }

    try {
        // Thực thi đổi trạng thái display trực tiếp trên tab
        await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: false },
            func: () => {
                const host = document.getElementById("hcmus-shadow-host");
                if (host) {
                    // Nếu đang ẩn (hoặc rỗng) thì hiện, đang hiện thì ẩn
                    host.style.display = (host.style.display === "none" || !host.style.display) ? "block" : "none";
                } else {
                    alert("Chưa nạp kịp giao diện Planner. Bạn hãy bấm F5 lại trang web trường nhé!");
                }
            }
        });
    } catch (err) {
        console.error("HCMUS Auto Planner: Lỗi kích hoạt Overlay", err);
    }
});