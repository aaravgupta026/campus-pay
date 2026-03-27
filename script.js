const UPI_APPS = {
    phonepe: { label: "PhonePe", prefix: "phonepe://pay" },
    gpay: { label: "GPay", prefix: "tez://upi/pay" },
    paytm: { label: "Paytm", prefix: "paytmmp://pay" },
    navi: { label: "Navi", prefix: "upi://pay", generic: true },
    amazonpay: { label: "Amazon Pay", prefix: "upi://pay", generic: true },
    samsungwallet: { label: "Samsung Wallet", prefix: "upi://pay", generic: true },
    mobikwik: { label: "MobiKwik", prefix: "upi://pay", generic: true },
    yonosbi: { label: "YONO SBI", prefix: "upi://pay", generic: true }
};

const SHOP_LOCATIONS = {
    ravechi: { lat: 23.0225, lng: 72.5714 },
    lafresco: { lat: 23.0235, lng: 72.5720 },
    yewale: { lat: 23.0219, lng: 72.5702 },
    amul: { lat: 23.0244, lng: 72.5734 }
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
let firebaseDb = null;
let currentUser = null;
let userLocation = null;
let cloudSyncInProgress = false;

function initApp() {
    bindEvents();
    initFirebase();
    renderShops();
    updateDashboard();
    renderAnalytics();
}

function bindEvents() {
    const loginBtn = document.getElementById("googleLoginBtn");
    if (loginBtn) loginBtn.addEventListener("click", signInWithGoogle);

    const emailSignInBtn = document.getElementById("emailSignInBtn");
    if (emailSignInBtn) emailSignInBtn.addEventListener("click", signInWithEmailPassword);

    const emailSignUpBtn = document.getElementById("emailSignUpBtn");
    if (emailSignUpBtn) emailSignUpBtn.addEventListener("click", signUpWithEmailPassword);

    const monthSelect = document.getElementById("monthSelect");
    if (monthSelect) monthSelect.addEventListener("change", updateAnalyticsFromSelection);
}

function setAuthHint(msg) {
    const hint = document.getElementById("authHint");
    if (hint) hint.textContent = msg || "";
}

function setLocationHint(msg) {
    const hint = document.getElementById("locationHint");
    if (hint) hint.textContent = msg || "";
}

function isFirebaseConfigReady(config) {
    if (!config) return false;
    return !Object.values(config).some(val => String(val).includes("REPLACE_WITH_"));
}

function initFirebase() {
    if (!window.firebaseConfig || !isFirebaseConfigReady(window.firebaseConfig)) {
        setAuthHint("Google Sign-In is disabled. Open firebase-config.js and paste your real Firebase values.");
        return;
    }

    try {
        if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();

        firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch(err => console.error("Auth persistence failed:", err));

        firebaseAuth.getRedirectResult()
            .then(() => {})
            .catch(err => {
                console.error("Redirect sign-in failed:", err);
                setAuthHint(`Redirect sign-in failed: ${err.code || "unknown"}`);
            });

        firebaseAuth.onAuthStateChanged(handleAuthStateChange);
        setAuthHint("");
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
        await firebaseAuth.signInWithPopup(provider);
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
        alert(`Google sign-in failed: ${err.code || "unknown"}`);
    }
}

function getEmailPasswordInput() {
    const emailEl = document.getElementById("emailInput");
    const passEl = document.getElementById("passwordInput");
    const email = emailEl ? emailEl.value.trim() : "";
    const password = passEl ? passEl.value : "";
    return { email, password };
}

async function signInWithEmailPassword() {
    if (!firebaseAuth) {
        alert("Auth is not ready yet.");
        return;
    }

    const { email, password } = getEmailPasswordInput();
    if (!email || !password) {
        alert("Enter both email and password.");
        return;
    }

    try {
        await firebaseAuth.signInWithEmailAndPassword(email, password);
        setAuthHint("Signed in with email/password.");
    } catch (err) {
        console.error("Email sign-in failed:", err);
        alert(`Email sign-in failed: ${err.code || "unknown"}`);
    }
}

async function signUpWithEmailPassword() {
    if (!firebaseAuth) {
        alert("Auth is not ready yet.");
        return;
    }

    const { email, password } = getEmailPasswordInput();
    if (!email || !password) {
        alert("Enter both email and password.");
        return;
    }

    if (password.length < 6) {
        alert("Password should be at least 6 characters.");
        return;
    }

    try {
        await firebaseAuth.createUserWithEmailAndPassword(email, password);
        setAuthHint("Account created successfully.");
    } catch (err) {
        console.error("Email sign-up failed:", err);
        alert(`Email sign-up failed: ${err.code || "unknown"}`);
    }
}

async function handleAuthStateChange(user) {
    currentUser = user || null;
    updateAuthUI(currentUser);

    if (!currentUser || !firebaseDb) {
        return;
    }

    setAuthHint("");

    await syncLocalExpensesToCloud();
    await loadCloudExpenses();
}

function updateAuthUI(user) {
    const loggedOutView = document.getElementById("loggedOutView");
    const loggedInView = document.getElementById("loggedInView");
    const helloBanner = document.getElementById("helloBanner");

    if (!loggedOutView || !loggedInView) return;

    if (!user) {
        loggedOutView.style.display = "block";
        loggedInView.style.display = "none";
        if (helloBanner) helloBanner.textContent = "Hello, User";
        return;
    }

    const displayName = user.displayName || "User";
    document.getElementById("userName").textContent = displayName;
    document.getElementById("userEmail").textContent = user.email || "No email";
    document.getElementById("userUid").textContent = user.uid || "-";
    if (helloBanner) helloBanner.textContent = `Hello, ${displayName.split(" ")[0]}`;

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

function requestLocation() {
    if (!navigator.geolocation) {
        setLocationHint("Geolocation not available on this browser. Using most-used shop order.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocationHint("Location enabled. Nearest shops are now shown first.");
            renderShops();
        },
        () => {
            userLocation = null;
            setLocationHint("Location denied. Using most-used shops first.");
            renderShops();
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

window.requestLocation = requestLocation;

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

function toRad(val) {
    return (val * Math.PI) / 180;
}

function getDistanceKm(a, b) {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
}

function sortShopsForDisplay(shops) {
    return shops.sort((a, b) => {
        if (userLocation && SHOP_LOCATIONS[a.id] && SHOP_LOCATIONS[b.id]) {
            const distA = getDistanceKm(userLocation, SHOP_LOCATIONS[a.id]);
            const distB = getDistanceKm(userLocation, SHOP_LOCATIONS[b.id]);
            if (Math.abs(distA - distB) > 0.05) return distA - distB;
        }

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

window.changeUpiApp = changeUpiApp;

function makeExpenseItem(shopName, amount, appKey) {
    const now = new Date();
    return {
        localId: `${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        shop: shopName,
        amt: Number(amount),
        app: appKey || "phonepe",
        time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: now.toISOString()
    };
}

function pay(shopId, amount) {
    const shop = getShopById(shopId);
    if (!shop) return;

    const appKey = getPreferredAppKeyForShop(shop);
    const appMeta = UPI_APPS[appKey] || UPI_APPS.phonepe;
    const upiId = getUpiId(shop.id, shop.defaultUpi);
    const numericAmount = parseFloat(amount);

    const expense = makeExpenseItem(shop.name, numericAmount, appKey);
    saveExpense(expense);

    // For generic UPI handlers, Android may show a chooser or open-with prompt.
    if (appMeta.generic && localStorage.getItem("genericUpiTipSeen") !== "1") {
        alert("This app uses generic UPI open. Android may ask once or twice to choose/open the UPI app. This is expected behavior.");
        localStorage.setItem("genericUpiTipSeen", "1");
    }

    const url = `${appMeta.prefix}?pa=${upiId}&pn=${encodeURIComponent(shop.name)}&am=${numericAmount}&cu=INR`;
    setTimeout(() => { window.location.href = url; }, 100);
}

window.pay = pay;

function payCustom(shopId) {
    const shop = getShopById(shopId);
    if (!shop) return;
    const amount = prompt(`Enter custom amount for ${shop.name}:`, "");
    if (amount && !isNaN(amount) && Number(amount) > 0) pay(shop.id, Number(amount));
}

window.payCustom = payCustom;

function saveExpense(expenseItem) {
    const history = getExpenseHistory();
    history.unshift(expenseItem);
    if (history.length > 500) history.pop();
    setExpenseHistory(history);
    renderShops();
    updateDashboard();
    renderAnalytics();
    saveExpenseToCloud(expenseItem);
}

async function saveExpenseToCloud(expenseItem) {
    if (!currentUser || !firebaseDb || !expenseItem?.localId) return;
    try {
        const payload = { ...expenseItem, userId: currentUser.uid };
        await firebaseDb
            .collection("users")
            .doc(currentUser.uid)
            .collection("expenses")
            .doc(expenseItem.localId)
            .set(payload, { merge: true });

        // Fallback for rule sets that use a top-level expenses collection.
        await firebaseDb
            .collection("expenses")
            .doc(`${currentUser.uid}_${expenseItem.localId}`)
            .set(payload, { merge: true });
    } catch (err) {
        console.error("Cloud save failed:", err);
        setAuthHint(`Cloud save failed: ${err.code || "unknown"}`);
    }
}

async function syncLocalExpensesToCloud() {
    if (!currentUser || !firebaseDb || cloudSyncInProgress) return;
    cloudSyncInProgress = true;
    try {
        const history = getExpenseHistory();
        for (const item of history) {
            if (!item.localId) continue;
            const payload = { ...item, userId: currentUser.uid };

            await firebaseDb
                .collection("users")
                .doc(currentUser.uid)
                .collection("expenses")
                .doc(item.localId)
                .set(payload, { merge: true });

            await firebaseDb
                .collection("expenses")
                .doc(`${currentUser.uid}_${item.localId}`)
                .set(payload, { merge: true });
        }
    } catch (err) {
        console.error("Cloud sync failed:", err);
        setAuthHint(`Cloud sync failed: ${err.code || "unknown"}`);
    } finally {
        cloudSyncInProgress = false;
    }
}

async function loadCloudExpenses() {
    if (!currentUser || !firebaseDb) return;
    try {
        const snap = await firebaseDb
            .collection("users")
            .doc(currentUser.uid)
            .collection("expenses")
            .orderBy("createdAt", "desc")
            .limit(500)
            .get();

        let cloudItems = snap.docs.map(d => d.data());

        if (!cloudItems.length) {
            const fallbackSnap = await firebaseDb
                .collection("expenses")
                .where("userId", "==", currentUser.uid)
                .get();

            cloudItems = fallbackSnap.docs.map(d => d.data())
                .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        }

        if (!cloudItems.length) return;

        setExpenseHistory(cloudItems);
        renderShops();
        updateDashboard();
        renderAnalytics();
    } catch (err) {
        console.error("Cloud load failed:", err);
        setAuthHint("Signed in, but cloud fetch failed. Check Firestore rules/index.");
    }
}

function openScanner(mode) {
    activeScanMode = mode;
    document.getElementById("scanner-title").innerText = mode === "NEW_SHOP" ? "Scan New Shop QR" : "Update Shop QR";
    document.getElementById("scanner-modal").style.display = "flex";

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 5, qrbox: { width: 250, height: 250 } }, onScanSuccess)
        .catch(() => { alert("Camera error or permission denied."); closeScanner(); });
}

window.openScanner = openScanner;

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

window.closeScanner = closeScanner;

function deleteShop(shopId) {
    if (!confirm("Remove this custom shop?")) return;
    let userAddedShops = JSON.parse(localStorage.getItem("userAddedShops")) || [];
    userAddedShops = userAddedShops.filter(s => s.id !== shopId);
    localStorage.setItem("userAddedShops", JSON.stringify(userAddedShops));
    renderShops();
}

window.deleteShop = deleteShop;

function resetShopHistory(shopName) {
    if (!confirm(`Reset spending history for ${shopName}?`)) return;
    const history = getExpenseHistory().filter(item => item.shop !== shopName);
    setExpenseHistory(history);
    renderShops();
    updateDashboard();
    renderAnalytics();
    syncLocalExpensesToCloud();
}

window.resetShopHistory = resetShopHistory;

function reportInvalidQr(shopId) {
    const reports = getInvalidReports();
    const prev = reports[shopId] || { count: 0 };
    reports[shopId] = { count: prev.count + 1, lastReportedAt: new Date().toISOString() };
    setInvalidReports(reports);
    alert("Thanks. QR issue report saved.");
    renderShops();
}

window.reportInvalidQr = reportInvalidQr;

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
    syncLocalExpensesToCloud();
}

window.clearHistory = clearHistory;

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

function getSelectedMonthKey() {
    const monthSelect = document.getElementById("monthSelect");
    return monthSelect ? monthSelect.value : "";
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

    const selectedBefore = monthSelect.value;
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

    monthSelect.value = keys.includes(selectedBefore) ? selectedBefore : keys[0];
    updateAnalyticsFromSelection();
}

function updateAnalyticsFromSelection() {
    const history = getExpenseHistory();
    const selectedMonth = getSelectedMonthKey();
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

function toCSV(rows) {
    return rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCSV(fileName, csvText) {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    return toCSV(rows);
}

function exportExpensesCSV() {
    const history = getExpenseHistory();
    if (!history.length) {
        alert("No expenses to export yet.");
        return;
    }
    const today = new Date().toISOString().slice(0, 10);
    downloadCSV(`campus-pay-expenses-${today}.csv`, buildExpensesCSV(history));
}

window.exportExpensesCSV = exportExpensesCSV;

function exportSelectedMonthCSV() {
    const history = getExpenseHistory();
    const selectedMonth = getSelectedMonthKey();
    if (!selectedMonth) {
        alert("No month selected.");
        return;
    }

    const selectedRows = history.filter(item => {
        const dt = item.createdAt ? new Date(item.createdAt) : new Date();
        return getMonthKey(dt) === selectedMonth;
    });

    if (!selectedRows.length) {
        alert("No data available for selected month.");
        return;
    }

    const label = selectedMonth.replace("-", "_");
    downloadCSV(`campus-pay-month-${label}.csv`, buildExpensesCSV(selectedRows));
}

window.exportSelectedMonthCSV = exportSelectedMonthCSV;

function exportYearSummaryReport() {
    const history = getExpenseHistory();
    if (!history.length) {
        alert("No expenses to export yet.");
        return;
    }

    const yearlyTotals = {};
    history.forEach(item => {
        const dt = item.createdAt ? new Date(item.createdAt) : new Date();
        const y = String(dt.getFullYear());
        yearlyTotals[y] = (yearlyTotals[y] || 0) + parseFloat(item.amt || 0);
    });

    const rows = [["Year", "Total Spent"]];
    Object.keys(yearlyTotals).sort().forEach(year => rows.push([year, yearlyTotals[year].toFixed(2)]));
    downloadCSV("campus-pay-year-summary.csv", toCSV(rows));
}

window.exportYearSummaryReport = exportYearSummaryReport;

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

window.shareExpensesReport = shareExpensesReport;

initApp();
