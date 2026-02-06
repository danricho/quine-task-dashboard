document.addEventListener("DOMContentLoaded", function () {
  const resizer = document.getElementById("resizer");
  const sidebar = document.getElementById("sidebar");

  // Load saved width
  const savedWidth = localStorage.getItem("sidebar-width");
  if (savedWidth) {
    sidebar.style.width = savedWidth + "px";
  }

  let isResizing = false;

  resizer.addEventListener("mousedown", function (e) {
    isResizing = true;
    document.body.style.cursor = "ew-resize";
  });

  document.addEventListener("mousemove", function (e) {
    if (!isResizing) return;
    const newWidth = Math.max(150, Math.min(500, e.clientX));
    sidebar.style.width = newWidth + "px";
  });

  document.addEventListener("mouseup", function () {
    if (isResizing) {
      localStorage.setItem("sidebar-width", sidebar.offsetWidth);
    }
    isResizing = false;
    document.body.style.cursor = "";
  });
});
