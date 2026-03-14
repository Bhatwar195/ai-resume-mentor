/* ── State ─────────────────────────────────────────────── */
let selectedFile = null;
let resumeData   = null;   // last analyze result
let chatHistory  = [];     // [{role, content}]

/* ── Nav Page Switch ────────────────────────────────────  */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('nav-btn-' + name).classList.add('active');
  if (name === 'chat') refreshChatContext();
}

/* ── Upload ─────────────────────────────────────────────  */
const fileInput  = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
const fileBadge  = document.getElementById('fileBadge');
const fileNameEl = document.getElementById('fileName');
const fileRemove = document.getElementById('fileRemove');
const errorBox   = document.getElementById('errorBox');

fileInput.addEventListener('change', e => { if (e.target.files[0]) setFile(e.target.files[0]); });

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.name.toLowerCase().endsWith('.pdf')) setFile(f);
  else showError('Please drop a valid PDF file.');
});

function setFile(f) {
  selectedFile = f;
  fileNameEl.textContent = f.name;
  fileBadge.classList.add('show');
  hideError();
}

fileRemove.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  fileBadge.classList.remove('show');
});

function showError(msg) { errorBox.textContent = msg; errorBox.classList.add('show'); }
function hideError()    { errorBox.classList.remove('show'); }

