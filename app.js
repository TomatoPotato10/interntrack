// app.js
// Main Controller for InternTrack — No authentication, pure local storage.

import {
  getApplications,
  addApplication,
  updateApplication,
  deleteApplication,
  getReminders,
  addReminder,
  updateReminder,
  deleteReminder
} from "./firebase-config.js";

// ==================== CAPACITOR NATIVE NOTIFICATIONS ====================
// Dynamically import Capacitor LocalNotifications — gracefully falls back
// to browser APIs when running as a plain web app (non-Capacitor context).
let LocalNotifications = null;
let isNativeNotifications = false;

try {
  const capModule = await import('https://esm.sh/@capacitor/local-notifications@6.1.3');
  LocalNotifications = capModule.LocalNotifications;
  // Check if we're actually in a Capacitor native shell
  const capCoreModule = await import('https://esm.sh/@capacitor/core@6.2.1');
  isNativeNotifications = capCoreModule.Capacitor.isNativePlatform();
  console.log(`InternTrack: Capacitor native platform detected: ${isNativeNotifications}`);
} catch (e) {
  console.log('InternTrack: Running in browser mode — using web notification fallback.');
}

// ==================== STATE MANAGEMENT ====================
let applications = [];
let reminders = [];
let activeFilter = "all";
let searchQuery = "";
let currentSort = "date-desc";
let selectedFormStatus = "Applied";
let activeHomeSubView = "overview"; // 'overview' or 'analytics'

// ==================== ELEMENT SELECTORS ====================
const DOM = {
  // Views & Routing
  homeView: document.getElementById("home-view"),
  applicationsView: document.getElementById("applications-view"),
  remindersView: document.getElementById("reminders-view"),
  bottomNav: document.getElementById("bottom-nav"),
  
  // Dashboard Sub-Views Toggle
  btnHomeOverview: document.getElementById("btn-home-overview"),
  btnHomeAnalytics: document.getElementById("btn-home-analytics"),
  homeOverviewContainer: document.getElementById("home-overview-container"),
  homeAnalyticsContainer: document.getElementById("home-analytics-container"),
  
  // Dashboard Overviews
  userWelcomeName: document.getElementById("user-welcome-name"),
  statsApplied: document.getElementById("stats-applied"),
  statsInterview: document.getElementById("stats-interview"),
  statsOffer: document.getElementById("stats-offer"),
  statsRejected: document.getElementById("stats-rejected"),
  statsAwaiting: document.getElementById("stats-awaiting"),
  successRatePct: document.getElementById("success-rate-pct"),
  summaryCircle: document.getElementById("summary-circle"),
  summaryHeadline: document.getElementById("summary-headline"),
  summaryMessage: document.getElementById("summary-message"),
  recentAppsList: document.getElementById("recent-apps-list"),
  viewAllAppsBtn: document.getElementById("view-all-apps-btn"),
  
  // Analytics subtab elements
  analyticsInterviewRate: document.getElementById("analytics-interview-rate"),
  analyticsOfferRate: document.getElementById("analytics-offer-rate"),
  analyticsRejectionRate: document.getElementById("analytics-rejection-rate"),
  barInterviewRate: document.getElementById("bar-interview-rate"),
  barOfferRate: document.getElementById("bar-offer-rate"),
  barRejectionRate: document.getElementById("bar-rejection-rate"),
  analyticsMonthCount: document.getElementById("analytics-month-count"),
  statusDistributionChart: document.getElementById("status-distribution-chart"),
  
  // Applications Catalog
  appsCountSub: document.getElementById("apps-count-sub"),
  appSearch: document.getElementById("app-search"),
  appSort: document.getElementById("app-sort"),
  filterPills: document.querySelectorAll(".filter-pill"),
  appsList: document.getElementById("apps-list"),
  fabAddApp: document.getElementById("fab-add-app"),
  activeFilterBanner: document.getElementById("active-filter-banner"),
  activeFilterText: document.getElementById("active-filter-text"),
  btnClearFilter: document.getElementById("btn-clear-filter"),
  cardApplied: document.querySelector(".stat-card.applied"),
  cardInterview: document.querySelector(".stat-card.interview"),
  cardOffer: document.querySelector(".stat-card.offer"),
  cardRejected: document.querySelector(".stat-card.rejected"),
  cardAwaiting: document.querySelector(".stat-card.awaiting-response"),
  summaryCard: document.querySelector(".summary-card"),
  
  // Reminders View
  btnRequestNotifications: document.getElementById("btn-request-notifications"),
  reminderFormToggle: document.getElementById("reminder-form-toggle"),
  reminderFormChevron: document.getElementById("reminder-form-chevron"),
  reminderForm: document.getElementById("reminder-form"),
  remAppId: document.getElementById("rem-app-id"),
  remTitle: document.getElementById("rem-title"),
  remDate: document.getElementById("rem-date"),
  remType: document.getElementById("rem-type"),
  upcomingRemindersList: document.getElementById("upcoming-reminders-list"),
  completedRemindersList: document.getElementById("completed-reminders-list"),
  
  // Theme Toggle
  btnToggleTheme: document.getElementById("btn-toggle-theme"),
  
  // Application Details Overlay Card
  detailsOverlay: document.getElementById("details-overlay"),
  detailsCloseBtn: document.getElementById("details-close-btn"),
  detailsCompanyName: document.getElementById("details-company-name"),
  detailsRoleName: document.getElementById("details-role-name"),
  detailsStatusBadge: document.getElementById("details-status-badge"),
  detailsLinkWrapper: document.getElementById("details-link-wrapper"),
  detailsLocationText: document.getElementById("details-location-text"),
  detailsDateText: document.getElementById("details-date-text"),
  detailsInterviewBlock: document.getElementById("details-interview-block"),
  detailsInterviewDate: document.getElementById("details-interview-date"),
  detailsInterviewType: document.getElementById("details-interview-type"),
  detailsInterviewNotes: document.getElementById("details-interview-notes"),
  detailsTimelineTree: document.getElementById("details-timeline-tree"),
  detailsNotesText: document.getElementById("details-notes-text"),
  btnDetailsEdit: document.getElementById("btn-details-edit"),
  btnDetailsDelete: document.getElementById("btn-details-delete"),
  detailsRecruiterBlock: document.getElementById("details-recruiter-block"),
  detailsRecruiterName: document.getElementById("details-recruiter-name"),
  detailsRecruiterEmailWrapper: document.getElementById("details-recruiter-email-wrapper"),
  
  // Drawer Sheet
  appModalOverlay: document.getElementById("app-modal-overlay"),
  appDrawer: document.getElementById("app-drawer"),
  drawerTitle: document.getElementById("drawer-title"),
  drawerCloseBtn: document.getElementById("drawer-close-btn"),
  appForm: document.getElementById("app-form"),
  appFormId: document.getElementById("app-form-id"),
  appCompany: document.getElementById("app-company"),
  appRole: document.getElementById("app-role"),
  appLocation: document.getElementById("app-location"),
  appLink: document.getElementById("app-link"),
  appDate: document.getElementById("app-date"),
  appStatusSelector: document.getElementById("app-drawer").querySelector(".status-selector-grid"),
  formInterviewGroup: document.getElementById("form-interview-group"),
  appInterviewDate: document.getElementById("app-interview-date"),
  appInterviewType: document.getElementById("app-interview-type"),
  appInterviewNotes: document.getElementById("app-interview-notes"),
  appNotes: document.getElementById("app-notes"),
  btnSaveLabel: document.getElementById("btn-save-label"),
  appRecruiterName: document.getElementById("app-recruiter-name"),
  appRecruiterEmail: document.getElementById("app-recruiter-email"),
  
  // Alerts Notifications
  toastContainer: document.getElementById("toast-container")
};

