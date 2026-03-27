const UPI_APPS = {
    phonepe: { label: "PhonePe", prefix: "phonepe://pay" },
    gpay: { label: "GPay", prefix: "tez://upi/pay" },
    paytm: { label: "Paytm", prefix: "paytmmp://pay" },
    navi: { label: "Navi", prefix: "upi://pay" }
};

const defaultShopConfig = [
    { id: "ravechi", name: "Ravechi", defaultUpi: "9724399962@okbizaxis", defaultApp: "phonepe", defaultAmts: [10, 20, 30] },
    { id: "lafresco", name: "La Fresco", defaultUpi: "paytmqr6clwnr@ptys", defaultApp: "gpay", defaultAmts: [20, 30, 50] },
    { id: "yewale", name: "Yewale", defaultUpi: "gpay-11254199960@okbizaxis", defaultApp: "paytm", defaultAmts: [10, 15, 20] },
    { id: "amul", name: "Amul", defaultUpi: "vyapar.171649456201@hdfcbank", defaultApp: "phonepe", defaultAmts: [15, 25, 40] }
];

let activeScanMode = null;
let html5QrCode = null;
let firebaseAuth = null;
let currentUser = null;

function initApp() {
    bindEvents();
    initFirebaseAuth();
    renderShops();
    updateDashboard();
    renderAnalytics();
}

function bindEvents() {
    const loginBtn = document.getElementById("googleLoginBtn");
    if (loginBtn) loginBtn.addEventListener("click", signInWithGoogle);

    const monthSelect = document.getElementById("monthSelect");
    if (monthSelect) monthSelect.addEventListener("change", updateAnalyticsFromSelection);
}

function setAuthHint(msg) {
    const hint = document.getElementById("authHint");
    if (hint) hint.textContent = msg || "";
}

function isFirebaseConfigReady(config) {
    if (!config) return false;
    return !Object.values(config).some(val => String(val).includes("REPLACE_WITH_"));
}

function initFirebaseAuth() {
    if (!window.firebaseConfig || !isFirebaseConfigReady(window.firebaseConfig)) {
        setAuthHint("Google Sign-In is disabled. Open firebase-config.js and paste your real Firebase values.");
        return;
    }

    try {
        if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseAuth.onAuthStateChanged(handleAuthStateChange);
        setAuthHint("Firebase Auth is connected.");
    } catch (err) {
        console.error("Firebase init error:", err);
        setAuthHint("Firebase initialization failed. Re-check firebase-config.js values.");
    }
}

async function signInWithGoogle() {
    if (!firebaseAuth) {
        alert("Google Sign-In is not ready. Please update firebase-config.js first.");
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            await firebaseAuth.signInWithRedirect(provider);
        } else {
            await firebaseAuth.signInWithPopup(provider);
        }
    } catch (err) {
        console.error("Google sign-in failed:", err);
        if (err.code === "auth/unauthorized-domain") {
            alert("This domain is not authorized in Firebase Auth. Add your domain in Firebase -> Authentication -> Settings -> Authorized domains.");
            return;
        }
        if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user") {
            await firebaseAuth.signInWithRedirect(provider);
            return;
        }
        alert("Google sign-in failed. Check firebase-config.js and authorized domains.");
    }
}

function handleAuthStateChange(user) {
    currentUser = user || null;
    updateAuthUI(currentUser);
}

function updateAuthUI(user) {
    const loggedOutView = document.getElementById("loggedOutView");
    const loggedInView = document.getElementById("loggedInView");
    if (!loggedOutView || !loggedInView) return;

    if (!user) {
        loggedOutView.style.display = "block";
        loggedInView.style.display = "none";
        return;
    }

    document.getElementById("userName").textContent = user.displayName || "No display name";
    document.getElementById("userEmail").textContent = user.email || "No email";
    document.getElementById("userUid").textContent = user.uid || "-";
    loggedOutView.style.display = "none";
    loggedInView.style.display = "block";
}

async function signOutUser() {
    if (!firebaseAuth) return;
    try {
        await firebaseAuth.signOut();
    } catch (err) {
        console.error("Sign-out failed:", err);
        alert("Sign-out failed. Please try again.");
    }
}

window.signOutUser = signOutUser;

function getExpenseHistory() {
    return JSON.parse(localStorage.getItem("campusExpenses")) || [];
}

function setExpenseHistory(history) {
    localStorage.setItem("campusExpenses", JSON.stringify(history));
}

function getAllShops() {
    const userAddedShops = JSON.parse(localStorage.getItem("userAddedShops")) || [];
    return [...defaultShopConfig, ...userAddedShops];
}

function getShopById(shopId) {
    return getAllShops().find(s => s.id === shopId);
}