/* ── Analyze ────────────────────────────────────────────  */
async function analyzeResume() {
  hideError();
  if (!selectedFile) { showError('Please upload a PDF resume first.'); return; }

  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.disabled = true;
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('resultsArea').classList.remove('active');
  document.getElementById('loadingBlock').classList.add('show');

  const fd = new FormData();
  fd.append('file', selectedFile);
  fd.append('job_title', document.getElementById('jobTitle').value.trim());
  fd.append('job_description', document.getElementById('jobDescription').value.trim());

  try {
    const res  = await fetch('/analyze', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Analysis failed.');
    resumeData = data;
    renderResults(data);
  } catch (err) {
    document.getElementById('loadingBlock').classList.remove('show');
    document.getElementById('emptyState').style.display = 'flex';
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    analyzeBtn.disabled = false;
  }
}

/* ── Render Results ─────────────────────────────────────  */
function renderResults(d) {
  document.getElementById('loadingBlock').classList.remove('show');

  // ── Resume Score ring
  const score = d.score || 0;
  const r = 34, circ = 2 * Math.PI * r;
  const fill = document.getElementById('scoreRingFill');
  fill.setAttribute('stroke-dasharray', circ);
  fill.setAttribute('stroke-dashoffset', circ - (score / 10) * circ);
  document.getElementById('scoreNum').textContent = score;
  const titles = ['Needs Major Work','Needs Major Work','Poor','Below Average','Average','Average','Good','Good','Strong','Excellent','Outstanding'];
  document.getElementById('scoreTitle').textContent = titles[score] || 'Good';
  document.getElementById('scoreReason').textContent = d.score_reasoning || '';
  const jdPill = document.getElementById('jdScorePill');
  if (d.has_jd && d.jd_alignment_score) {
    jdPill.textContent = `JD Match: ${d.jd_alignment_score}/10`;
    jdPill.style.display = 'block';
  } else { jdPill.style.display = 'none'; }

  // ── ATS Banner
  const ats = d.ats || {};
  const atsScore = ats.score || 0;
  const atsLabel = (ats.score_label || 'Fair').toLowerCase();
  document.getElementById('atsScoreVal').textContent = atsScore;
  const atsBadgeEl = document.getElementById('atsBadge');
  atsBadgeEl.textContent = ats.score_label || 'Fair';
  atsBadgeEl.className = `ats-badge ${atsLabel}`;
  const atsBar = document.getElementById('atsBar');
  atsBar.style.width = atsScore + '%';
  atsBar.className = `ats-progress-fill ${atsLabel}`;
  document.getElementById('atsReason').textContent = ats.score_reasoning || '';

  // Section presence dots
  const sp = ats.section_present || {};
  const spHtml = Object.entries(sp).map(([k, v]) =>
    `<div class="section-check-item"><div class="check-dot ${v ? 'present' : 'missing'}"></div>${capitalize(k)}</div>`
  ).join('');
  document.getElementById('sectionChecks').innerHTML = spHtml;

  // ── Summary
  document.getElementById('summaryText').textContent = d.professional_summary || '';

  // ── Skills tab
  renderChips('skillsChips', d.extracted_skills || []);
  renderChips('keywordsChips', d.key_keywords || []);
  renderChips('atsKeywordsChips', d.ats_keywords_missing || [], 'amber');

  // Strengths
  document.getElementById('strengthsList').innerHTML =
    (d.strengths || []).map(s =>
      `<div class="strength-item"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>${s}</div>`
    ).join('');

  // ── Feedback tab
  const fb = d.section_feedback || {};
  document.getElementById('feedbackList').innerHTML =
    Object.entries(fb).map(([k, v]) =>
      `<div class="fb-item"><div class="fb-dot"></div><div><div class="fb-section">${k.replace(/_/g,' ')}</div><div class="fb-text">${v}</div></div></div>`
    ).join('');

  // ── Improvements tab
  const imps = d.improvements || [];
  document.getElementById('improvementsList').innerHTML = imps.map(imp => {
    const pri = (imp.priority || 'Medium').toLowerCase();
    return `<div class="imp-item ${pri}">
      <div class="imp-meta">
        <span class="imp-priority ${pri}">${imp.priority || 'Medium'}</span>
        <span class="imp-section">${imp.section || ''}</span>
      </div>
      <div class="imp-issue">${imp.issue || ''}</div>
      <div class="imp-fix"><span class="imp-fix-label">Fix: </span>${imp.fix || ''}</div>
    </div>`;
  }).join('');

  // ── ATS Detail tab
  const fmtIssues = (ats.formatting_issues || []);
  const densityTips = (ats.keyword_density_tips || []);
  document.getElementById('atsFmtList').innerHTML =
    fmtIssues.length
      ? fmtIssues.map(i => `<div class="fmt-item"><span class="fmt-warn">!</span>${i}</div>`).join('')
      : '<div style="font-size:0.83rem;color:var(--grey-500)">No major formatting issues detected.</div>';
  renderChips('atsDetailKeywords', d.ats_keywords_missing || [], 'red');
  document.getElementById('atsDensityList').innerHTML =
    densityTips.length
      ? densityTips.map(t => `<div class="fmt-item"><span class="fmt-warn">+</span>${t}</div>`).join('')
      : '<div style="font-size:0.83rem;color:var(--grey-500)">No additional tips.</div>';

  // ── JD tab
  const jdEl = document.getElementById('jdContent');
  if (!d.has_jd) {
    jdEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--grey-500);font-size:0.86rem;">No job description provided. Add one to see alignment analysis.</div>';
  } else {
    const missing = d.missing_skills || [];
    const gaps    = d.jd_gaps || [];
    jdEl.innerHTML = `
      <div class="sec-label">Missing Skills</div>
      <div class="chips">${missing.length ? missing.map(s => `<div class="chip red">${s}</div>`).join('') : '<span style="font-size:0.82rem;color:var(--grey-500)">None identified — great alignment!</span>'}</div>
      <div class="divider"></div>
      <div class="sec-label">Alignment Gaps</div>
      ${gaps.length ? gaps.map(g => `<div class="gap-item"><span class="gap-dash">—</span>${g}</div>`).join('') : '<div style="font-size:0.83rem;color:var(--grey-500)">No major gaps identified.</div>'}
    `;
  }

  document.getElementById('resultsArea').classList.add('active');
  switchTab('skills');
}