// ==================== INITIAL THEME SETUP ====================
const savedTheme = localStorage.getItem("interntrack_theme") || "dark";
if (savedTheme === "light") {
  document.body.classList.add("light-mode");
  updateThemeButtonUI(true);
} else {
  updateThemeButtonUI(false);
}

function updateThemeButtonUI(isLight) {
  if (isLight) {
    DOM.btnToggleTheme.innerHTML = `<i class="fa-solid fa-sun"></i>`;
    DOM.btnToggleTheme.title = "Switch to Dark Mode";
  } else {
    DOM.btnToggleTheme.innerHTML = `<i class="fa-solid fa-moon"></i>`;
    DOM.btnToggleTheme.title = "Switch to Light Mode";
  }
}

DOM.btnToggleTheme.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("interntrack_theme", isLight ? "light" : "dark");
  updateThemeButtonUI(isLight);
  showToast(`Switched to ${isLight ? "Light Theme" : "Dark Theme"}.`, "info");
});

// ==================== ROUTING & NAVIGATION ====================
function showView(viewId) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active");
  });
  
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add("active");
    targetView.scrollTop = 0;
  }
  
  DOM.bottomNav.style.display = "flex";
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.classList.remove("active");
    if (tab.getAttribute("data-view") === viewId) {
      tab.classList.add("active");
    }
  });
}

document.querySelectorAll(".nav-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const targetView = tab.getAttribute("data-view");
    showView(targetView);
  });
});

DOM.viewAllAppsBtn.addEventListener("click", () => showView("applications-view"));

// Segmented switch dashboard tabs
DOM.btnHomeOverview.addEventListener("click", () => {
  activeHomeSubView = "overview";
  DOM.btnHomeOverview.classList.add("active");
  DOM.btnHomeAnalytics.classList.remove("active");
  DOM.homeOverviewContainer.style.display = "block";
  DOM.homeAnalyticsContainer.style.display = "none";
});

DOM.btnHomeAnalytics.addEventListener("click", () => {
  activeHomeSubView = "analytics";
  DOM.btnHomeAnalytics.classList.add("active");
  DOM.btnHomeOverview.classList.remove("active");
  DOM.homeOverviewContainer.style.display = "none";
  DOM.homeAnalyticsContainer.style.display = "block";
  renderAnalytics();
});

// ==================== UTILITY: TOAST NOTIFICATIONS ====================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconClass = "fa-circle-info";
  if (type === "success") iconClass = "fa-circle-check";
  if (type === "error") iconClass = "fa-triangle-exclamation";
  
  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;
  
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("fade-out");
    toast.addEventListener("animationend", () => toast.remove());
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

// ==================== APP CRUD & BOTTOM DRAWER LOGIC ====================
function openDrawer(isEdit = false, appObj = null) {
  // Hide details view if open
  DOM.detailsOverlay.classList.remove("active");
  
  DOM.appModalOverlay.classList.add("active");
  DOM.appDrawer.classList.add("active");
  
  if (isEdit && appObj) {
    DOM.drawerTitle.textContent = "Edit Application";
    DOM.btnSaveLabel.textContent = "Save Changes";
    DOM.appFormId.value = appObj.id;
    DOM.appCompany.value = appObj.company;
    DOM.appRole.value = appObj.role;
    DOM.appLocation.value = appObj.location || "";
    DOM.appLink.value = appObj.appLink || "";
    DOM.appDate.value = appObj.dateApplied || "";
    DOM.appNotes.value = appObj.notes || "";
    DOM.appRecruiterName.value = appObj.recruiterName || "";
    DOM.appRecruiterEmail.value = appObj.recruiterEmail || "";
    
    selectStatusButton(appObj.status);
    
    // Pop interview fields
    if (appObj.interviewDetails) {
      DOM.appInterviewDate.value = appObj.interviewDetails.date || "";
      DOM.appInterviewType.value = appObj.interviewDetails.type || "";
      DOM.appInterviewNotes.value = appObj.interviewDetails.notes || "";
    } else {
      DOM.appInterviewDate.value = "";
      DOM.appInterviewType.value = "";
      DOM.appInterviewNotes.value = "";
    }
  } else {
    DOM.drawerTitle.textContent = "Add Application";
    DOM.btnSaveLabel.textContent = "Save Application";
    DOM.appForm.reset();
    DOM.appFormId.value = "";
    DOM.appRecruiterName.value = "";
    DOM.appRecruiterEmail.value = "";
    DOM.appInterviewDate.value = "";
    DOM.appInterviewType.value = "";
    DOM.appInterviewNotes.value = "";
    
    const today = new Date().toISOString().split("T")[0];
    DOM.appDate.value = today;
    selectStatusButton("Applied");
  }
}

function closeDrawer() {
  DOM.appModalOverlay.classList.remove("active");
  DOM.appDrawer.classList.remove("active");
}

DOM.fabAddApp.addEventListener("click", () => openDrawer(false));
DOM.drawerCloseBtn.addEventListener("click", closeDrawer);
DOM.appModalOverlay.addEventListener("click", closeDrawer);

// Custom status buttons events
DOM.appStatusSelector.querySelectorAll(".status-select-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const status = btn.getAttribute("data-status");
    selectStatusButton(status);
  });
});

function selectStatusButton(status) {
  selectedFormStatus = status;
  DOM.appStatusSelector.querySelectorAll(".status-select-btn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-status").toLowerCase() === status.toLowerCase()) {
      btn.classList.add("active");
    }
  });
  
  // Toggle interview group view conditionally in form
  if (status.toLowerCase() === "interview") {
    DOM.formInterviewGroup.style.display = "block";
  } else {
    DOM.formInterviewGroup.style.display = "none";
  }
}

