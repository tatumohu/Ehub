try {
  fetch("/api/projects?user_id=" + decodeURIComponent("%E0%A4%A"));
} catch (e) {
  console.log(e.name, e.message);
}
