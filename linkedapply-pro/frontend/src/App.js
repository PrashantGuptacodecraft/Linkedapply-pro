// ============================================================
//  LinkedApply Pro — Main React App (Connected to Backend)
//  File: frontend/src/App.js
// ============================================================

import { useState, useEffect, useRef } from "react";
import * as api from "./api";

const COLORS = {
  bg: "#1e1e1e", card: "#252526", border: "#333333",
  accent: "#007acc", accent2: "#005a9e", green: "#4caf50",
  red: "#f44336", yellow: "#ffeb3b", text: "#cccccc",
  muted: "#888888", surface: "#2d2d30",
};

const KEYWORD_OPTIONS = [
  { value: "JAVA DEVELOPER + C2C", label: "Java Developer + C2C", skillLabel: "Java Developer" },
  { value: "BUSINESS ANALYST + C2C", label: "Business Analyst + C2C", skillLabel: "Business Analyst" },
  { value: "PROJECT MANAGER + C2C", label: "Project Manager + C2C", skillLabel: "Project Manager" },
  { value: "DATA ANALYST + C2C", label: "Data Analyst + C2C", skillLabel: "Data Analyst" },
];

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
  const [resumePath, setResumePath] = useState(null);
  const [resumeName, setResumeName] = useState(null);
  const [keywordDropdownOpen, setKeywordDropdownOpen] = useState(false);
  const logRef = useRef(null);
  const fileRef = useRef(null);
  const dropdownRef = useRef(null);

  const [config, setConfig] = useState({
    linkedinEmail: "", linkedinPass: "",
    gmailEmail: "", gmailPass: "",
    selectedKeyword: KEYWORD_OPTIONS[0].value,
    timeRange: "24",
    // Candidate Profile
    candidateName: "Prashant Gupta",
    candidateTitle: "Senior Java Developer",
    candidateSkills: "Java, Spring Boot, Microservices, AWS, Docker",
    candidateLocation: "Remote / India",
    candidateLinkedIn: "https://www.linkedin.com/in/prashant-gupta-923885328/",
    openToRelocate: "Yes",
    workAuthorization: "Authorized to work in India",
    candidateAvailability: "Immediate",
    totalExperience: "4 Years",
    salary: "50k",
    candidatePhone: "+91 9838693305",
    candidateEmailContact: "adityagupta983869@gmail.com",
    // Email Config
    ccEmails: "",
    bccEmails: "",
  });

  // Close keyword dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setKeywordDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addLog = (msg, type = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-80), { msg, type, time }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const selectedKw = KEYWORD_OPTIONS.find(k => k.value === config.selectedKeyword) || KEYWORD_OPTIONS[0];

  const candidate = {
    name: config.candidateName, title: config.candidateTitle,
    skills: config.candidateSkills, location: config.candidateLocation,
    linkedIn: config.candidateLinkedIn,
    openToRelocate: config.openToRelocate,
    workAuthorization: config.workAuthorization,
    availability: config.candidateAvailability,
    totalExperience: config.totalExperience,
    salary: config.salary,
    phone: config.candidatePhone, email: config.candidateEmailContact,
  };

  const generateSubject = () => {
    return `Submission "${selectedKw.skillLabel}" Local to "${config.candidateLocation}"`;
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
    addLog(`🔍 Searching posts: "${config.selectedKeyword}" (last ${config.timeRange}h)...`, "info");
    try {
      const res = await api.linkedinSearch(config.selectedKeyword, parseInt(config.timeRange));
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
        addLog("No LinkedIn posts were captured for these keywords. Try different keywords.", "error");
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
      .map((j) => ({
        email: j.recruiterEmail,
        name: j.authorName,
        jobTitle: j.postText?.substring(0, 60),
        jobDescription: j.postText || "",
        postUrl: j.postUrl || j.profileUrl || "",
      }));

    if (recruiters.length === 0) {
      addLog("No recruiter emails were found in the selected LinkedIn results.", "error");
      await api.linkedinLogout();
      setRunning(false); setActiveStep(-1);
      return;
    }

    setActiveStep(3);

    addLog(`🚀 Sending ${recruiters.length} submission emails...`, "info");
    try {
      const res = await api.sendBulkEmails({
        fromEmail: config.gmailEmail,
        recruiters,
        candidate,
        resumePath,
        ccEmails: config.ccEmails,
        bccEmails: config.bccEmails,
        skillLabel: selectedKw.skillLabel,
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
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:${COLORS.border};border-radius:4px}
        input,select,textarea{outline:none}
        .btn-primary{background:${COLORS.accent};border:1px solid ${COLORS.accent2};color:white;padding:8px 16px;border-radius:4px;font-family:inherit;font-weight:600;font-size:14px;cursor:pointer;}
        .btn-primary:hover:not(:disabled){background:${COLORS.accent2}}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
        .btn-sec{background:${COLORS.surface};border:1px solid ${COLORS.border};color:${COLORS.text};padding:6px 12px;border-radius:4px;font-size:12px;cursor:pointer;}
        .btn-sec:hover{border-color:${COLORS.accent};color:${COLORS.accent}}
        .ifield{background:${COLORS.surface};border:1px solid ${COLORS.border};color:${COLORS.text};padding:8px;border-radius:4px;font-size:13px;width:100%;font-family:inherit;}
        .ifield:focus{border-color:${COLORS.accent}}
        .modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}
        .modal-box{background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;padding:24px;max-width:650px;width:100%;max-height:85vh;overflow-y:auto}
        .kw-dropdown{position:relative;width:100%}
        .kw-trigger{background:${COLORS.surface};border:1px solid ${COLORS.border};color:${COLORS.text};padding:8px;border-radius:4px;font-size:13px;width:100%;cursor:pointer;display:flex;align-items:center;justify-content:space-between;}
        .kw-trigger:hover,.kw-trigger.open{border-color:${COLORS.accent}}
        .kw-menu{position:absolute;top:100%;left:0;right:0;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:4px;z-index:20;}
        .kw-option{padding:8px;cursor:pointer;font-size:13px;}
        .kw-option:hover{background:${COLORS.surface}}
        .kw-option.selected{background:${COLORS.accent};color:white;}
        .subject-preview{background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:4px;padding:8px;margin-top:8px;font-size:12px;font-family:monospace;color:${COLORS.accent};}
      `}</style>

      {/* Header */}
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20 }}>⚙️</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>AutoApply Script</div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>LinkedIn to Gmail Automation</div>
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
      <div style={{ padding: "16px 20px", display: "flex", gap: 8 }}>
        {steps.map((step, i) => {
          const done = completedSteps.includes(step.id);
          const active = activeStep === i && running;
          return (
            <div key={step.id} style={{ flex: 1, background: COLORS.surface, border: `1px solid ${active ? COLORS.accent : COLORS.border}`, borderRadius: 4, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 14 }}>
                {done ? "✅" : step.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: done ? COLORS.green : active ? COLORS.accent : COLORS.text }}>{step.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div style={{ padding: "0 28px 18px" }}>
        <div style={{ background: COLORS.surface, height: 4 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: COLORS.accent, transition: "width 0.3s" }} />
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
              {/* Keyword Dropdown */}
              <div style={{ gridColumn: "1/-1" }} ref={dropdownRef}>
                <Lbl>Keyword / Skill Set</Lbl>
                <div className="kw-dropdown">
                  <div
                    className={`kw-trigger ${keywordDropdownOpen ? "open" : ""}`}
                    onClick={() => setKeywordDropdownOpen(!keywordDropdownOpen)}
                  >
                    <span>{selectedKw.label}</span>
                    <span style={{ fontSize: 10, color: COLORS.muted, transition: "transform 0.2s", transform: keywordDropdownOpen ? "rotate(180deg)" : "none" }}>▼</span>
                  </div>
                  {keywordDropdownOpen && (
                    <div className="kw-menu">
                      {KEYWORD_OPTIONS.map((kw) => (
                        <div
                          key={kw.value}
                          className={`kw-option ${config.selectedKeyword === kw.value ? "selected" : ""}`}
                          onClick={() => {
                            setConfig(p => ({ ...p, selectedKeyword: kw.value }));
                            setKeywordDropdownOpen(false);
                          }}
                        >
                          <div className={`kw-dot ${config.selectedKeyword === kw.value ? "active" : ""}`} />
                          <span>{kw.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Subject Line Preview */}
                <div className="subject-preview">
                  📧 Subject: {generateSubject()}
                </div>
              </div>
              <div><Lbl>Time Range</Lbl><select className="ifield" value={config.timeRange} onChange={e => setConfig(p => ({...p,timeRange:e.target.value}))}><option value="6">Last 6h</option><option value="12">Last 12h</option><option value="24">Last 24h</option></select></div>
              <div><Lbl>Search In</Lbl><select className="ifield"><option>LinkedIn Posts</option><option>LinkedIn Jobs</option></select></div>
            </div>
          </Sec>

          <Sec title="👤 Candidate Profile">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {[
                ["Full Name","candidateName"],
                ["Title","candidateTitle"],
                ["Phone","candidatePhone"],
                ["Email","candidateEmailContact"],
                ["LinkedIn URL","candidateLinkedIn"],
                ["Current Location","candidateLocation"],
                ["Open to Relocate","openToRelocate","select",["Yes","No"]],
                ["Work Authorization","workAuthorization"],
                ["Availability","candidateAvailability"],
                ["Total Experience","totalExperience"],
                ["Salary","salary"],
              ].map(([lbl, key, type, options]) => (
                <div key={key} style={key === "candidateSkills" ? { gridColumn: "1/-1" } : {}}>
                  <Lbl>{lbl}</Lbl>
                  {type === "select" ? (
                    <select className="ifield" value={config[key]} onChange={e => setConfig(p => ({...p,[key]:e.target.value}))}>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="ifield" placeholder={lbl} value={config[key]} onChange={e => setConfig(p => ({...p,[key]:e.target.value}))} />
                  )}
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <Lbl>Skills</Lbl>
                <input className="ifield" placeholder="Java, Spring Boot, AWS..." value={config.candidateSkills} onChange={e => setConfig(p => ({...p,candidateSkills:e.target.value}))} />
              </div>
            </div>
          </Sec>

          <Sec title="📧 Email Configuration">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <Lbl>Cc (Optional)</Lbl>
                <input className="ifield" placeholder="email1@gmail.com; email2@gmail.com" value={config.ccEmails} onChange={e => setConfig(p => ({...p,ccEmails:e.target.value}))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <Lbl>Bcc (Optional)</Lbl>
                <input className="ifield" placeholder="bcc@gmail.com" value={config.bccEmails} onChange={e => setConfig(p => ({...p,bccEmails:e.target.value}))} />
              </div>
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
                  </div>
                </div>
              ))}
            </div>
          </Sec>

          <Sec title="📝 Email Template Preview">
            <div style={{ background: COLORS.surface, borderRadius: 4, padding: 12, fontFamily: "monospace", fontSize: 12, color: COLORS.text, overflowY: "auto" }}>
              <div style={{ color: COLORS.accent, marginBottom: 4, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>To: Recruiter Email Id</div>
              {config.ccEmails && <div style={{ color: COLORS.accent2, marginBottom: 4, fontSize: 10 }}>Cc: {config.ccEmails}</div>}
              {config.bccEmails && <div style={{ color: COLORS.muted, marginBottom: 4, fontSize: 10 }}>Bcc: {config.bccEmails}</div>}
              <div style={{ color: COLORS.yellow, marginBottom: 8, fontSize: 10 }}>Subject: {generateSubject()}</div>
              <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                <div style={{ color: COLORS.text }}>Hi,</div>
                <div style={{ color: COLORS.text, marginTop: 6 }}>Hope you are doing well.</div>
                <div style={{ color: COLORS.text, marginTop: 8 }}>Kindly find attached resume and below details:</div>
                <div style={{ marginTop: 10 }}>
                  {[
                    ["Full Name", candidate.name],
                    ["Email Address", candidate.email],
                    ["Phone", candidate.phone],
                    ["LinkedIn", candidate.linkedIn || "—"],
                    ["Current Location", candidate.location],
                    ["Open to Relocate", candidate.openToRelocate],
                    ["Work Authorization", candidate.workAuthorization || "—"],
                    ["Availability", candidate.availability],
                    ["Total Experience", candidate.totalExperience || "—"],
                    ["Salary", candidate.salary || "—"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", gap: 6, lineHeight: 2 }}>
                      <span style={{ color: COLORS.accent, minWidth: 140 }}>{label}:</span>
                      <span style={{ color: COLORS.text }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, color: COLORS.text }}>I am actively looking for Contract / C2C roles and am available to start immediately.</div>
                <div style={{ marginTop: 8, color: COLORS.text }}>Thank you for your time and consideration. I look forward to hearing from you.</div>
                <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 11 }}>
                  <strong style={{ color: COLORS.text }}>Post Link:</strong>{" "}
                  <span style={{ color: COLORS.accent, fontStyle: "italic" }}>[Recruiter&apos;s LinkedIn post URL]</span>
                </div>
                <div style={{ marginTop: 12, color: COLORS.text }}>Regards,</div>
                <div style={{ color: COLORS.accent, fontWeight: 600 }}>{candidate.name}</div>
              </div>
            </div>
          </Sec>

          <Sec title="📟 Activity Log" extra={<span style={{ fontSize: 11, color: COLORS.muted }}>{logs.length} entries</span>}>
            <div ref={logRef} style={{ background: COLORS.surface, borderRadius: 4, padding: 12, height: 210, overflowY: "auto", fontFamily: "monospace", fontSize: 12 }}>
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
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: running ? COLORS.green : COLORS.muted, animation: running ? "pulse 1s infinite" : "none" }} />
          <span style={{ fontSize: 12, color: COLORS.muted }}>
            {running ? "🤖 Automation running..." : completedSteps.length === 4 ? "✅ All done!" : "Ready"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-sec" onClick={() => { setLogs([]); setProgress(0); setEmailsSent(0); setCompletedSteps([]); setActiveStep(0); setJobs([]); }} disabled={running}>Reset</button>
          <button className="btn-primary" onClick={runAutomation} disabled={running}>
            {running ? "Running..." : "Start"}
          </button>
        </div>
      </div>

    </div>
  );
}

function Sec({ title, children, extra }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Lbl({ children }) {
  return <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>{children}</div>;
}