// Add/Edit App Form Submission
DOM.appForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const appId = DOM.appFormId.value;
  const company = DOM.appCompany.value.trim();
  const role = DOM.appRole.value.trim();
  const location = DOM.appLocation.value.trim();
  const appUrl = DOM.appLink.value.trim();
  const dateApplied = DOM.appDate.value;
  const notes = DOM.appNotes.value.trim();
  const recruiterName = DOM.appRecruiterName.value.trim();
  const recruiterEmail = DOM.appRecruiterEmail.value.trim();
  
  // Handle optional interview fields
  let interviewDetails = null;
  if (selectedFormStatus.toLowerCase() === "interview") {
    interviewDetails = {
      date: DOM.appInterviewDate.value,
      type: DOM.appInterviewType.value.trim(),
      notes: DOM.appInterviewNotes.value.trim()
    };
  }
  
  // Submit state UI
  const submitBtn = DOM.appForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>`;
  
  try {
    let timelineDate = dateApplied || new Date().toISOString().split("T")[0];
    
    if (appId) {
      // EDIT MODE
      const existingApp = applications.find(a => a.id === appId);
      let updatedHistory = existingApp.statusHistory || [];
      
      // If status changed, append to timeline history
      if (existingApp.status !== selectedFormStatus) {
        updatedHistory.push({
          status: selectedFormStatus,
          date: new Date().toISOString().split("T")[0]
        });
      }
      
      const appData = {
        company,
        role,
        location,
        appLink: appUrl,
        dateApplied,
        status: selectedFormStatus,
        notes,
        recruiterName,
        recruiterEmail,
        statusHistory: updatedHistory,
        interviewDetails
      };
      
      await updateApplication(appId, appData);
      showToast(`Updated ${company} application details!`, "success");
    } else {
      // NEW APPLICATION MODE
      const initialHistory = [{
        status: selectedFormStatus,
        date: timelineDate
      }];
      
      const appData = {
        company,
        role,
        location,
        appLink: appUrl,
        dateApplied,
        status: selectedFormStatus,
        notes,
        recruiterName,
        recruiterEmail,
        statusHistory: initialHistory,
        interviewDetails
      };
      
      await addApplication(appData);
      showToast(`Logged application to ${company}!`, "success");
    }
    
    closeDrawer();
    await Promise.all([
      loadApplicationData(true),
      loadReminderData(true)
    ]);
  } catch (err) {
    console.error("Save application error:", err);
    showToast("Error updating database.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span id="btn-save-label">Save Application</span>`;
  }
});

// Loading State Renderers for Skeleton/Spinners
function showRecentAppsLoadingState() {
  if (DOM.recentAppsList) {
    DOM.recentAppsList.innerHTML = `
      <div class="skeleton-container" style="padding: 10px 0;">
        <div class="skeleton-card" style="height: 70px; margin-bottom: 8px;">
          <div class="skeleton-header-line" style="width: 50%;"></div>
          <div class="skeleton-sub-line" style="width: 30%;"></div>
        </div>
      </div>
    `;
  }
}

function showApplicationsLoadingState() {
  if (DOM.appsList) {
    DOM.appsList.innerHTML = `
      <div class="skeleton-container">
        <div class="skeleton-card">
          <div class="skeleton-header-line"></div>
          <div class="skeleton-sub-line"></div>
          <div class="skeleton-text-line"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton-header-line"></div>
          <div class="skeleton-sub-line"></div>
          <div class="skeleton-text-line"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton-header-line"></div>
          <div class="skeleton-sub-line"></div>
          <div class="skeleton-text-line"></div>
        </div>
      </div>
    `;
  }
}

