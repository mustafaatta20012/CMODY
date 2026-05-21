// account.js – handles updating the account button and bottom label
function updateAccountBtn() {
  const btn = document.getElementById("account-btn");
  const bottomLabel = document.getElementById("bottom-account-label");
  const user = JSON.parse(localStorage.getItem("gm_user") || "null") ||
               JSON.parse(sessionStorage.getItem("gm_user") || "null");

  // Update navigation links based on role
  const adminNavLinks = document.querySelectorAll("a[onclick*=\"navTo('admin'\"]");
  adminNavLinks.forEach(link => {
    if (user) {
      link.style.display = "";
      if (user.role === "ADMIN") {
        link.innerHTML = link.innerHTML.includes("🔑") || link.innerHTML.includes("Admin")
          ? "🔑 Admin"
          : "Admin";
      } else {
        link.innerHTML = link.innerHTML.includes("📦") || link.innerHTML.includes("My Orders")
          ? "📦 My Orders"
          : "My Orders";
      }
    } else {
      link.style.display = "none";
    }
  });

  if (user) {
    const firstName = user.firstName || user.name || "User";
    if (btn) btn.innerHTML = `<span style="color:var(--gold);font-weight:700;font-size:12px">👤 ${firstName}</span>`;
    if (bottomLabel) bottomLabel.textContent = firstName;
  } else {
    if (btn) btn.innerHTML = `👤 <span>Account</span>`;
    if (bottomLabel) bottomLabel.textContent = "Account";
  }

  if (typeof applySavedTheme === "function") {
    applySavedTheme();
  }
}

document.addEventListener("DOMContentLoaded", updateAccountBtn);
