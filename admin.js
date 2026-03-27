let adminAuth = null;
let adminDb = null;
let adminUser = null;

function setAdminStatus(msg) {
    const el = document.getElementById("adminAuthStatus");
    if (el) el.textContent = msg;
}

function initAdmin() {
    if (!window.firebaseConfig) {
        setAdminStatus("Missing firebase config.");
        return;
    }

    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
    adminAuth = firebase.auth();
    adminDb = firebase.firestore();

    adminAuth.onAuthStateChanged(async (user) => {
        adminUser = user || null;
        const email = String(adminUser?.email || "").toLowerCase();
        const allowed = (window.adminEmails || []).includes(email);

        if (!adminUser) {
            setAdminStatus("Sign in from user page first, then reopen admin page.");
            return;
        }

        if (!allowed) {
            setAdminStatus("Access denied: this account is not in adminEmails.");
            return;
        }

        setAdminStatus(`Admin signed in: ${email}`);
        await renderCatalog();
        await renderFeedback();
    });
}

async function addCatalogShop() {
    if (!adminUser) return;

    const name = (document.getElementById("admName")?.value || "").trim();
    const upi = (document.getElementById("admUpi")?.value || "").trim();
    const app = (document.getElementById("admApp")?.value || "phonepe").trim();
    const amountsStr = (document.getElementById("admAmounts")?.value || "10,20,30").trim();

    if (!name || !upi) {
        alert("Name and UPI are required.");
        return;
    }

    const amounts = amountsStr.split(",").map(v => Number(v.trim())).filter(v => !Number.isNaN(v) && v > 0);
    const payload = {
        id: `catalog_${Date.now()}`,
        name,
        defaultUpi: upi,
        defaultApp: app,
        defaultAmts: amounts.length ? amounts : [10, 20, 30],
        createdAt: new Date().toISOString(),
        createdBy: adminUser.email || "admin"
    };

    await adminDb.collection("catalogShops").doc(payload.id).set(payload);
    alert("Catalog shop added.");
    await renderCatalog();
}

async function removeCatalogShop(id) {
    await adminDb.collection("catalogShops").doc(id).delete();
    await renderCatalog();
}

async function renderCatalog() {
    const container = document.getElementById("catalogList");
    if (!container) return;

    const snap = await adminDb.collection("catalogShops").orderBy("createdAt", "desc").get();
    if (snap.empty) {
        container.innerHTML = "<div class='auth-user'>No catalog shops yet.</div>";
        return;
    }

    container.innerHTML = snap.docs.map(doc => {
        const s = doc.data();
        return `<div class='shop-card'>
            <div class='shop-header'>${s.name}<button class='tiny-btn warn-btn' onclick="removeCatalogShop('${doc.id}')">Delete</button></div>
            <div class='auth-user'>UPI: ${s.defaultUpi}</div>
            <div class='auth-user'>App: ${s.defaultApp}</div>
        </div>`;
    }).join("");
}

async function renderFeedback() {
    const container = document.getElementById("feedbackList");
    if (!container) return;

    const snap = await adminDb.collection("feedback").orderBy("createdAt", "desc").limit(20).get();
    if (snap.empty) {
        container.innerHTML = "<div class='auth-user'>No feedback yet.</div>";
        return;
    }

    container.innerHTML = snap.docs.map(doc => {
        const f = doc.data();
        return `<div class='shop-card'>
            <div class='auth-user'><strong>Rating:</strong> ${f.rating || "-"}</div>
            <div class='auth-user'><strong>Recommend:</strong> ${f.recommend || "-"}</div>
            <div class='auth-user'><strong>Changes:</strong> ${f.changes || "-"}</div>
            <div class='auth-user'>By: ${f.userEmail || "anonymous"}</div>
        </div>`;
    }).join("");
}

window.addCatalogShop = addCatalogShop;
window.removeCatalogShop = removeCatalogShop;

initAdmin();
