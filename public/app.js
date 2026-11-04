const $ = s => document.querySelector(s);
const sessionKey = "falzz_ai_session_v1";
let sid = localStorage.getItem(sessionKey);
if (!sid) { sid = crypto.randomUUID().replaceAll("-", ""); localStorage.setItem(sessionKey, sid); }
const headers = { "Content-Type": "application/json", "X-Falzz-Session": sid };
const messages = $("#messages"), welcome = $("#welcome"), input = $("#messageInput");
function showView(name) {
  document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x.dataset.panel === name));
  $(`#${name}View`).classList.add("active");
  $("#pageTitle").textContent = ({chat:"Percakapan",search:"Pencarian web",memory:"Memori & kepribadian"})[name];
  $("#sidebar").classList.remove("open");
}
document.querySelectorAll(".nav").forEach(b => b.addEventListener("click", () => showView(b.dataset.panel)));
$("#menu").onclick = () => $("#sidebar").classList.toggle("open");
function addMessage(role, content) {
  welcome.style.display = "none";
  const row = document.createElement("div"); row.className = `message ${role}`;
  const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = role === "user" ? "U" : "✦";
  const body = document.createElement("div");
  const who = document.createElement("div"); who.className = "who"; who.textContent = role === "user" ? "KAMU" : "FALZZ AI";
  const bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = content;
  body.append(who,bubble); row.append(avatar,body); messages.append(row); messages.scrollTop = messages.scrollHeight;
}
async function loadHistory() {
  try {
    const r = await fetch("/api/history", { headers });
    const d = await r.json();
    messages.innerHTML = "";
    (d.history || []).forEach(m => addMessage(m.role === "user" ? "user" : "assistant", m.content));
    if (!d.history?.length) welcome.style.display = "";
    $("#personality").value = d.personality || "";
    $("#memory").value = d.memory || "";
  } catch {}
}
async function sendMessage(text) {
  const value = (text ?? input.value).trim(); if (!value) return;
  input.value = ""; input.style.height = "auto";
  addMessage("user", value);
  const btn = $("#sendBtn"); btn.disabled = true; btn.textContent = "…";
  const loading = document.createElement("div"); loading.className = "message"; loading.id = "loading";
  loading.innerHTML = '<div class="avatar">✦</div><div><div class="who">FALZZ AI</div><div class="bubble">Sedang berpikir...</div></div>'; messages.append(loading);
  try {
    const r = await fetch("/api/chat", { method:"POST", headers, body:JSON.stringify({ message:value, mode:$("#codingMode").checked ? "coding" : "normal" }) });
    const d = await r.json(); loading.remove();
    if (!r.ok) throw new Error(d.error || "Permintaan gagal");
    addMessage("assistant", d.answer);
  } catch(e) { loading.remove(); addMessage("assistant", `Maaf, terjadi kendala: ${e.message}`); }
  finally { btn.disabled = false; btn.textContent = "↑"; input.focus(); }
}
$("#chatForm").addEventListener("submit", e => { e.preventDefault(); sendMessage(); });
input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
input.addEventListener("input", () => { input.style.height="auto"; input.style.height=Math.min(input.scrollHeight,160)+"px"; });
document.querySelectorAll("[data-prompt]").forEach(b => b.onclick = () => sendMessage(b.dataset.prompt));
$("#newChat").onclick = async () => { await fetch("/api/history",{method:"DELETE",headers}); messages.innerHTML=""; welcome.style.display=""; showView("chat"); };
$("#saveSettings").onclick = async () => {
  const status=$("#settingsStatus"); status.textContent="Menyimpan...";
  try { const r=await fetch("/api/settings",{method:"PUT",headers,body:JSON.stringify({personality:$("#personality").value,memory:$("#memory").value})}); if(!r.ok) throw Error("Gagal menyimpan"); status.textContent="Pengaturan berhasil disimpan."; }
  catch(e){status.textContent=e.message;}
};
$("#clearHistory").onclick = async () => {
  if(!confirm("Hapus semua riwayat chat untuk sesi ini?")) return;
  await fetch("/api/history",{method:"DELETE",headers}); await loadHistory(); $("#settingsStatus").textContent="Riwayat dihapus.";
};
$("#searchForm").onsubmit = async e => {
  e.preventDefault(); const q=$("#searchInput").value.trim(); if(!q)return;
  const box=$("#searchResults"); box.textContent="Mencari...";
  try {
    const r=await fetch(`/api/search?q=${encodeURIComponent(q)}`); const d=await r.json();
    box.innerHTML="";
    (d.results||[]).forEach(item=>{
      const el=document.createElement("div");el.className="result";
      const a=document.createElement("a");a.textContent=item.title||"Hasil";a.href=item.url||"#";a.target="_blank";a.rel="noopener noreferrer";
      const p=document.createElement("p");p.textContent=item.snippet||"";
      el.append(a,p);box.append(el);
    });
    if(!d.results?.length) box.textContent=d.note||"Tidak ada hasil ringkasan untuk kueri ini.";
  } catch { box.textContent="Pencarian tidak tersedia saat ini."; }
};
loadHistory();