function showApplicationsErrorState() {
  if (DOM.appsList) {
    DOM.appsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="color:var(--color-rejected);"><i class="fa-solid fa-circle-exclamation"></i></div>
        <h3>Failed to load applications</h3>
        <p>There was an error querying the local database storage.</p>
      </div>
    `;
  }
}

function showRemindersLoadingState() {
  if (DOM.upcomingRemindersList) {
    DOM.upcomingRemindersList.innerHTML = `
      <div class="loading-spinner-wrapper">
        <div class="loading-spinner"></div>
        <div style="font-size:0.8rem; color:var(--color-secondary);">Loading reminders...</div>
      </div>
    `;
  }
}

function showRemindersErrorState() {
  if (DOM.upcomingRemindersList) {
    DOM.upcomingRemindersList.innerHTML = `
      <div style="font-size:0.8rem; text-align:center; color:var(--color-rejected); padding:20px 0;">
        <i class="fa-solid fa-circle-exclamation" style="margin-right:6px;"></i> Failed to load reminders.
      </div>
    `;
  }
}

// Load application items
async function loadApplicationData(simulateDelay = false) {
  try {
    showApplicationsLoadingState();
    if (simulateDelay) {
      // Simulate brief database latency for smooth visual transitions
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    applications = await getApplications() || [];
    renderDashboard();
    renderApplicationsList();
    populateReminderAppsDropdown();
  } catch (err) {
    console.error("Failed to load application data:", err);
    showToast("Failed to fetch database.", "error");
    showApplicationsErrorState();
  }
}

// ==================== RENDERING COMPONENT BUILDERS ====================

// 1. Render Dashboard/Home Stats (Split for non-blocking browser paints)
function renderDashboard() {
  renderDashboardSummary();
  requestAnimationFrame(() => {
    renderDashboardRecent();
  });
}

function renderDashboardSummary() {
  const stats = {
    wishlist: 0,
    applied: 0,
    oa: 0,
    interview: 0,
    offer: 0,
    accepted: 0,
    rejected: 0,
    submitted: 0, // total submitted = everything except Wishlist
    awaiting: 0   // awaiting = Applied + OA + Interview
  };
  
  const appsArray = Array.isArray(applications) ? applications : [];
  
  appsArray.forEach(app => {
    if (!app) return;
    const status = (app.status || "Wishlist").toLowerCase();
    
    if (status === "wishlist") stats.wishlist++;
    else {
      stats.submitted++;
      
      if (status === "applied") { stats.applied++; stats.awaiting++; }
      else if (status === "online assessment" || status === "oa") { stats.oa++; stats.awaiting++; }
      else if (status === "interview") { stats.interview++; stats.awaiting++; }
      else if (status === "offer") stats.offer++;
      else if (status === "accepted") stats.accepted++;
      else if (status === "rejected") stats.rejected++;
    }
  });
  
  // Set UI stats numbers
  if (DOM.statsApplied) DOM.statsApplied.textContent = stats.submitted;
  if (DOM.statsInterview) DOM.statsInterview.textContent = stats.interview;
  if (DOM.statsOffer) DOM.statsOffer.textContent = stats.offer + stats.accepted;
  if (DOM.statsRejected) DOM.statsRejected.textContent = stats.rejected;
  if (DOM.statsAwaiting) DOM.statsAwaiting.textContent = stats.awaiting;
  
  // Conversion Ring (Offer + Accepted / Total Submitted)
  const offerRate = stats.submitted > 0 ? Math.round(((stats.offer + stats.accepted) / stats.submitted) * 100) : 0;
  if (DOM.successRatePct) DOM.successRatePct.textContent = `${offerRate}%`;
  
  if (DOM.summaryCircle) {
    const strokeDash = 201; // Circumference
    const offset = strokeDash - (offerRate / 100) * strokeDash;
    DOM.summaryCircle.style.strokeDashoffset = offset;
  }
  
  // Dynamic summary descriptions
  if (DOM.summaryHeadline && DOM.summaryMessage) {
    if (stats.submitted === 0) {
      DOM.summaryHeadline.textContent = "No Applications Yet";
      DOM.summaryMessage.textContent = "You haven't logged any applications yet. Tap the + button to add your first one!";
    } else if (stats.accepted > 0) {
      DOM.summaryHeadline.textContent = "Congratulations! 🏆";
      DOM.summaryMessage.textContent = `You have accepted an offer! All your hard work has paid off.`;
    } else if (stats.offer > 0) {
      DOM.summaryHeadline.textContent = "Offers Secured! 🎉";
      DOM.summaryMessage.textContent = `You have ${stats.offer} active offer(s) waiting. Prepare your negotiation plans!`;
    } else if (stats.interview > 0) {
      DOM.summaryHeadline.textContent = "Active Interviewing 🚀";
      DOM.summaryMessage.textContent = `You have ${stats.interview} interview cycles scheduled. Prepare thoroughly!`;
    } else {
      DOM.summaryHeadline.textContent = "Keep Submitting!";
      DOM.summaryMessage.textContent = `${stats.submitted} applications submitted. Build a daily habit of finding roles.`;
    }
  }
}

function renderDashboardRecent() {
  const appsArray = Array.isArray(applications) ? applications : [];
  
  // Recent applications list render
  if (DOM.recentAppsList) {
    DOM.recentAppsList.innerHTML = "";
    // Sort applications by dateApplied descending to find recent
    const sortedByDate = [...appsArray].sort((a,b) => new Date(b.dateApplied || 0) - new Date(a.dateApplied || 0));
    const recent = sortedByDate.slice(0, 3);
    
    if (recent.length === 0) {
      DOM.recentAppsList.innerHTML = `
        <div class="empty-state" style="padding: 20px 10px;">
          <p>No recent activity. Click the + button to add one.</p>
        </div>
      `;
      return;
    }
    
    recent.forEach(app => {
      if (app) {
        const card = buildApplicationCard(app, true);
        DOM.recentAppsList.appendChild(card);
      }
    });
  }
}

// 2. Render Applications Screen (Catalog with search, filter, and sort)
function renderApplicationsList() {
  if (!DOM.appsList) return;
  DOM.appsList.innerHTML = "";
  
  const appsArray = Array.isArray(applications) ? applications : [];
  
  // Filter list
  let filtered = appsArray.filter(app => {
    if (!app) return false;
    
    // 1. Filter pill selector
    if (activeFilter !== "all") {
      const status = (app.status || "Wishlist").toLowerCase();
      if (activeFilter === "awaiting") {
        if (status !== "applied" && status !== "online assessment" && status !== "oa" && status !== "interview") {
          return false;
        }
      } else {
        if (status !== activeFilter.toLowerCase()) {
          return false;
        }
      }
    }
    
    // 2. Search query match
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const company = (app.company || "").toLowerCase();
      const role = (app.role || "").toLowerCase();
      const location = (app.location || "").toLowerCase();
      return (
        company.includes(q) ||
        role.includes(q) ||
        location.includes(q)
      );
    }
    return true;
  });
  
  // Sort list
  filtered.sort((a, b) => {
    if (!a || !b) return 0;
    if (currentSort === "date-desc") {
      return new Date(b.dateApplied || 0) - new Date(a.dateApplied || 0);
    } else if (currentSort === "date-asc") {
      return new Date(a.dateApplied || 0) - new Date(b.dateApplied || 0);
    } else if (currentSort === "company-asc") {
      return (a.company || "").localeCompare(b.company || "");
    } else if (currentSort === "company-desc") {
      return (b.company || "").localeCompare(a.company || "");
    }
    return 0;
  });
  
  if (DOM.appsCountSub) {
    DOM.appsCountSub.textContent = `${filtered.length} applications matches found`;
  }
  
  if (filtered.length === 0) {
    let msg = "No items matched your catalog filter criteria.";
    if (appsArray.length === 0) {
      msg = "You haven't logged any applications yet. Start by adding one!";
    }
    
    DOM.appsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-regular fa-folder-open"></i></div>
        <h3>No applications logged</h3>
        <p>${msg}</p>
        ${appsArray.length === 0 ? `<button class="btn btn-secondary" id="catalog-empty-add" style="width:auto; padding:10px 20px;">Create First Application</button>` : ""}
      </div>
    `;
    
    const addBtn = document.getElementById("catalog-empty-add");
    if (addBtn) addBtn.addEventListener("click", () => openDrawer(false));
    return;
  }
  
  filtered.forEach(app => {
    if (app) {
      const card = buildApplicationCard(app, true);
      DOM.appsList.appendChild(card);
    }
  });
}

// 3. Application Card builder
function buildApplicationCard(app, bindClick = true) {
  if (!app) return document.createElement("div");
  const card = document.createElement("div");
  
  const status = app.status || "Wishlist";
  const statusClass = status.toLowerCase().replace(" ", "-");
  card.className = `app-card ${statusClass}`;
  
  if (bindClick) {
    card.style.cursor = "pointer";
    card.addEventListener("click", (e) => {
      if (e.target.closest(".app-action-btn")) return;
      showApplicationDetails(app.id);
    });
  }
  
  let dateStr = "Wishlist (No date)";
  if (app.dateApplied) {
    const options = { month: "short", day: "numeric", year: "numeric" };
    try {
      dateStr = new Date(app.dateApplied).toLocaleDateString("en-US", options);
    } catch (e) {
      dateStr = "Invalid Date";
    }
  }
  
  // Custom display tag
  let displayStatus = status;
  if (displayStatus === "Online Assessment") displayStatus = "OA";
  
  card.innerHTML = `
    <div class="app-card-header">
      <div>
        <h4 class="app-company-name">${escapeHTML(app.company || "Unknown")}</h4>
        <div class="app-role">${escapeHTML(app.role || "Unknown")}</div>
      </div>
      <span class="status-badge ${statusClass}">${displayStatus}</span>
    </div>
    
    <div class="app-card-details">
      <div class="app-detail-item">
        <i class="fa-solid fa-location-dot"></i>
        <span>${escapeHTML(app.location || "Remote")}</span>
      </div>
      <div class="app-detail-item">
        <i class="fa-regular fa-calendar-check"></i>
        <span>${dateStr}</span>
      </div>
    </div>
    
    ${app.notes ? `<div class="app-notes-preview">${escapeHTML(app.notes)}</div>` : ""}
  `;
  
  return card;
}