function getCustomUpis() {
    return JSON.parse(localStorage.getItem("customUpis")) || {};
}

function getUpiId(shopId, defaultUpi) {
    const customUpis = getCustomUpis();
    return customUpis[shopId] || defaultUpi;
}

function getShopAppPrefs() {
    return JSON.parse(localStorage.getItem("shopUpiAppPrefs")) || {};
}

function setShopAppPrefs(prefs) {
    localStorage.setItem("shopUpiAppPrefs", JSON.stringify(prefs));
}

function getInvalidReports() {
    return JSON.parse(localStorage.getItem("invalidQrReports")) || {};
}

function setInvalidReports(value) {
    localStorage.setItem("invalidQrReports", JSON.stringify(value));
}

function getShopStats(shopName, defaultAmts) {
    const history = getExpenseHistory();
    const shopHistory = history.filter(item => item.shop === shopName);
    let total = 0;
    const frequencyMap = {};

    shopHistory.forEach(item => {
        const amt = parseFloat(item.amt);
        total += amt;
        frequencyMap[amt] = (frequencyMap[amt] || 0) + 1;
    });

    const sortedFrequentAmts = Object.keys(frequencyMap)
        .sort((a, b) => frequencyMap[b] - frequencyMap[a])
        .map(Number);
    const smartAmts = [...new Set([...sortedFrequentAmts, ...defaultAmts])].slice(0, 3);
    return { total, suggestedAmts: smartAmts, usageCount: shopHistory.length };
}

function getMostUsedAppKey() {
    const history = getExpenseHistory();
    const count = {};
    history.forEach(item => {
        if (!item.app) return;
        count[item.app] = (count[item.app] || 0) + 1;
    });

    const sorted = Object.keys(count).sort((a, b) => count[b] - count[a]);
    return sorted[0] || null;
}

function getPreferredAppKeyForShop(shop) {
    const appPrefs = getShopAppPrefs();
    if (appPrefs[shop.id] && UPI_APPS[appPrefs[shop.id]]) return appPrefs[shop.id];

    const mostUsed = getMostUsedAppKey();
    if (mostUsed && UPI_APPS[mostUsed]) return mostUsed;

    if (shop.defaultApp && UPI_APPS[shop.defaultApp]) return shop.defaultApp;
    return "phonepe";
}

function sortShopsForDisplay(shops) {
    return shops.sort((a, b) => {
        const aStats = getShopStats(a.name, a.defaultAmts);
        const bStats = getShopStats(b.name, b.defaultAmts);
        if (bStats.usageCount !== aStats.usageCount) return bStats.usageCount - aStats.usageCount;
        return bStats.total - aStats.total;
    });
}

function renderShops() {
    const container = document.getElementById("shopsContainer");
    container.innerHTML = "";

    const allShops = sortShopsForDisplay(getAllShops());
    const reports = getInvalidReports();

    allShops.forEach(shop => {
        const currentUpi = getUpiId(shop.id, shop.defaultUpi);
        const stats = getShopStats(shop.name, shop.defaultAmts);
        const selectedApp = getPreferredAppKeyForShop(shop);

        let buttonsHtml = "";
        stats.suggestedAmts.forEach(amt => {
            buttonsHtml += `<button class="amt-btn" onclick="pay('${shop.id}', ${amt})">₹${amt}</button>`;
        });

        const isCustom = shop.id.startsWith("custom_");
        const reportsCount = reports[shop.id]?.count || 0;
        const qrFlag = reportsCount >= 2 ? `<div class="auth-hint">QR reported invalid ${reportsCount} times</div>` : "";

        const html = `
        <div class="shop-card">
            <div class="shop-header">
                ${shop.name}
                <div class="badge-group">
                    <span class="app-badge">${UPI_APPS[selectedApp].label}</span>
                    ${isCustom
                        ? `<button class="icon-btn" onclick="deleteShop('${shop.id}')" style="color:#ff5252;" title="Delete Shop">🗑️</button>`
                        : `<button class="icon-btn" onclick="openScanner('${shop.id}')" title="Update QR">📷</button>`}
                </div>
            </div>
            <div class="shop-sub-header">
                <span>Total Spent Here: <strong style="color:#bb86fc">₹${stats.total.toFixed(0)}</strong></span>
            </div>
            <div class="shop-controls">
                <select class="shop-select" onchange="changeUpiApp('${shop.id}', this.value)">
                    ${Object.keys(UPI_APPS).map(appKey => `<option value="${appKey}" ${appKey === selectedApp ? "selected" : ""}>Pay with ${UPI_APPS[appKey].label}</option>`).join("")}
                </select>
                <button class="tiny-btn" onclick="resetShopHistory('${shop.name}')">Reset Shop</button>
                <button class="tiny-btn warn-btn" onclick="reportInvalidQr('${shop.id}')">Report QR</button>
            </div>
            ${qrFlag}
            <div class="amt-row">
                ${buttonsHtml}
                <button class="amt-btn custom-btn" onclick="payCustom('${shop.id}')">...</button>
            </div>
            <div class="auth-user" style="margin-top:8px;">UPI: ${currentUpi}</div>
        </div>`;
        container.innerHTML += html;
    });
}

