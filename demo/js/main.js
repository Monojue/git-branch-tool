// Git Branch Tool — Startup.
applyStatic();
$('#btnRepo').addEventListener('click', () => openRepoDialog());
const openReposAtStart = location.hash === '#repos';
fetchAndLoad().then(() => { if (openReposAtStart && S.ov) openRepoDialog(); });
// Keep one connection open while this page is open; the hidden server (start.vbs) stops when the last one closes
try { new EventSource('/api/alive'); } catch (e) {}