// ==================== APPLICATION DETAILS OVERLAY VIEWS ====================
let currentSelectedAppId = null;

function showApplicationDetails(appId) {
  const app = applications.find(a => a.id === appId);
  if (!app) return;
  
  currentSelectedAppId = appId;
  
  DOM.detailsCompanyName.textContent = app.company;
  DOM.detailsRoleName.textContent = app.role;
  DOM.detailsLocationText.textContent = app.location || "Remote / Unknown";
  
  // Status Badge Class
  const statusClass = app.status.toLowerCase().replace(" ", "-");
  DOM.detailsStatusBadge.className = `status-badge ${statusClass}`;
  DOM.detailsStatusBadge.textContent = app.status;
  
  // Date format
  if (app.dateApplied) {
    const options = { month: "long", day: "numeric", year: "numeric" };
    DOM.detailsDateText.textContent = new Date(app.dateApplied).toLocaleDateString("en-US", options);
  } else {
    DOM.detailsDateText.textContent = "Not Applied Yet";
  }
  
  // Link Builder
  if (app.appLink) {
    DOM.detailsLinkWrapper.innerHTML = `
      <a href="${app.appLink}" target="_blank" class="app-action-btn" style="color: var(--color-accent); text-decoration:none; font-weight:600; font-size:0.82rem; display:flex; align-items:center; gap:6px;">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
        <span>Job Listing Link</span>
      </a>
    `;
  } else {
    DOM.detailsLinkWrapper.innerHTML = `<span style="font-size:0.75rem; color:var(--color-muted);">No listing link saved</span>`;
  }
  
  // Timeline building
  DOM.detailsTimelineTree.innerHTML = "";
  const history = app.statusHistory || [];
  
  if (history.length === 0) {
    DOM.detailsTimelineTree.innerHTML = `<div style="font-size:0.75rem; color:var(--color-secondary); font-style:italic;">No progress timeline entries yet.</div>`;
  } else {
    history.forEach(hist => {
      const node = document.createElement("div");
      const histClass = hist.status.toLowerCase().replace(" ", "-");
      node.className = `timeline-node ${histClass}`;
      
      const options = { month: "short", day: "numeric", year: "numeric" };
      const formattedDate = new Date(hist.date).toLocaleDateString("en-US", options);
      
      node.innerHTML = `
        <div class="timeline-node-bullet"></div>
        <div class="timeline-node-box">
          <div class="timeline-node-header">
            <span>Status: ${hist.status}</span>
          </div>
          <div class="timeline-node-date">Updated on ${formattedDate}</div>
        </div>
      `;
      DOM.detailsTimelineTree.appendChild(node);
    });
  }
  
  // Interview box display details
  if (app.status.toLowerCase() === "interview" && app.interviewDetails && app.interviewDetails.date) {
    DOM.detailsInterviewBlock.style.display = "block";
    
    const dt = new Date(app.interviewDetails.date);
    const options = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
    DOM.detailsInterviewDate.textContent = dt.toLocaleString("en-US", options);
    DOM.detailsInterviewType.textContent = app.interviewDetails.type || "Standard Interview";
    DOM.detailsInterviewNotes.textContent = app.interviewDetails.notes || "No interview notes added.";
  } else {
    DOM.detailsInterviewBlock.style.display = "none";
  }
  
  // Recruiter box display details
  if (app.recruiterName || app.recruiterEmail) {
    DOM.detailsRecruiterBlock.style.display = "block";
    DOM.detailsRecruiterName.textContent = app.recruiterName || "Unknown / Not Set";
    if (app.recruiterEmail) {
      DOM.detailsRecruiterEmailWrapper.innerHTML = `
        <strong>Email:</strong> 
        <a href="mailto:${app.recruiterEmail}" style="color:var(--color-accent); text-decoration:none; font-weight:600;">
          ${escapeHTML(app.recruiterEmail)}
        </a>
      `;
    } else {
      DOM.detailsRecruiterEmailWrapper.innerHTML = `<strong>Email:</strong> <span style="color:var(--color-muted);">Not Provided</span>`;
    }
  } else {
    DOM.detailsRecruiterBlock.style.display = "none";
  }
  
  // Notes
  DOM.detailsNotesText.value = app.notes || "";
  
  // Activate overlay screen
  DOM.detailsOverlay.classList.add("active");
}

// Save details notes to database
async function saveDetailsNotes() {
  if (currentSelectedAppId) {
    const app = applications.find(a => a.id === currentSelectedAppId);
    if (app) {
      const updatedNotes = DOM.detailsNotesText.value;
      if (app.notes !== updatedNotes) {
        app.notes = updatedNotes;
        try {
          await updateApplication(app.id, { notes: updatedNotes });
          renderApplicationsList();
          renderDashboardRecent();
        } catch (err) {
          console.error("Failed to save details notes:", err);
        }
      }
    }
  }
}

// Notes events inside Details Overlay
DOM.detailsNotesText.addEventListener("input", (e) => {
  if (currentSelectedAppId) {
    const app = applications.find(a => a.id === currentSelectedAppId);
    if (app) {
      app.notes = e.target.value;
    }
  }
});

DOM.detailsNotesText.addEventListener("blur", () => {
  saveDetailsNotes();
});

DOM.detailsOverlay.addEventListener("click", (e) => {
  if (e.target === DOM.detailsOverlay) {
    saveDetailsNotes();
    DOM.detailsOverlay.classList.remove("active");
    currentSelectedAppId = null;
  }
});

DOM.detailsCloseBtn.addEventListener("click", async () => {
  await saveDetailsNotes();
  DOM.detailsOverlay.classList.remove("active");
  currentSelectedAppId = null;
});

// Edit from details view
DOM.btnDetailsEdit.addEventListener("click", async () => {
  if (currentSelectedAppId) {
    await saveDetailsNotes();
    const appObj = applications.find(a => a.id === currentSelectedAppId);
    openDrawer(true, appObj);
  }
});

