const defaultShopConfig = [
    { id: "ravechi", name: "☕ Ravechi", defaultUpi: "9724399962@okbizaxis", prefix: "phonepe://pay", badge: "PhonePe", defaultAmts: [10, 20, 30] },
    { id: "lafresco", name: "🍕 La Fresco", defaultUpi: "paytmqr6clwnr@ptys", prefix: "tez://upi/pay", badge: "GPay", defaultAmts: [20, 30, 50] },
    { id: "yewale", name: "☕ Yewale", defaultUpi: "gpay-11254199960@okbizaxis", prefix: "paytmmp://pay", badge: "Paytm", defaultAmts: [10, 15, 20] },
    { id: "amul", name: "🍦 Amul", defaultUpi: "vyapar.171649456201@hdfcbank", prefix: "phonepe://pay", badge: "PhonePe", defaultAmts: [15, 25, 40] }
];

let activeScanMode = null; // Can be 'NEW_SHOP' or a specific shop ID
let html5QrCode = null;
let firebaseAuth = null;
let currentUser = null;

function initApp() {
    initFirebaseAuth();
    renderShops();
    updateDashboard();
}

function initFirebaseAuth() {
    if (!window.firebaseConfig) {
        console.warn("firebaseConfig not found. Create firebase-config.js to enable Google Sign-In.");
        return;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(window.firebaseConfig);
        }

        firebaseAuth = firebase.auth();
        bindAuthEvents();
        firebaseAuth.onAuthStateChanged(handleAuthStateChange);
    } catch (err) {
        console.error("Firebase init error:", err);
    }
}

function bindAuthEvents() {
    const loginBtn = document.getElementById("googleLoginBtn");
    if (!loginBtn) return;
    loginBtn.addEventListener("click", signInWithGoogle);
}

