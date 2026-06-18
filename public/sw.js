/* AVIVA ONE Service Worker — web push with dismissed tracking */

// บันทึก notification ที่ผู้ใช้ปิด (dismissed) เพื่อไม่ส่งซ้ำ
const DISMISSED_DB = "aviva-dismissed-notifications";
const DISMISSED_STORE = "dismissed";
const DISMISSED_EXPIRY_HOURS = 24; // ลบบันทึก dismissed หลังจากผ่านไป 24 ชั่วโมง

// เปิด IndexedDB
async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DISMISSED_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DISMISSED_STORE)) {
        db.createObjectStore(DISMISSED_STORE, { keyPath: "tag" });
      }
    };
  });
}

// ตรวจสอบว่า notification ถูกปิดแล้วหรือเปล่า
async function isDismissed(tag) {
  try {
    const db = await openDB();
    const tx = db.transaction(DISMISSED_STORE, "readonly");
    const store = tx.objectStore(DISMISSED_STORE);
    return new Promise((resolve) => {
      const req = store.get(tag);
      req.onsuccess = () => {
        const record = req.result;
        if (!record) return resolve(false);
        // ตรวจสอบว่า record ยังไม่หมดอายุ
        const age = Date.now() - record.dismissedAt;
        resolve(age < DISMISSED_EXPIRY_HOURS * 60 * 60 * 1000);
      };
      req.onerror = () => resolve(false);
    });
  } catch (_) {
    return false;
  }
}

// บันทึก notification ที่ปิด
async function markDismissed(tag) {
  try {
    const db = await openDB();
    const tx = db.transaction(DISMISSED_STORE, "readwrite");
    const store = tx.objectStore(DISMISSED_STORE);
    store.put({ tag, dismissedAt: Date.now() });
  } catch (_) {}
}

self.addEventListener("push", async (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: "AVIVA ONE", body: event.data ? event.data.text() : "" }; }

  const tag = data.tag || `aviva-notification-${Date.now()}`;

  // ตรวจสอบว่า notification นี้เคยถูกปิดแล้วหรือเปล่า
  const dismissed = await isDismissed(tag);
  if (dismissed) {
    console.log(`[Push] Skipped dismissed notification: ${tag}`);
    return;
  }

  const title = data.title || "AVIVA ONE";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: tag,
    renotify: true,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// บันทึก notification ที่ผู้ใช้กดปิด
self.addEventListener("notificationclose", async (event) => {
  const tag = event.notification.tag;
  console.log(`[Push] Notification dismissed: ${tag}`);
  await markDismissed(tag);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) { if ("focus" in w) { w.navigate(url); return w.focus(); } }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