function changeUpiApp(shopId, appKey) {
    if (!UPI_APPS[appKey]) return;
    const prefs = getShopAppPrefs();
    prefs[shopId] = appKey;
    setShopAppPrefs(prefs);
    renderShops();
}

function pay(shopId, amount) {
    const shop = getShopById(shopId);
    if (!shop) return;

    const appKey = getPreferredAppKeyForShop(shop);
    const appMeta = UPI_APPS[appKey] || UPI_APPS.phonepe;
    const upiId = getUpiId(shop.id, shop.defaultUpi);
    const numericAmount = parseFloat(amount);

    saveExpense(shop.name, numericAmount, appKey);
    const url = `${appMeta.prefix}?pa=${upiId}&pn=${encodeURIComponent(shop.name)}&am=${numericAmount}&cu=INR`;
    setTimeout(() => { window.location.href = url; }, 100);
}

function payCustom(shopId) {
    const shop = getShopById(shopId);
    if (!shop) return;
    const amount = prompt(`Enter custom amount for ${shop.name}:`, "");
    if (amount && !isNaN(amount) && Number(amount) > 0) pay(shop.id, Number(amount));
}

function saveExpense(shopName, amount, appKey) {
    const history = getExpenseHistory();
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    history.unshift({
        shop: shopName,
        amt: Number(amount),
        app: appKey || "phonepe",
        time: timeStr,
        createdAt: now.toISOString()
    });

    if (history.length > 400) history.pop();
    setExpenseHistory(history);
    renderShops();
    updateDashboard();
    renderAnalytics();
}

function openScanner(mode) {
    activeScanMode = mode;
    document.getElementById("scanner-title").innerText = mode === "NEW_SHOP" ? "Scan New Shop QR" : "Update Shop QR";
    document.getElementById("scanner-modal").style.display = "flex";

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 5, qrbox: { width: 250, height: 250 } }, onScanSuccess)
        .catch(() => { alert("Camera error or permission denied."); closeScanner(); });
}

function onScanSuccess(decodedText) {
    const match = decodedText.match(/pa=([^&]+)/);
    if (!match || !match[1]) {
        alert("Invalid QR format. Could not find UPI ID.");
        closeScanner();
        return;
    }

    const extractedUpi = match[1];
    closeScanner();

    setTimeout(() => {
        if (activeScanMode === "NEW_SHOP") {
            const newName = prompt("QR Scanned! Enter a name for this new shop:");
            if (!newName) return;

            const userAddedShops = JSON.parse(localStorage.getItem("userAddedShops")) || [];
            userAddedShops.push({
                id: "custom_" + Date.now(),
                name: "Shop " + newName,
                defaultUpi: extractedUpi,
                defaultApp: getMostUsedAppKey() || "phonepe",
                defaultAmts: [10, 20, 50]
            });
            localStorage.setItem("userAddedShops", JSON.stringify(userAddedShops));
            renderShops();
            return;
        }

        const customUpis = getCustomUpis();
        customUpis[activeScanMode] = extractedUpi;
        localStorage.setItem("customUpis", JSON.stringify(customUpis));
        alert("QR updated successfully.");
        renderShops();

        const shop = getShopById(activeScanMode);
        if (!shop) return;
        const quickAmount = getShopStats(shop.name, shop.defaultAmts).suggestedAmts[0] || 10;
        const shouldPayNow = confirm(`Do you want to pay now at ${shop.name} for ₹${quickAmount}?`);
        if (shouldPayNow) pay(shop.id, quickAmount);
    }, 250);
}

function closeScanner() {
    document.getElementById("scanner-modal").style.display = "none";
    if (!html5QrCode) return;
    html5QrCode.stop().then(() => html5QrCode.clear()).catch(e => console.log(e));
}

function deleteShop(shopId) {
    if (!confirm("Remove this custom shop?")) return;
    let userAddedShops = JSON.parse(localStorage.getItem("userAddedShops")) || [];
    userAddedShops = userAddedShops.filter(s => s.id !== shopId);
    localStorage.setItem("userAddedShops", JSON.stringify(userAddedShops));
    renderShops();
}

function resetShopHistory(shopName) {
    if (!confirm(`Reset spending history for ${shopName}?`)) return;
    const history = getExpenseHistory().filter(item => item.shop !== shopName);
    setExpenseHistory(history);
    renderShops();
    updateDashboard();
    renderAnalytics();
}

