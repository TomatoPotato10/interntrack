// storage.js
// Pure localStorage storage layer for InternTrack.
// No authentication, no Firebase — all data stored locally on device.

const STORAGE_KEY_APPS = "interntrack_apps";
const STORAGE_KEY_REMINDERS = "interntrack_reminders";

// Clean up old demo/auth keys from previous versions
(function cleanupLegacyKeys() {
  const legacyKeys = [
    "interntrack_mock_apps",
    "interntrack_mock_reminders",
    "interntrack_mock_user",
    "interntrack_firebase_config"
  ];
  
  // Migrate old mock data to new keys if it exists
  const oldApps = localStorage.getItem("interntrack_mock_apps");
  const oldReminders = localStorage.getItem("interntrack_mock_reminders");
  
  if (oldApps && !localStorage.getItem(STORAGE_KEY_APPS)) {
    try {
      const apps = JSON.parse(oldApps);
      // Filter out any old seeded demo entries
      const userApps = apps.filter(a => !["demo-1","demo-2","demo-3","demo-4","demo-5","demo-6"].includes(a.id));
      if (userApps.length > 0) {
        localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(userApps));
      }
    } catch (e) { /* ignore */ }
  }
  
  if (oldReminders && !localStorage.getItem(STORAGE_KEY_REMINDERS)) {
    try {
      const rems = JSON.parse(oldReminders);
      const userRems = rems.filter(r => !["rem-1","rem-2","rem-3"].includes(r.id));
      if (userRems.length > 0) {
        localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(userRems));
      }
    } catch (e) { /* ignore */ }
  }
  
  // Remove legacy keys
  legacyKeys.forEach(key => localStorage.removeItem(key));
})();

// ---- APPLICATIONS CRUD ----

export async function getApplications() {
  const appsStr = localStorage.getItem(STORAGE_KEY_APPS) || "[]";
  return JSON.parse(appsStr);
}

export async function addApplication(appData) {
  const appsStr = localStorage.getItem(STORAGE_KEY_APPS) || "[]";
  const apps = JSON.parse(appsStr);
  const newApp = {
    id: "app-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6),
    ...appData,
    createdAt: new Date().toISOString()
  };
  apps.push(newApp);
  localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(apps));
  return newApp;
}

export async function updateApplication(appId, appData) {
  const appsStr = localStorage.getItem(STORAGE_KEY_APPS) || "[]";
  let apps = JSON.parse(appsStr);
  const index = apps.findIndex(a => a.id === appId);
  if (index !== -1) {
    apps[index] = { ...apps[index], ...appData };
    localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(apps));
    return apps[index];
  } else {
    throw new Error("Application not found");
  }
}

export async function deleteApplication(appId) {
  const appsStr = localStorage.getItem(STORAGE_KEY_APPS) || "[]";
  let apps = JSON.parse(appsStr);
  const initialLen = apps.length;
  apps = apps.filter(a => a.id !== appId);
  if (apps.length < initialLen) {
    localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(apps));
    return appId;
  } else {
    throw new Error("Application not found");
  }
}

// ---- REMINDERS CRUD ----

export async function getReminders() {
  const remsStr = localStorage.getItem(STORAGE_KEY_REMINDERS) || "[]";
  let reminders = JSON.parse(remsStr);
  return reminders.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export async function addReminder(reminderData) {
  const remsStr = localStorage.getItem(STORAGE_KEY_REMINDERS) || "[]";
  const reminders = JSON.parse(remsStr);
  const newReminder = {
    id: "rem-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6),
    ...reminderData,
    createdAt: new Date().toISOString()
  };
  reminders.push(newReminder);
  localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(reminders));
  return newReminder;
}

export async function updateReminder(reminderId, reminderData) {
  const remsStr = localStorage.getItem(STORAGE_KEY_REMINDERS) || "[]";
  let reminders = JSON.parse(remsStr);
  const index = reminders.findIndex(r => r.id === reminderId);
  if (index !== -1) {
    reminders[index] = { ...reminders[index], ...reminderData };
    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(reminders));
    return reminders[index];
  } else {
    throw new Error("Reminder not found");
  }
}

export async function deleteReminder(reminderId) {
  const remsStr = localStorage.getItem(STORAGE_KEY_REMINDERS) || "[]";
  let reminders = JSON.parse(remsStr);
  const initialLen = reminders.length;
  reminders = reminders.filter(r => r.id !== reminderId);
  if (reminders.length < initialLen) {
    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(reminders));
    return reminderId;
  } else {
    throw new Error("Reminder not found");
  }
}
