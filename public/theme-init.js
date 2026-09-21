// Sets the saved theme before the page paints, so a dark mode user never sees a
// white flash. It is a file rather than an inline script so the site's content
// security policy can refuse inline scripts everywhere.
try {
  if (localStorage.getItem("cq-theme") === "dark") document.documentElement.classList.add("dark");
} catch (e) {}