async function signInWithGoogle() {
    if (!firebaseAuth) {
        alert("Firebase Auth is not initialized.");
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
        await firebaseAuth.signInWithPopup(provider);
    } catch (err) {
        if (err && (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user")) {
            await firebaseAuth.signInWithRedirect(provider);
            return;
        }
        console.error("Google sign-in failed:", err);
        alert("Google sign-in failed. Please try again.");
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

// --- Memory & Stats ---
function getAllShops() {
    let userAddedShops = JSON.parse(localStorage.getItem('userAddedShops')) || [];
    return [...defaultShopConfig, ...userAddedShops];
}

function getShopStats(shopName, defaultAmts) {
    let history = JSON.parse(localStorage.getItem('campusExpenses')) || [];
    let shopHistory = history.filter(item => item.shop === shopName);
    let total = 0, frequencyMap = {};

    shopHistory.forEach(item => {
        let amt = parseFloat(item.amt);
        total += amt;
        frequencyMap[amt] = (frequencyMap[amt] || 0) + 1;
    });

    let sortedFrequentAmts = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a]).map(Number);
    let smartAmts = [...new Set([...sortedFrequentAmts, ...defaultAmts])].slice(0, 3);
    return { total: total, suggestedAmts: smartAmts };
}

function getUpiId(shopId, defaultUpi) {
    let customUpis = JSON.parse(localStorage.getItem('customUpis')) || {};
    return customUpis[shopId] || defaultUpi;
}

// --- Rendering ---
function renderShops() {
    const container = document.getElementById('shopsContainer');
    container.innerHTML = '';

    let allShops = getAllShops();

    allShops.forEach(shop => {
        const currentUpi = getUpiId(shop.id, shop.defaultUpi);
        const stats = getShopStats(shop.name, shop.defaultAmts);

        let buttonsHtml = '';
        stats.suggestedAmts.forEach(amt => {
            buttonsHtml += `<button class="amt-btn" onclick="pay('${shop.name}', '${currentUpi}', ${amt}, '${shop.prefix}')">₹${amt}</button>`;
        });

        // Show a delete button only for user-added custom shops
        let deleteHtml = shop.id.startsWith("custom_")
            ? `<button class="icon-btn" onclick="deleteShop('${shop.id}')" style="color:#ff5252;" title="Delete Shop">🗑️</button>`
            : `<button class="icon-btn" onclick="openScanner('${shop.id}')" title="Update QR">📷</button>`;

        let html = `
        <div class="shop-card">
            <div class="shop-header">
                ${shop.name}
                <div class="badge-group">
                    <span class="app-badge">${shop.badge}</span>
                    ${deleteHtml}
                </div>
            </div>
            <div class="shop-sub-header">
                <span>Total Spent Here: <strong style="color:#bb86fc">₹${stats.total}</strong></span>
            </div>
            <div class="amt-row">
                ${buttonsHtml}
                <button class="amt-btn custom-btn" onclick="payCustom('${shop.name}', '${currentUpi}', '${shop.prefix}')">...</button>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}

// --- Payment Actions ---
function pay(shopName, upiId, amount, appPrefix) {
    saveExpense(shopName, amount);
    const url = `${appPrefix}?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR`;
    setTimeout(() => { window.location.href = url; }, 100);
}

function payCustom(shopName, upiId, appPrefix) {
    let amount = prompt(`Enter custom amount for ${shopName}:`, "");
    if (amount && !isNaN(amount) && amount > 0) pay(shopName, upiId, amount, appPrefix);
}

function saveExpense(shopName, amount) {
    let history = JSON.parse(localStorage.getItem('campusExpenses')) || [];
    let dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    history.unshift({ shop: shopName, amt: amount, time: dateStr });
    if (history.length > 30) history.pop();
    localStorage.setItem('campusExpenses', JSON.stringify(history));
    renderShops();
    updateDashboard();
}

// --- Scanner & Add Shop Logic (RAM Optimized) ---
function openScanner(mode) {
    activeScanMode = mode;
    document.getElementById('scanner-title').innerText = mode === 'NEW_SHOP' ? "Scan New Shop QR" : "Update Shop QR";
    document.getElementById('scanner-modal').style.display = 'flex';

    html5QrCode = new Html5Qrcode("reader");
    // RAM optimization: lower FPS to reduce camera/CPU load.
    html5QrCode.start({ facingMode: "environment" }, { fps: 5, qrbox: { width: 250, height: 250 } }, onScanSuccess)
        .catch(() => { alert("Camera error or permission denied."); closeScanner(); });
}

function onScanSuccess(decodedText) {
    let match = decodedText.match(/pa=([^&]+)/);
    if (match && match[1]) {
        let extractedUpi = match[1];

        // Release the camera before prompting to keep memory use lower.
        closeScanner();

        setTimeout(() => {
            if (activeScanMode === 'NEW_SHOP') {
                let newName = prompt("QR Scanned! Enter a name for this new shop:");
                if (newName) {
                    let userAddedShops = JSON.parse(localStorage.getItem('userAddedShops')) || [];
                    userAddedShops.push({
                        id: "custom_" + Date.now(),
                        name: "🏪 " + newName,
                        defaultUpi: extractedUpi,
                        prefix: "phonepe://pay", // Default for newly added shops.
                        badge: "PhonePe",
                        defaultAmts: [10, 20, 50]
                    });
                    localStorage.setItem('userAddedShops', JSON.stringify(userAddedShops));
                    renderShops();
                }
            } else {
                let customUpis = JSON.parse(localStorage.getItem('customUpis')) || {};
                customUpis[activeScanMode] = extractedUpi;
                localStorage.setItem('customUpis', JSON.stringify(customUpis));
                alert("QR Updated!");
                renderShops();
            }
        }, 300);
    } else {
        alert("Invalid QR format. Could not find UPI ID.");
        closeScanner();
    }
}

function closeScanner() {
    document.getElementById('scanner-modal').style.display = 'none';
    if (html5QrCode) {
        // Force teardown to release camera memory.
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(e => console.log(e));
    }
}

function deleteShop(shopId) {
    if (confirm("Remove this custom shop?")) {
        let userAddedShops = JSON.parse(localStorage.getItem('userAddedShops')) || [];
        userAddedShops = userAddedShops.filter(s => s.id !== shopId);
        localStorage.setItem('userAddedShops', JSON.stringify(userAddedShops));
        renderShops();
    }
}

function updateDashboard() {
    let history = JSON.parse(localStorage.getItem('campusExpenses')) || [];
    let total = 0, historyHTML = "";
    history.forEach((item, index) => {
        total += parseFloat(item.amt);
        if (index < 5) historyHTML += `<div class="history-item"><span>${item.shop} <small style="color:#666">(${item.time})</small></span> <span>₹${item.amt}</span></div>`;
    });
    document.getElementById('totalSpent').innerText = "₹" + total;
    document.getElementById('historyContainer').innerHTML = historyHTML || "<div style='color:#666'>No spends yet</div>";
}

function clearHistory() {
    if (confirm("Erase ALL tracking history?")) {
        localStorage.removeItem('campusExpenses');
        renderShops();
        updateDashboard();
    }
}

function getExpenseHistory() {
    return JSON.parse(localStorage.getItem('campusExpenses')) || [];
}

function buildExpensesCSV(history) {
    const rows = [["Shop", "Amount", "Time"]];
    history.forEach(item => {
        rows.push([item.shop, item.amt, item.time]);
    });

    return rows
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');
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
            await navigator.share({
                title: "Campus Pay Expense Report",
                text: report
            });
            return;
        } catch (e) {
            // Ignore cancel/share errors and fall back to clipboard.
        }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(report);
            alert("Report copied. Paste it into WhatsApp or email.");
            return;
        } catch (e) {
            // Fall through to prompt fallback.
        }
    }

    window.prompt("Copy and share this report:", report);
}

initApp();