function reportInvalidQr(shopId) {
    const reports = getInvalidReports();
    const prev = reports[shopId] || { count: 0 };
    reports[shopId] = { count: prev.count + 1, lastReportedAt: new Date().toISOString() };
    setInvalidReports(reports);
    alert("Thanks. QR issue report saved.");
    renderShops();
}

function updateDashboard() {
    const history = getExpenseHistory();
    let total = 0;
    let historyHTML = "";

    history.forEach((item, index) => {
        total += parseFloat(item.amt || 0);
        if (index < 5) {
            const appLabel = UPI_APPS[item.app]?.label || "UPI";
            historyHTML += `<div class="history-item"><span>${item.shop} <small style="color:#666">(${item.time})</small></span> <span>₹${item.amt} <small style="color:#888">${appLabel}</small></span></div>`;
        }
    });

    document.getElementById("totalSpent").innerText = "₹" + total.toFixed(0);
    document.getElementById("historyContainer").innerHTML = historyHTML || "<div style='color:#666'>No spends yet</div>";
}

function clearHistory() {
    if (!confirm("Erase ALL tracking history?")) return;
    localStorage.removeItem("campusExpenses");
    renderShops();
    updateDashboard();
    renderAnalytics();
}

function getMonthKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleString([], { month: "long", year: "numeric" });
}

function renderAnalytics() {
    const history = getExpenseHistory();
    const monthSelect = document.getElementById("monthSelect");
    if (!monthSelect) return;

    const monthTotals = {};
    history.forEach(item => {
        const dt = item.createdAt ? new Date(item.createdAt) : new Date();
        const key = getMonthKey(dt);
        monthTotals[key] = (monthTotals[key] || 0) + parseFloat(item.amt || 0);
    });

    const keys = Object.keys(monthTotals).sort((a, b) => b.localeCompare(a));
    monthSelect.innerHTML = "";

    if (!keys.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No data yet";
        monthSelect.appendChild(opt);
        document.getElementById("monthSpent").textContent = "₹0";
        document.getElementById("yearSpent").textContent = "₹0";
        return;
    }

    keys.forEach(key => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = formatMonthLabel(key);
        monthSelect.appendChild(opt);
    });

    updateAnalyticsFromSelection();
}

function updateAnalyticsFromSelection() {
    const history = getExpenseHistory();
    const monthSelect = document.getElementById("monthSelect");
    const selectedMonth = monthSelect ? monthSelect.value : "";
    if (!selectedMonth) return;

    let monthTotal = 0;
    let yearTotal = 0;
    const selectedYear = selectedMonth.split("-")[0];

    history.forEach(item => {
        const dt = item.createdAt ? new Date(item.createdAt) : new Date();
        const itemMonth = getMonthKey(dt);
        const itemYear = String(dt.getFullYear());
        const amt = parseFloat(item.amt || 0);

        if (itemMonth === selectedMonth) monthTotal += amt;
        if (itemYear === selectedYear) yearTotal += amt;
    });

    document.getElementById("monthSpent").textContent = `₹${monthTotal.toFixed(0)}`;
    document.getElementById("yearSpent").textContent = `₹${yearTotal.toFixed(0)}`;
}

function buildExpensesCSV(history) {
    const rows = [["Shop", "Amount", "Time", "Date", "UPI App"]];
    history.forEach(item => {
        rows.push([
            item.shop,
            item.amt,
            item.time,
            item.createdAt || "",
            UPI_APPS[item.app]?.label || "UPI"
        ]);
    });

    return rows
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
        .join("\n");
}

function exportExpensesCSV() {
    const history = getExpenseHistory();
    if (!history.length) {
        alert("No expenses to export yet.");
        return;
    }

    const csv = buildExpensesCSV(history);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `campus-pay-expenses-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function shareExpensesReport() {
    const history = getExpenseHistory();
    if (!history.length) {
        alert("No expenses to share yet.");
        return;
    }

    const total = history.reduce((sum, item) => sum + parseFloat(item.amt || 0), 0);
    const top5 = history.slice(0, 5)
        .map(item => `- ${item.shop}: INR ${item.amt} (${item.time})`)
        .join("\n");

    const report = [
        "Campus Pay Expense Report",
        `Total Spent: INR ${total.toFixed(2)}`,
        "",
        "Recent spends:",
        top5
    ].join("\n");

    if (navigator.share) {
        try {
            await navigator.share({ title: "Campus Pay Expense Report", text: report });
            return;
        } catch (e) {
            // ignored
        }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(report);
            alert("Report copied. Paste it into WhatsApp or email.");
            return;
        } catch (e) {
            // ignored
        }
    }

    window.prompt("Copy and share this report:", report);
}

initApp();
