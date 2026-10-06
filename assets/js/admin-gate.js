(function (global) {
  "use strict";

  var STORAGE_KEY = "joyforest_van_admin_auth";
  var ADMIN_PASSWORD = "5551";

  function isAuthed() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function setAuthed(ok) {
    try {
      if (ok) sessionStorage.setItem(STORAGE_KEY, "1");
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      /* Safari 私密模式等情況下仍可維持目前頁面操作。 */
    }
  }

  function tryLogin(password) {
    var ok = String(password || "").trim() === ADMIN_PASSWORD;
    if (ok) setAuthed(true);
    return ok;
  }

  function logout() {
    setAuthed(false);
  }

  function requireAuth(loginPath) {
    if (isAuthed()) return true;
    window.location.replace(loginPath || "/pages/admin");
    return false;
  }

  global.JoyForestVanAdminGate = { isAuthed: isAuthed, tryLogin: tryLogin, logout: logout, requireAuth: requireAuth };
})(window);
