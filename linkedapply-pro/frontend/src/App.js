// ============================================================
//  LinkedApply Pro — Main React App (Connected to Backend)
//  File: frontend/src/App.js
// ============================================================

import { useState, useEffect, useRef } from "react";
import * as api from "./api";

const COLORS = {
  bg: "#0a0f1e", card: "#111827", border: "#1e293b",
  accent: "#0ea5e9", accent2: "#6366f1", green: "#22c55e",
  red: "#ef4444", yellow: "#f59e0b", text: "#f1f5f9",
  muted: "#64748b", surface: "#1e293b",
};

const steps = [
  { id: 1, label: "LinkedIn Login", icon: "🔐" },
  { id: 2, label: "Search Jobs", icon: "🔍" },
  { id: 3, label: "Gmail Login", icon: "📧" },
  { id: 4, label: "Send Emails", icon: "🚀" },
];

export default function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [emailsSent, setEmailsSent] = useState(0);
  const [showEmailPreview, setShowEmailPreview] = useState(null);
  const [resumePath, setResumePath] = useState(null);
  const [resumeName, setResumeName] = useState(null);
  const logRef = useRef(null);
  const fileRef = useRef(null);

  const [config, setConfig] = useState({
    linkedinEmail: "", linkedinPass: "",
    gmailEmail: "", gmailPass: "",
    keywords: "Java Developer, CONTRACT", timeRange: "24",
    candidateName: "Prashant Gupta", candidateTitle: "Senior Java Developer",
    candidateSkills: "Java, Spring Boot, Microservices, AWS, Docker",
    candidateLocation: "Remote /India", candidateVisa: "Yes",
    candidateAvailability: "Immediate", candidatePhone: "+919838693305",
    candidateEmailContact: "adityagupta983869@email.com",
  });

  const addLog = (msg, type = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-80), { msg, type, time }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const candidate = {
    name: config.candidateName, title: config.candidateTitle,
    skills: config.candidateSkills, location: config.candidateLocation,
    visa: config.candidateVisa, availability: config.candidateAvailability,
    phone: config.candidatePhone, email: config.candidateEmailContact,
  };

  const handleResumeUpload = async (file) => {
    try {
      addLog(`📎 Uploading resume: ${file.name}...`, "info");
      const res = await api.uploadResume(file);
      setResumePath(res.data.path);
      setResumeName(file.name);
      addLog(`✅ Resume uploaded: ${file.name}`, "success");
    } catch (err) {
      addLog(`❌ Resume upload failed: ${err.message}`, "error");
    }
  };

  const runAutomation = async () => {
    if (!config.linkedinEmail || !config.linkedinPass || !config.gmailEmail || !config.gmailPass) {
      addLog("Fill in LinkedIn and Gmail credentials first.", "error");
      return;
    }
    setRunning(true); setCompletedSteps([]); setProgress(0);
    setEmailsSent(0); setJobs([]); setSelectedJobs([]);

    let foundJobs = [];
    let selectedJobIds = [];

    // ── STEP 1: LinkedIn Login ─────────────────────────────
    setActiveStep(0);
    addLog("🔐 Launching browser (Playwright)...", "info");
    try {
      const res = await api.linkedinLogin(config.linkedinEmail, config.linkedinPass);
      if (!res.data.success) { addLog(`❌ ${res.data.message}`, "error"); setRunning(false); return; }
      addLog("✅ LinkedIn login successful!", "success");
      setCompletedSteps((p) => [...p, 1]); setProgress(25);
    } catch (err) { addLog(`❌ LinkedIn login error: ${err.message}`, "error"); setRunning(false); return; }

    // ── STEP 2: Search Jobs ────────────────────────────────
    setActiveStep(1);
    addLog(`🔍 Searching posts: "${config.keywords}" (last ${config.timeRange}h)...`, "info");
    try {
      const res = await api.linkedinSearch(config.keywords, parseInt(config.timeRange));
      if (!res.data.success) {
        addLog(res.data.message || "LinkedIn search failed.", "error");
        await api.linkedinLogout();
        setRunning(false); setActiveStep(-1);
        return;
      }
      const found = res.data.posts || [];
      foundJobs = found.map((p, i) => ({ id: i + 1, ...p, status: "pending" }));
      selectedJobIds = foundJobs.map((job) => job.id);
      setJobs(foundJobs);
      setSelectedJobs(selectedJobIds);
      addLog(`✅ Found ${found.length} LinkedIn posts in search results`, "success");
      setCompletedSteps((p) => [...p, 2]); setProgress(50);
      if (foundJobs.length === 0) {
        addLog("No LinkedIn posts were captured for these keywords. Try fewer keywords or terms like 'hiring java developer'.", "error");
        await api.linkedinLogout();
        setRunning(false); setActiveStep(-1);
        return;
      }
    } catch (err) { addLog(`❌ Search error: ${err.message}`, "error"); setRunning(false); return; }

    // ── STEP 3: Gmail Login ────────────────────────────────
    setActiveStep(2);
    addLog("📧 Authenticating Gmail...", "info");
    try {
      const res = await api.gmailLogin(config.gmailEmail, config.gmailPass);
      if (!res.data.success) { addLog(`❌ ${res.data.message}`, "error"); setRunning(false); return; }
      addLog("✅ Gmail authenticated!", "success");
      setCompletedSteps((p) => [...p, 3]); setProgress(65);
    } catch (err) { addLog(`❌ Gmail error: ${err.message}`, "error"); setRunning(false); return; }

    // ── STEP 4: Send Emails ────────────────────────────────
    const recruiters = foundJobs
      .filter((j) => selectedJobIds.includes(j.id) && j.recruiterEmail)
      .map((j) => ({ email: j.recruiterEmail, name: j.authorName, jobTitle: j.postText?.substring(0, 60) }));

    if (recruiters.length === 0) {
      addLog("No recruiter emails were found in the selected LinkedIn results.", "error");
      await api.linkedinLogout();
      setRunning(false); setActiveStep(-1);
      return;
    }

    setActiveStep(3);

    addLog(`🚀 Sending ${recruiters.length} application emails...`, "info");
    try {
      const res = await api.sendBulkEmails({
        fromEmail: config.gmailEmail, recruiters, candidate, resumePath,
      });
      const { sent, failed, results } = res.data;
      results.forEach((r) => {
        if (r.success) { addLog(`✅ Sent to ${r.to}`, "success"); setEmailsSent((e) => e + 1); }
        else addLog(`❌ Failed: ${r.to} — ${r.message}`, "error");
      });
      setJobs((prev) =>
        prev.map((j) => {
          const match = results.find((r) => r.to === j.recruiterEmail);
          return match ? { ...j, status: match.success ? "sent" : "failed" } : j;
        })
      );
      addLog(`🎉 Done! ${sent} sent, ${failed} failed.`, "success");
      setCompletedSteps((p) => [...p, 4]); setProgress(100);
    } catch (err) { addLog(`❌ Send error: ${err.message}`, "error"); }

    await api.linkedinLogout();
    setRunning(false); setActiveStep(-1);
  };

  return (
    <div style={{ fontFamily: "'Syne','DM Sans',sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${COLORS.accent}44;border-radius:2px}
        input,select,textarea{outline:none}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{box-shadow:0 0 10px ${COLORS.accent}44}50%{box-shadow:0 0 28px ${COLORS.accent}88}}
        .running-glow{animation:glow 2s infinite}
        .log-entry{animation:slideIn 0.2s ease}
        .btn-primary{background:linear-gradient(135deg,${COLORS.accent},${COLORS.accent2});border:none;color:white;padding:12px 28px;border-radius:8px;font-family:'Syne',sans-serif;font-weight:700;font-size:14px;cursor:pointer;transition:all 0.2s;letter-spacing:0.5px}
        .btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 20px ${COLORS.accent}44}
        .btn-primary:disabled{opacity:0.45;cursor:not-allowed;transform:none}
        .btn-sec{background:${COLORS.surface};border:1px solid ${COLORS.border};color:${COLORS.text};padding:8px 16px;border-radius:8px;font-size:12px;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif}
        .btn-sec:hover{border-color:${COLORS.accent};color:${COLORS.accent}}
        .ifield{background:${COLORS.surface};border:1px solid ${COLORS.border};color:${COLORS.text};padding:9px 13px;border-radius:8px;font-size:13px;width:100%;transition:border 0.2s;font-family:'DM Sans',sans-serif}
        .ifield:focus{border-color:${COLORS.accent}66}
        .modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:#00000099;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}
        .modal-box{background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto}
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#0d1526 0%,#0a0f1e 100%)", borderBottom: `1px solid ${COLORS.border}`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${COLORS.accent},${COLORS.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
          <div>
            <div style={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 17 }}>LinkedApply <span style={{ color: COLORS.accent }}>Pro</span></div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>LinkedIn → Gmail Auto-Apply Automation</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {[["Jobs Found", jobs.length, COLORS.accent], ["Emails Sent", emailsSent, COLORS.green], ["Progress", `${progress}%`, COLORS.accent2]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 19, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div style={{ padding: "18px 28px", display: "flex", gap: 10 }}>
        {steps.map((step, i) => {
          const done = completedSteps.includes(step.id);
          const active = activeStep === i && running;
          return (
            <div key={step.id} style={{ flex: 1, background: COLORS.card, border: `1px solid ${active ? COLORS.accent : done ? COLORS.green + "44" : COLORS.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: done ? COLORS.green + "22" : active ? COLORS.accent + "22" : COLORS.surface, border: `2px solid ${done ? COLORS.green : active ? COLORS.accent : COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                {done ? "✓" : <span style={active ? { animation: "pulse 1s infinite" } : {}}>{step.icon}</span>}
              </div>
              <div>
                <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1 }}>Step {step.id}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: done ? COLORS.green : active ? COLORS.accent : COLORS.text }}>{step.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div style={{ padding: "0 28px 18px" }}>
        <div style={{ background: COLORS.surface, borderRadius: 4, height: 5 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg,${COLORS.accent},${COLORS.accent2})`, borderRadius: 4, transition: "width 0.6s ease" }} />
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, padding: "0 28px 80px" }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Sec title="🔐 Login Credentials">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {[["LinkedIn Email","linkedinEmail","email"],["LinkedIn Password","linkedinPass","password"],["Gmail Address","gmailEmail","email"],["Gmail App Password","gmailPass","password"]].map(([lbl,key,type]) => (
                <div key={key}><Lbl>{lbl}</Lbl><input className="ifield" type={type} placeholder={lbl} value={config[key]} onChange={e => setConfig(p => ({...p,[key]:e.target.value}))} /></div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.yellow }}>⚠️ Use Gmail App Password (not your account password). Enable 2FA → App Passwords in Google Account.</div>
          </Sec>

          <Sec title="🔍 Search Config">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              <div style={{ gridColumn: "1/-1" }}><Lbl>Keywords</Lbl><input className="ifield" value={config.keywords} onChange={e => setConfig(p => ({...p,keywords:e.target.value}))} /></div>
              <div><Lbl>Time Range</Lbl><select className="ifield" value={config.timeRange} onChange={e => setConfig(p => ({...p,timeRange:e.target.value}))}><option value="6">Last 6h</option><option value="12">Last 12h</option><option value="24">Last 24h</option></select></div>
              <div><Lbl>Search In</Lbl><select className="ifield"><option>LinkedIn Posts</option><option>LinkedIn Jobs</option></select></div>
            </div>
          </Sec>

          <Sec title="👤 Candidate Profile">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {[["Name","candidateName"],["Title","candidateTitle"],["Skills","candidateSkills"],["Location","candidateLocation"],["Visa","candidateVisa"],["Availability","candidateAvailability"],["Phone","candidatePhone"],["Email","candidateEmailContact"]].map(([lbl,key]) => (
                <div key={key} style={key==="candidateSkills"?{gridColumn:"1/-1"}:{}}><Lbl>{lbl}</Lbl><input className="ifield" value={config[key]} onChange={e => setConfig(p => ({...p,[key]:e.target.value}))} /></div>
              ))}
            </div>
          </Sec>

          <Sec title="📎 Resume Upload">
            <div style={{ border: `2px dashed ${resumeName ? COLORS.green+"66" : COLORS.border}`, borderRadius: 10, padding: 18, textAlign: "center", cursor: "pointer" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleResumeUpload(f); }}>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={e => { if(e.target.files[0]) handleResumeUpload(e.target.files[0]); }} />
              <div style={{ fontSize: 26 }}>{resumeName ? "✅" : "📄"}</div>
              <div style={{ fontSize: 12, color: resumeName ? COLORS.green : COLORS.muted, marginTop: 6 }}>{resumeName || "Drop resume here or click to upload"}</div>
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3 }}>PDF, DOC, DOCX</div>
            </div>
          </Sec>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Sec title="💼 Jobs Found" extra={<span style={{ fontSize: 11, background: COLORS.accent+"22", color: COLORS.accent, padding: "3px 10px", borderRadius: 20 }}>Live Results</span>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
              {jobs.length === 0 && <div style={{ color: COLORS.muted, fontSize: 12, textAlign: "center", padding: "30px 0" }}>Jobs will appear here after LinkedIn search runs</div>}
              {jobs.map(job => (
                <div key={job.id} style={{ background: COLORS.surface+"88", borderRadius: 8, padding: "9px 11px", display: "flex", alignItems: "center", gap: 9, border: `1px solid ${job.status==="sent" ? COLORS.green+"44" : job.status==="failed" ? COLORS.red+"44" : COLORS.border}` }}>
                  <input type="checkbox" checked={selectedJobs.includes(job.id)} onChange={e => setSelectedJobs(p => e.target.checked ? [...p,job.id] : p.filter(i=>i!==job.id))} style={{ accentColor: COLORS.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.postText?.substring(0,55)}...</div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>{job.authorName}</div>
                    <div style={{ fontSize: 10, color: COLORS.accent, fontFamily: "'JetBrains Mono'" }}>{job.recruiterEmail || "No email found"}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: job.status==="sent" ? COLORS.green : job.status==="failed" ? COLORS.red : COLORS.muted }}>{job.status==="sent"?"✅ Sent":job.status==="failed"?"❌ Failed":"⏳ Pending"}</div>
                    <button className="btn-sec" style={{ fontSize: 10, padding: "3px 8px", marginTop: 4 }} onClick={() => setShowEmailPreview(job)}>Preview</button>
                  </div>
                </div>
              ))}
            </div>
          </Sec>

          <Sec title="📝 Email Template">
            <div style={{ background: "#070d1a", borderRadius: 8, padding: 12, fontFamily: "'JetBrains Mono'", fontSize: 11, color: COLORS.muted, lineHeight: 1.7, maxHeight: 160, overflowY: "auto" }}>
              <div style={{ color: COLORS.accent, marginBottom: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Subject: Application for [Job Title] – {candidate.name}</div>
              {`Dear [Recruiter Name],\n\nI am writing regarding your recent "${config.keywords}" post on LinkedIn...\n\n📌 ${candidate.name} | ${candidate.title}\n🛠️ ${candidate.skills}\n📍 ${candidate.location} | ${candidate.visa}\n⏰ ${candidate.availability} | 📞 ${candidate.phone}`.split("\n").map((l,i)=>(
                <div key={i} style={{ color: l.startsWith("📌")||l.startsWith("🛠️")||l.startsWith("📍")||l.startsWith("⏰") ? COLORS.accent : COLORS.muted }}>{l||"\u00a0"}</div>
              ))}
            </div>
          </Sec>

          <Sec title="📟 Activity Log" extra={<span style={{ fontSize: 10, color: COLORS.muted }}>{logs.length} entries</span>}>
            <div ref={logRef} style={{ background: "#070d1a", borderRadius: 8, padding: 12, height: 210, overflowY: "auto", fontFamily: "'JetBrains Mono'", fontSize: 11, lineHeight: 1.9 }}>
              {logs.length === 0 && <span style={{ color: COLORS.muted }}>// Logs will appear here when automation runs...</span>}
              {logs.map((log,i) => (
                <div key={i} className="log-entry" style={{ color: log.type==="success"?COLORS.green:log.type==="error"?COLORS.red:COLORS.muted }}>
                  <span style={{ color: "#1e293b", marginRight: 8 }}>{log.time}</span>{log.msg}
                </div>
              ))}
            </div>
          </Sec>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: `${COLORS.bg}ee`, backdropFilter: "blur(12px)", borderTop: `1px solid ${COLORS.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: running ? COLORS.green : COLORS.muted, animation: running ? "pulse 1s infinite" : "none" }} />
          <span style={{ fontSize: 12, color: COLORS.muted }}>
            {running ? "🤖 Automation running..." : completedSteps.length === 4 ? "✅ All done!" : "Ready"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-sec" onClick={() => { setLogs([]); setProgress(0); setEmailsSent(0); setCompletedSteps([]); setActiveStep(0); setJobs([]); }} disabled={running}>🔄 Reset</button>
          <button className={`btn-primary ${running ? "running-glow" : ""}`} onClick={runAutomation} disabled={running}>
            {running ? "⚡ Running..." : "▶ Start Automation"}
          </button>
        </div>
      </div>

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <div className="modal-overlay" onClick={() => setShowEmailPreview(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 15 }}>Email Preview</div>
              <button className="btn-sec" onClick={() => setShowEmailPreview(null)}>✕ Close</button>
            </div>
            <div style={{ background: COLORS.surface, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 11, color: COLORS.muted }}>
              <div><span style={{ color: COLORS.accent }}>To:</span> {showEmailPreview.recruiterEmail}</div>
              <div><span style={{ color: COLORS.accent }}>From:</span> {config.gmailEmail}</div>
              <div><span style={{ color: COLORS.accent }}>Attachment:</span> {resumeName || "resume.pdf"}</div>
            </div>
            <div style={{ background: "#070d1a", borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono'", fontSize: 11, color: COLORS.muted, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {`Dear ${showEmailPreview.authorName},\n\nI hope this message finds you well. I came across your recent LinkedIn post and am very interested in the opportunity.\n\nCandidate: ${candidate.name}\nTitle: ${candidate.title}\nSkills: ${candidate.skills}\nLocation: ${candidate.location}\nVisa: ${candidate.visa}\nAvailability: ${candidate.availability}\nPhone: ${candidate.phone}\nEmail: ${candidate.email}\n\nI am actively seeking Contract/C2C roles and available to start immediately.\n\nBest regards,\n${candidate.name}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sec({ title, children, extra }) {
  return (
    <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 13 }}>{title}</div>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Lbl({ children }) {
  return <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "'DM Sans'" }}>{children}</div>;
}