// Delete from details view
DOM.btnDetailsDelete.addEventListener("click", async () => {
  if (currentSelectedAppId) {
    const app = applications.find(a => a.id === currentSelectedAppId);
    if (!app) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete the ${app.company} application?`);
    if (confirmDelete) {
      try {
        await deleteApplication(app.id);
        showToast(`Deleted ${app.company} tracker records.`, "info");
        DOM.detailsOverlay.classList.remove("active");
        await Promise.all([
          loadApplicationData(true),
          loadReminderData(true)
        ]);
      } catch (err) {
        console.error("Delete error:", err);
        showToast("Deletion failed.", "error");
      }
    }
  }
});

// ==================== SEARCH, SORT & FILTERS ====================
DOM.appSearch.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderApplicationsList();
});

DOM.appSort.addEventListener("change", (e) => {
  currentSort = e.target.value;
  renderApplicationsList();
});

function setApplicationsFilter(filterValue) {
  activeFilter = filterValue;
  
  // Update UI active filter pills
  DOM.filterPills.forEach(pill => {
    if (pill.getAttribute("data-filter") === filterValue) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }
  });
  
  // Update URL parameters without reload
  const url = new URL(window.location.href);
  if (filterValue === "all") {
    url.searchParams.delete('status');
  } else {
    url.searchParams.set('status', filterValue);
  }
  window.history.replaceState({}, '', url.pathname + url.search);
  
  // Update active filter banner
  if (DOM.activeFilterBanner && DOM.activeFilterText) {
    if (filterValue === "all") {
      DOM.activeFilterBanner.style.display = "none";
    } else {
      let displayName = filterValue.charAt(0).toUpperCase() + filterValue.slice(1);
      if (filterValue === "online assessment") displayName = "OA";
      else if (filterValue === "applied") displayName = "Submitted";
      else if (filterValue === "interview") displayName = "Interviews";
      else if (filterValue === "offer") displayName = "Offers";
      else if (filterValue === "rejected") displayName = "Rejections";
      else if (filterValue === "awaiting") displayName = "Awaiting Response";
      
      DOM.activeFilterText.innerHTML = `<i class="fa-solid fa-filter" style="margin-right:6px; color:var(--color-accent);"></i> Showing: <strong>${displayName}</strong>`;
      DOM.activeFilterBanner.style.display = "flex";
    }
  }
  
  renderApplicationsList();
}

DOM.filterPills.forEach(pill => {
  pill.addEventListener("click", () => {
    const filter = pill.getAttribute("data-filter");
    setApplicationsFilter(filter);
  });
});

// Interactive Dashboard Stats Cards Clicks
if (DOM.cardApplied) {
  DOM.cardApplied.addEventListener("click", () => {
    showView("applications-view");
    setApplicationsFilter("applied");
  });
}

if (DOM.cardInterview) {
  DOM.cardInterview.addEventListener("click", () => {
    showView("applications-view");
    setApplicationsFilter("interview");
  });
}

if (DOM.cardOffer) {
  DOM.cardOffer.addEventListener("click", () => {
    showView("applications-view");
    setApplicationsFilter("offer");
  });
}

if (DOM.cardRejected) {
  DOM.cardRejected.addEventListener("click", () => {
    showView("applications-view");
    setApplicationsFilter("rejected");
  });
}

if (DOM.cardAwaiting) {
  DOM.cardAwaiting.addEventListener("click", () => {
    showView("applications-view");
    setApplicationsFilter("awaiting");
  });
}

if (DOM.summaryCard) {
  DOM.summaryCard.addEventListener("click", () => {
    showView("applications-view");
    setApplicationsFilter("offer");
  });
}

if (DOM.btnClearFilter) {
  DOM.btnClearFilter.addEventListener("click", () => {
    setApplicationsFilter("all");
  });
}

// ==================== ANALYTICS DASHBOARD TAB ====================
function renderAnalytics() {
  const total = applications.filter(a => a.status.toLowerCase() !== "wishlist").length;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  let appsThisMonthCount = 0;
  let interviewEventsCount = 0;
  let offerEventsCount = 0;
  let rejectionEventsCount = 0;
  
  const statusCounts = {
    wishlist: 0,
    applied: 0,
    "online assessment": 0,
    interview: 0,
    offer: 0,
    accepted: 0,
    rejected: 0
  };
  
  applications.forEach(app => {
    const status = app.status.toLowerCase();
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }
    
    if (app.dateApplied) {
      const appDate = new Date(app.dateApplied);
      if (appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth) {
        appsThisMonthCount++;
      }
    }
    
    if (status !== "wishlist") {
      const history = app.statusHistory || [];
      const hasInterview = history.some(h => h.status.toLowerCase() === "interview");
      const hasOffer = history.some(h => h.status.toLowerCase() === "offer" || h.status.toLowerCase() === "accepted");
      const hasRejection = history.some(h => h.status.toLowerCase() === "rejected");
      
      if (hasInterview) interviewEventsCount++;
      if (hasOffer) offerEventsCount++;
      if (hasRejection) rejectionEventsCount++;
    }
  });
  
  DOM.analyticsMonthCount.textContent = appsThisMonthCount;
  
  const interviewRate = total > 0 ? Math.round((interviewEventsCount / total) * 100) : 0;
  const offerRate = total > 0 ? Math.round((offerEventsCount / total) * 100) : 0;
  const rejectionRate = total > 0 ? Math.round((rejectionEventsCount / total) * 100) : 0;
  
  DOM.analyticsInterviewRate.textContent = `${interviewRate}%`;
  DOM.analyticsOfferRate.textContent = `${offerRate}%`;
  DOM.analyticsRejectionRate.textContent = `${rejectionRate}%`;
  
  DOM.barInterviewRate.style.width = `${interviewRate}%`;
  DOM.barOfferRate.style.width = `${offerRate}%`;
  DOM.barRejectionRate.style.width = `${rejectionRate}%`;
  
  // Draw Status Distribution Chart list
  DOM.statusDistributionChart.innerHTML = "";
  const totalAppsCount = applications.length;
  
  Object.keys(statusCounts).forEach(status => {
    const count = statusCounts[status];
    const pct = totalAppsCount > 0 ? Math.round((count / totalAppsCount) * 100) : 0;
    
    const statusClass = status.replace(" ", "-");
    let displayStatusLabel = status.toUpperCase();
    if (displayStatusLabel === "ONLINE ASSESSMENT") displayStatusLabel = "OA";
    
    const row = document.createElement("div");
    row.className = "status-ratio-row";
    row.innerHTML = `
      <span class="status-ratio-name">${displayStatusLabel}</span>
      <div class="status-ratio-bar-wrapper">
        <div class="progress-bar-track">
          <div class="progress-bar-fill ${statusClass}" style="width: ${pct}%"></div>
        </div>
      </div>
      <span class="status-ratio-count">${count}</span>
    `;
    
    row.addEventListener("click", () => {
      showView("applications-view");
      setApplicationsFilter(status);
    });
    
    DOM.statusDistributionChart.appendChild(row);
  });
}

// ==================== REMINDERS MODULE LOGIC ====================
// Toggle reminder creation panel
DOM.reminderFormToggle.addEventListener("click", () => {
  const isHidden = DOM.reminderForm.style.display === "none";
  DOM.reminderForm.style.display = isHidden ? "block" : "none";
  DOM.reminderFormChevron.className = isHidden ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
});

// Populates applications list dropdown select
function populateReminderAppsDropdown() {
  DOM.remAppId.innerHTML = '<option value="">-- Select Application --</option>';
  const activeApps = applications.filter(a => a.status.toLowerCase() !== "wishlist");
  
  if (activeApps.length === 0) {
    DOM.remAppId.innerHTML += `<option value="" disabled>No active applications submitted yet</option>`;
    return;
  }
  
  activeApps.forEach(app => {
    DOM.remAppId.innerHTML += `<option value="${app.id}">${escapeHTML(app.company)} - ${escapeHTML(app.role)}</option>`;
  });
}

// Set up reminder submission
DOM.reminderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const appId = DOM.remAppId.value;
  const description = DOM.remTitle.value.trim();
  const dateStr = DOM.remDate.value;
  const type = DOM.remType.value;
  
  const selectedApp = applications.find(a => a.id === appId);
  if (!selectedApp) {
    showToast("Please select a valid job application.", "error");
    return;
  }
  
  const reminderData = {
    appId,
    company: selectedApp.company,
    role: selectedApp.role,
    title: description,
    date: new Date(dateStr).toISOString(),
    type,
    completed: false
  };
  
  const submitBtn = DOM.reminderForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  
  try {
    const savedReminder = await addReminder(reminderData);
    // Schedule a real system notification
    await scheduleSystemNotification(savedReminder);
    showToast("Reminder scheduled with notification!", "success");
    DOM.reminderForm.reset();
    DOM.reminderForm.style.display = "none";
    DOM.reminderFormChevron.className = "fa-solid fa-chevron-down";
    await loadReminderData(true);
  } catch (err) {
    console.error("Save reminder error:", err);
    showToast("Failed to schedule reminder.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

// Load reminders data
async function loadReminderData(simulateDelay = false) {
  try {
    showRemindersLoadingState();
    if (simulateDelay) {
      // Simulate brief database latency for smooth transitions
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    reminders = await getReminders() || [];
    renderReminders();
  } catch (err) {
    console.error("Failed to load reminders:", err);
    showRemindersErrorState();
  }
}

// Render Scheduled Alerts lists
function renderReminders() {
  if (!DOM.upcomingRemindersList || !DOM.completedRemindersList) return;
  DOM.upcomingRemindersList.innerHTML = "";
  DOM.completedRemindersList.innerHTML = "";
  
  const remindersArray = Array.isArray(reminders) ? reminders : [];
  
  const upcoming = remindersArray.filter(r => r && !r.completed);
  const completed = remindersArray.filter(r => r && r.completed);
  
  // Render Upcoming
  if (upcoming.length === 0) {
    DOM.upcomingRemindersList.innerHTML = `<div style="font-size:0.8rem; text-align:center; color:var(--color-secondary); padding:20px 0;">No reminders yet. Add one to stay on track!</div>`;
  } else {
    upcoming.forEach(rem => {
      if (rem) {
        const card = buildReminderCard(rem);
        DOM.upcomingRemindersList.appendChild(card);
      }
    });
  }
  
  // Render Completed
  if (completed.length === 0) {
    DOM.completedRemindersList.innerHTML = `<div style="font-size:0.8rem; text-align:center; color:var(--color-secondary); padding:20px 0;">No completed reminders yet.</div>`;
  } else {
    completed.forEach(rem => {
      if (rem) {
        const card = buildReminderCard(rem);
        DOM.completedRemindersList.appendChild(card);
      }
    });
  }
}

// Reminder items DOM layout
function buildReminderCard(rem) {
  if (!rem) return document.createElement("div");
  const card = document.createElement("div");
  card.className = `reminder-card ${rem.completed ? "completed" : ""}`;
  
  let formattedDate = "No date";
  let isOverdue = false;
  if (rem.date) {
    try {
      const dt = new Date(rem.date);
      const options = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
      formattedDate = dt.toLocaleString("en-US", options);
      isOverdue = !rem.completed && dt < new Date();
    } catch (e) {
      formattedDate = "Invalid Date";
    }
  }
  
  card.innerHTML = `
    <div class="reminder-checkbox ${rem.completed ? "checked" : ""}">
      ${rem.completed ? '<i class="fa-solid fa-check"></i>' : ""}
    </div>
    
    <div class="reminder-info">
      <div class="reminder-title">${escapeHTML(rem.title || "No Title")}</div>
      <div class="reminder-meta">
        <span style="font-weight:600; color:var(--color-accent);">${escapeHTML(rem.company || "General")}</span>
        <span>•</span>
        <span style="${isOverdue ? "color:var(--color-rejected); font-weight:600;" : ""}">
          <i class="fa-regular fa-clock"></i> ${formattedDate} ${isOverdue ? "(Overdue)" : ""}
        </span>
        <span>•</span>
        <span style="background:rgba(255,255,255,0.05); padding:1px 6px; border-radius:4px; font-size:0.6rem;">${escapeHTML(rem.type || "Reminder")}</span>
      </div>
    </div>
    
    <button class="reminder-delete-btn" title="Delete Schedule">
      <i class="fa-regular fa-trash-can"></i>
    </button>
  `;
  
  // Click checkbox toggles completion
  card.querySelector(".reminder-checkbox").addEventListener("click", async () => {
    try {
      const newStatus = !rem.completed;
      await updateReminder(rem.id, { completed: newStatus });
      if (newStatus) {
        // Completed — cancel the scheduled notification
        await cancelSystemNotification(rem.id);
        showToast("Event marked complete. Notification cancelled.", "success");
      } else {
        // Re-opened — reschedule the notification if in future
        await scheduleSystemNotification(rem);
        showToast("Event set to pending. Notification rescheduled.", "success");
      }
      await loadReminderData(true);
    } catch (err) {
      console.error("Toggle reminder error:", err);
    }
  });
  
  // Click Delete button
  card.querySelector(".reminder-delete-btn").addEventListener("click", async () => {
    try {
      await cancelSystemNotification(rem.id);
      await deleteReminder(rem.id);
      showToast("Reminder and notification deleted.", "info");
      await loadReminderData(true);
    } catch (err) {
      console.error("Delete reminder error:", err);
    }
  });
  
  return card;
}

// ==================== NATIVE NOTIFICATION SYSTEM ====================
// Uses Capacitor LocalNotifications on native, falls back to browser API on web.

// Generate a stable numeric ID from a reminder string ID for Capacitor
function reminderIdToNotificationId(remId) {
  let hash = 0;
  const str = String(remId);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 2147483647; // Positive 32-bit int
}

// Request notification permission (Capacitor native or browser fallback)
async function checkNotificationPermission(request = false) {
  if (isNativeNotifications && LocalNotifications) {
    try {
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display === 'granted') {
        DOM.btnRequestNotifications.style.display = "none";
        return true;
      }
      if (request && permStatus.display !== 'denied') {
        permStatus = await LocalNotifications.requestPermissions();
        if (permStatus.display === 'granted') {
          DOM.btnRequestNotifications.style.display = "none";
          showToast("Notifications enabled! You'll receive alerts for your reminders.", "success");
          // Reschedule all pending reminders now that we have permission
          await rescheduleAllReminders();
          return true;
        } else {
          showToast("Notifications permission denied. You can enable it in device Settings.", "error");
          return false;
        }
      }
      return permStatus.display === 'granted';
    } catch (e) {
      console.error('Capacitor notification permission error:', e);
      return false;
    }
  } else {
    // Browser fallback
    if (!("Notification" in window)) {
      DOM.btnRequestNotifications.style.display = "none";
      return false;
    }
    if (Notification.permission === "granted") {
      DOM.btnRequestNotifications.style.display = "none";
      return true;
    }
    if (request && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        DOM.btnRequestNotifications.style.display = "none";
        showToast("Browser notifications enabled!", "success");
        return true;
      }
    }
    if (request && Notification.permission === "denied") {
      showToast("Notifications blocked. Enable in browser settings.", "error");
    }
    return Notification.permission === "granted";
  }
}

// Schedule a system notification for a reminder
async function scheduleSystemNotification(rem) {
  if (!rem || rem.completed) return;

  const scheduleTime = new Date(rem.date);
  // Don't schedule if time is in the past
  if (scheduleTime <= new Date()) {
    console.log(`Skipping notification for past reminder: ${rem.id}`);
    return;
  }

  const notifId = reminderIdToNotificationId(rem.id);
  const title = rem.company || 'InternTrack Reminder';
  const body = `${rem.type}: ${rem.title}` + (rem.role ? ` — ${rem.role}` : '');

  if (isNativeNotifications && LocalNotifications) {
    try {
      // Cancel any existing notification with this ID first
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });

      await LocalNotifications.schedule({
        notifications: [{
          id: notifId,
          title: title,
          body: body,
          schedule: { at: scheduleTime, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_stat_icon',
          iconColor: '#6366f1',
          extra: { reminderId: rem.id }
        }]
      });
      console.log(`Scheduled native notification ${notifId} for ${scheduleTime.toISOString()}`);
    } catch (e) {
      console.error('Failed to schedule native notification:', e);
      // Fallback: at least use the browser polling approach
      scheduleBrowserFallback(rem);
    }
  } else {
    // Browser fallback: use setTimeout if tab stays open
    scheduleBrowserFallback(rem);
  }
}

// Cancel a scheduled system notification
async function cancelSystemNotification(remId) {
  const notifId = reminderIdToNotificationId(remId);

  if (isNativeNotifications && LocalNotifications) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
      console.log(`Cancelled native notification ${notifId}`);
    } catch (e) {
      console.error('Failed to cancel notification:', e);
    }
  }

  // Also clear any browser setTimeout
  if (browserNotificationTimers[remId]) {
    clearTimeout(browserNotificationTimers[remId]);
    delete browserNotificationTimers[remId];
  }
}

// Reschedule all pending reminders (used after granting permission)
async function rescheduleAllReminders() {
  for (const rem of reminders) {
    if (!rem.completed) {
      await scheduleSystemNotification(rem);
    }
  }
}

// Browser fallback: use setTimeout for notifications when tab is open
const browserNotificationTimers = {};

function scheduleBrowserFallback(rem) {
  const scheduleTime = new Date(rem.date);
  const delay = scheduleTime.getTime() - Date.now();

  if (delay <= 0) return;

  // Clear any existing timer for this reminder
  if (browserNotificationTimers[rem.id]) {
    clearTimeout(browserNotificationTimers[rem.id]);
  }

  browserNotificationTimers[rem.id] = setTimeout(async () => {
    const title = `${rem.company} — InternTrack`;
    const bodyText = `${rem.type}: ${rem.title}`;

    showToast(bodyText, "info");

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: bodyText,
        icon: "https://api.dicebear.com/7.x/bottts/svg?seed=" + encodeURIComponent(rem.company)
      });
    }

    // Auto-complete
    try {
      await updateReminder(rem.id, { completed: true });
      await loadReminderData();
    } catch (e) {
      console.error('Browser fallback auto-complete error:', e);
    }

    delete browserNotificationTimers[rem.id];
  }, delay);

  console.log(`Browser fallback timer set for ${rem.id} in ${Math.round(delay / 1000)}s`);
}

// Listen for notification action taps (native only)
if (isNativeNotifications && LocalNotifications) {
  LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
    const remId = action.notification?.extra?.reminderId;
    if (remId) {
      // Mark as completed when user taps the notification
      try {
        await updateReminder(remId, { completed: true });
        await loadReminderData();
        showToast('Reminder completed.', 'success');
      } catch (e) {
        console.error('Notification tap handler error:', e);
      }
    }
  });
}

DOM.btnRequestNotifications.addEventListener("click", () => {
  checkNotificationPermission(true);
});

// ==================== APP INITIALIZATION ====================
// Setup notifications at startup
async function setupStartupNotifications() {
  try {
    const hasPermission = await checkNotificationPermission(false);
    if (hasPermission) {
      await rescheduleAllReminders();
    } else {
      for (const rem of reminders) {
        if (!rem.completed) scheduleBrowserFallback(rem);
      }
    }
  } catch (err) {
    console.error("Failed to setup startup notifications:", err);
  }
}

// App starts immediately — no authentication required
(async function init() {
  showView("home-view");
  
  // Instantly paint loading skeletons for dashboard sections to improve visual transition
  showRecentAppsLoadingState();
  showApplicationsLoadingState();
  showRemindersLoadingState();
  
  // Progressively fetch data in the background without blocking the initial view render
  setTimeout(async () => {
    try {
      const [appsData, remindersData] = await Promise.all([
        getApplications() || [],
        getReminders() || []
      ]);
      
      applications = appsData;
      reminders = remindersData;
      
      // Stage 1: Render metrics/counters and drop-down lists immediately
      renderDashboardSummary();
      populateReminderAppsDropdown();
      
      // Stage 2: Render recent applications and full applications lists in the next frame
      requestAnimationFrame(() => {
        renderDashboardRecent();
        renderApplicationsList();
      });
      
      // Stage 3: Render reminders list in the next frame
      requestAnimationFrame(() => {
        renderReminders();
        setupStartupNotifications();
      });
      
    } catch (err) {
      console.error("Async startup data load failed:", err);
      showApplicationsErrorState();
      showRemindersErrorState();
    }
  }, 0);
  
  // Support filtering via URL status parameter/hash on startup
  const urlParams = new URLSearchParams(window.location.search);
  let statusParam = urlParams.get('status') || window.location.hash.replace('#', '');
  if (statusParam) {
    statusParam = statusParam.toLowerCase();
    const validFilters = ["wishlist", "applied", "online assessment", "oa", "interview", "offer", "accepted", "rejected"];
    if (validFilters.includes(statusParam)) {
      if (statusParam === "oa") statusParam = "online assessment";
      showView("applications-view");
      setApplicationsFilter(statusParam);
    }
  }
  
  console.log("InternTrack: Ready — background loading active.");
})();


// Escape HTML utility
function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.innerText = str;
  return div.innerHTML;
}