/* ── Chips helper ───────────────────────────────────────  */
function renderChips(id, items, cls = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.length
    ? items.map(i => `<div class="chip ${cls}">${i}</div>`).join('')
    : '<span style="color:var(--grey-500);font-size:0.8rem">None identified</span>';
}

/* ── Tabs ───────────────────────────────────────────────  */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + name));
}

/* ── Copy summary ───────────────────────────────────────  */
function copySummary() {
  const text = document.getElementById('summaryText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = 'Copy', 1800);
  });
}

/* ── Capitalize helper ──────────────────────────────────  */
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ═══════════════════════════════════════════════════════ */
/* CHATBOT                                                */
/* ═══════════════════════════════════════════════════════ */

function refreshChatContext() {
  const ctxEl = document.getElementById('chatContextInfo');
  if (resumeData) {
    ctxEl.innerHTML = `
      <div style="font-size:0.8rem;font-weight:700;color:var(--blue);margin-bottom:4px;">Resume Loaded</div>
      <div style="font-size:0.78rem;color:var(--grey-700);">${resumeData.filename || 'resume.pdf'}</div>
      <div style="font-size:0.75rem;color:var(--grey-500);margin-top:4px;">Score: ${resumeData.score}/10 &nbsp;|&nbsp; ATS: ${(resumeData.ats||{}).score||'—'}/100</div>`;
  } else {
    ctxEl.innerHTML = '<div style="font-size:0.8rem;color:var(--grey-500);">No resume analyzed yet. Analyze a resume first for context-aware coaching.</div>';
  }
  const jt = document.getElementById('jobTitle')?.value || '';
  const jtEl = document.getElementById('chatJobTitle');
  jtEl.textContent = jt || 'Not set';
}

function sendSuggestion(text) {
  document.getElementById('chatInput').value = text;
  sendChat();
}

async function sendChat() {
  const inputEl = document.getElementById('chatInput');
  const msg = inputEl.value.trim();
  if (!msg) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';

  appendMessage('user', msg);
  chatHistory.push({ role: 'user', content: msg });

  const typing = document.getElementById('chatTyping');
  typing.classList.add('show');
  scrollChat();

  const sendBtn = document.getElementById('chatSendBtn');
  sendBtn.disabled = true;

  try {
    const payload = {
      message: msg,
      resume_text: resumeData?.resume_text || '',
      job_title: document.getElementById('jobTitle')?.value || '',
      job_description: document.getElementById('jobDescription')?.value || '',
      history: chatHistory.slice(-12),
    };
    const res  = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Chat error.');
    const reply = data.reply || 'I could not generate a response. Please try again.';
    chatHistory.push({ role: 'assistant', content: reply });
    typing.classList.remove('show');
    appendMessage('assistant', reply);
  } catch (err) {
    typing.classList.remove('show');
    appendMessage('assistant', 'Sorry, something went wrong. Please try again.');
  } finally {
    sendBtn.disabled = false;
  }
}

function appendMessage(role, text) {
  const msgs = document.getElementById('chatMessages');
  const isUser = role === 'user';
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const avatarHtml = isUser
    ? `<div class="msg-avatar user-av"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg></div>`
    : `<div class="msg-avatar ai"><svg viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg></div>`;

  const formatted = formatChatText(text);

  const div = document.createElement('div');
  div.className = `chat-msg ${isUser ? 'user' : 'assistant'}`;
  div.innerHTML = `
    ${!isUser ? avatarHtml : ''}
    <div>
      <div class="msg-bubble">${formatted}</div>
      <div class="msg-time">${now}</div>
    </div>
    ${isUser ? avatarHtml : ''}
  `;
  msgs.appendChild(div);
  scrollChat();
}

function formatChatText(text) {
  // Bold **text**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Newlines to <br>
  text = text.replace(/\n/g, '<br>');
  return text;
}

function scrollChat() {
  const msgs = document.getElementById('chatMessages');
  msgs.scrollTop = msgs.scrollHeight;
}

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('chatInput');
  if (ta) {
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
  }
});