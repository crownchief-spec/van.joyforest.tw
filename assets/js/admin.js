(function () {
  "use strict";

  var Gate = window.JoyforestVanAdminGate;
  if (!Gate) return;

  var loginSection = document.getElementById("admin-login-section");
  var hubSection = document.getElementById("admin-hub-section");
  var logoutButton = document.getElementById("admin-logout-btn");
  var form = document.getElementById("admin-login-form");
  var passwordInput = document.getElementById("admin-password");
  var error = document.getElementById("admin-login-error");

  function render() {
    var authed = Gate.isAuthed();
    loginSection.hidden = authed;
    hubSection.hidden = !authed;
    logoutButton.hidden = !authed;
    error.hidden = true;
    if (!authed) setTimeout(function () { passwordInput.focus(); }, 0);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (Gate.tryLogin(passwordInput.value)) {
      passwordInput.value = "";
      render();
      return;
    }
    error.textContent = "密碼錯誤，請再試一次。";
    error.hidden = false;
    passwordInput.select();
  });

  logoutButton.addEventListener("click", function () {
    Gate.logout();
    render();
  });

  render();
})();
