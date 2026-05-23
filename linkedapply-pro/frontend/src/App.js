// ============================================================
//  LinkedApply Pro — Main React App (Connected to Backend)
//  File: frontend/src/App.js
// ============================================================

import { useState, useEffect, useRef } from "react";
import * as api from "./api";

const COLORS = {
  bg: "#f4f7fb", card: "#ffffff", border: "#d8e0eb",
  accent: "#2563eb", accent2: "#3b82f6", green: "#16a34a",
  red: "#dc2626", yellow: "#f59e0b", text: "#111827",
  muted: "#64748b", surface: "#f8fafc",
};

// ── Role-specific profile presets ────────────────────────────
// Each keyword carries a full candidate profile snapshot.
// Switching the keyword auto-swaps the entire email profile.
const KEYWORD_OPTIONS = [
  {
    value: "JAVA DEVELOPER + C2C",
    label: "Java Developer + C2C",
    skillLabel: "Java Developer",
    profile: {
      candidateTitle: "Java Developer",
      candidateSkills: "Java, OOPs, Spring Boot, Hibernate/JPA, REST APIs, MySQL, JDBC, Maven, Git, GitHub, Postman, DSA, HTML, CSS, JavaScript, React.js",
      totalExperience: "",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028) | SGPA: 8.0/10",
      salary: "As per company norms",
    },
  },
  {
    value: "BUSINESS ANALYST + C2C",
    label: "Business Analyst + C2C",
    skillLabel: "Business Analyst",
    profile: {
      candidateTitle: "Aspiring Business Analyst",
      candidateSkills: "Requirement Gathering, Business Analysis, BRD, FRD, User Stories, Use Cases, SQL, Excel, Power BI, CRM, Jira, Agile, Process Flow Diagrams, Stakeholder Communication, Gap Analysis",
      totalExperience: "",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028) | SGPA: 8.0/10",
      salary: "As per company norms",
    },
  },
  {
    value: "DATA ANALYST + C2C",
    label: "Data Analyst + C2C",
    skillLabel: "Data Analyst",
    profile: {
      candidateTitle: "Aspiring Data Analyst",
      candidateSkills: "Python, SQL, Excel, Power BI, Tableau, Pandas, NumPy, Matplotlib, Seaborn, Scikit-learn, Data Cleaning, EDA, Data Visualization, Statistics, Dashboarding",
      totalExperience: "",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028) | SGPA: 8.0/10",
      salary: "As per company norms",
    },
  },
  {
    value: "FRONTEND DEVELOPER",
    label: "Frontend Developer",
    skillLabel: "Frontend Developer",
    profile: {
      candidateTitle: "Frontend Developer",
      candidateSkills: "HTML5, CSS3, JavaScript, React.js, React Router, Context API, Redux Basics, Bootstrap, Tailwind CSS, Responsive Design, Git, GitHub, Vite, REST API Integration, UI/UX Basics, Figma Basics",
      totalExperience: "",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028) | SGPA: 8.0/10",
      salary: "As per company norms",
    },
  },
  {
    value: "WEB DEVELOPER",
    label: "Web Developer",
    skillLabel: "Web Developer",
    profile: {
      candidateTitle: "Web Developer",
      candidateSkills: "HTML5, CSS3, JavaScript, React.js, Node.js, Express.js, REST APIs, MongoDB, MySQL, Bootstrap, Tailwind CSS, Git, GitHub, Postman, Responsive Web Design, Basic Authentication, Deployment Basics",
      totalExperience: "",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028) | SGPA: 8.0/10",
      salary: "As per company norms",
    },
  },
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
  const [resumeParsing, setResumeParsing] = useState(false);
  const [parsedProfile, setParsedProfile] = useState(null);
  const [resumeParseError, setResumeParseError] = useState(null);
  const [resumeAutoLoaded, setResumeAutoLoaded] = useState(false);
  const [resumeRawText, setResumeRawText] = useState("");  // Full text for AI resume tailoring
  const [keywordDropdownOpen, setKeywordDropdownOpen] = useState(false);
  const [useTailoring, setUseTailoring] = useState(true);
  const logRef = useRef(null);
  const fileRef = useRef(null);
  const dropdownRef = useRef(null);

  const [config, setConfig] = useState({
    linkedinEmail: "", linkedinPass: "",
    gmailEmail: "", gmailPass: "",
    selectedKeyword: KEYWORD_OPTIONS[0].value,
    timeRange: "24",
    // Candidate Profile — auto-swapped when keyword changes
    candidateName: "Prashant Gupta",
    candidateTitle: KEYWORD_OPTIONS[0].profile.candidateTitle,
    candidateSkills: KEYWORD_OPTIONS[0].profile.candidateSkills,
    candidateLocation: "Remote/USA",
    candidateLinkedIn: "https://www.linkedin.com/in/prashant-gupta-923885328/",
    openToRelocate: "Yes",
    workAuthorization: "",
    candidateAvailability: "Immediate",
    totalExperience: KEYWORD_OPTIONS[0].profile.totalExperience,
    salary: KEYWORD_OPTIONS[0].profile.salary,
    candidatePhone: "+91 9838693305",
    candidateEmailContact: "adityagupta983869@gmail.com",
    candidateEducation: KEYWORD_OPTIONS[0].profile.candidateEducation,
    // Email Config
    ccEmails: "",
    bccEmails: "",
    teamLeadName: "",
    teamLeadEmail: "",
  });

  // Auto-load latest existing resume on startup
  useEffect(() => {
    (async () => {
      try {
        const res = await api.getLatestResume();
        if (res.data.found) {
          setResumePath(res.data.path);
          setResumeName(res.data.filename);
          setResumeAutoLoaded(true);
          addLog(`📂 Auto-detected existing resume: ${res.data.filename}`, "info");
          // Also parse it with AI to auto-fill profile
          setResumeParsing(true);
          try {
            const { parseResumeByPath } = await import("./api").then(m => ({ parseResumeByPath: m.parseResumeByPath })).catch(() => ({ parseResumeByPath: null }));
            // Fallback: just set path, don't re-parse (file already on disk)
            addLog("✨ Resume ready. Profile fields are pre-filled — upload a new resume to re-parse.", "success");
          } catch {}
          setResumeParsing(false);
        }
      } catch { /* backend not ready yet, ignore */ }
    })();
  }, []);

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

  // Auto-apply the profile preset for the chosen role
  const applyRoleProfile = (kw) => {
    if (!kw.profile) return;
    setConfig(p => ({
      ...p,
      selectedKeyword: kw.value,
      candidateTitle:     kw.profile.candidateTitle,
      candidateSkills:    kw.profile.candidateSkills,
      totalExperience:    kw.profile.totalExperience,
      candidateEducation: kw.profile.candidateEducation,
      salary:             kw.profile.salary,
    }));
    addLog(`🔄 Profile switched to "${kw.label}" — title, skills & experience updated automatically.`, "info");
  };

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
    education: config.candidateEducation,
  };

  const generateSubject = () => {
    return `Submission “SkillSet:${selectedKw.skillLabel}” Local to “${config.candidateLocation}”`;
  };

  const applyParsedProfile = (profile) => {
    if (!profile) return;
    setConfig(p => ({
      ...p,
      ...(profile.candidateName     && { candidateName: profile.candidateName }),
      ...(profile.candidateTitle     && { candidateTitle: profile.candidateTitle }),
      ...(profile.candidatePhone     && { candidatePhone: profile.candidatePhone }),
      ...(profile.candidateEmailContact && { candidateEmailContact: profile.candidateEmailContact }),
      ...(profile.candidateLinkedIn  && { candidateLinkedIn: profile.candidateLinkedIn }),
      ...(profile.candidateLocation  && { candidateLocation: profile.candidateLocation }),
      ...(profile.candidateSkills    && { candidateSkills: profile.candidateSkills }),
      ...(profile.totalExperience    && { totalExperience: profile.totalExperience }),
      ...(profile.workAuthorization  && { workAuthorization: profile.workAuthorization }),
    }));
  };

  const handlePreviewResume = async () => {
    const candidate = {
      name: config.candidateName,
      email: config.candidateEmailContact,
      phone: config.candidatePhone,
      linkedin: config.candidateLinkedIn,
      location: config.candidateLocation,
      relocate: config.openToRelocate,
      workAuth: config.workAuthorization,
      availability: config.candidateAvailability,
      title: config.candidateTitle,
      skills: config.candidateSkills,
      experience: config.totalExperience,
      education: config.candidateEducation,
      salary: config.salary
    };

    addLog(`📄 Generating Preview PDF for ${config.selectedKeyword}...`, "info");
    try {
      const res = await api.previewResume(candidate, config.selectedKeyword);
      if (res.data.success) {
        addLog(`✅ Preview PDF generated. Opening in new tab...`, "success");
        window.open(res.data.url, '_blank');
      } else {
        addLog(`❌ Failed to generate preview PDF: ${res.data.error}`, "error");
      }
    } catch (err) {
      addLog(`❌ Preview PDF error: ${err.message}`, "error");
    }
  };

  const handleResumeUpload = async (file) => {
    setResumeParsing(true);
    setResumeParseError(null);
    setParsedProfile(null);
    setResumeRawText("");
    addLog(`🧠 Uploading & parsing resume with AI: ${file.name}...`, "info");
    try {
      const res = await api.parseResume(file);
      setResumePath(res.data.path);
      setResumeName(file.name);
      // Store full raw text for tailored PDF generation
      if (res.data.rawText) {
        setResumeRawText(res.data.rawText);
        addLog(`📄 Resume text extracted (${res.data.rawText.length} chars) — ready for job-specific PDF tailoring`, "info");
      }
      if (res.data.success && res.data.profile) {
        setParsedProfile(res.data.profile);
        applyParsedProfile(res.data.profile);
        addLog(`✨ Resume parsed! Auto-filled candidate profile from: ${file.name}`, "success");
        if (res.data.profile.candidateName)
          addLog(`👤 Detected: ${res.data.profile.candidateName} • ${res.data.profile.candidateTitle} • ${res.data.profile.totalExperience}`, "success");
      } else {
        setResumeParseError(res.data.error || "AI could not extract profile from this resume.");
        addLog(`⚠️ Resume uploaded but AI parse failed: ${res.data.error || "unknown error"}`, "error");
      }
    } catch (err) {
      setResumeParseError(err.message);
      addLog(`❌ Resume parse error: ${err.message}`, "error");
    } finally {
      setResumeParsing(false);
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
    addLog(`⏳ Auto-expanding to 8 keyword variations & paginating. This may take 10–30 min. Browser will stay open — do not close it.`, "info");
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
    // Deduplicate by email address — same recruiter may appear in multiple posts
    const seenEmails = new Set();
    const allSelectedRecruiters = foundJobs
      .filter((j) => selectedJobIds.includes(j.id) && j.recruiterEmail)
      .filter((j) => {
        if (seenEmails.has(j.recruiterEmail)) return false;
        seenEmails.add(j.recruiterEmail);
        return true;
      })
      .map((j) => ({
        email: j.recruiterEmail,
        name: j.authorName,
        jobTitle: j.postText?.substring(0, 60),
        jobDescription: j.postText || "",
        postUrl: j.postUrl || "",
      }));

    const postsWithEmail = foundJobs.filter((j) => j.recruiterEmail).length;
    const postsNoEmail = foundJobs.length - postsWithEmail;
    addLog(`📊 Email coverage: ${postsWithEmail} posts have email, ${postsNoEmail} have no email, ${allSelectedRecruiters.length} unique recipients.`, "info");

    const recruiters = allSelectedRecruiters.slice(0, 500);
    if (allSelectedRecruiters.length > 500) {
      addLog(`⚠️ Selected ${allSelectedRecruiters.length} unique emails; only the first 500 will be sent in this run.`, "error");
    }

    if (recruiters.length === 0) {
      addLog("No recruiter emails were found in the selected LinkedIn results. Try increasing the time range or waiting for more posts.", "error");
      await api.linkedinLogout();
      setRunning(false); setActiveStep(-1);
      return;
    }

    setActiveStep(3);

    addLog(`🚀 Sending ${recruiters.length} submission emails...`, "info");
    if (useTailoring && resumeRawText) {
      addLog(`📄 AI will generate a job-specific tailored resume PDF for each email`, "info");
    }
    try {
      const res = await api.sendBulkEmails({
        fromEmail: config.gmailEmail,
        recruiters,
        candidate,
        resumePath,
        resumeRawText: resumeRawText || "",
        ccEmails: config.ccEmails,
        bccEmails: config.bccEmails,
        skillLabel: selectedKw.skillLabel,
        teamLeadName: config.teamLeadName,
        teamLeadEmail: config.teamLeadEmail,
        useTailoring,
      });
      const { sent = 0, failed = 0, results = [], tailoredPdfCount = 0 } = res.data;
      const tailoredCount = results.filter((r) => r.tailored).length;
      results.forEach((r) => {
        if (r.success) { addLog(`✅ Sent to ${r.to}${r.tailored ? " ✨ AI-tailored" : ""}${r.tailoredResume ? " 📄 Custom PDF" : ""}`, "success"); setEmailsSent((e) => e + 1); }
        else addLog(`❌ Failed: ${r.to} — ${r.message}`, "error");
      });
      setJobs((prev) =>
        prev.map((j) => {
          const match = results.find((r) => r.to === j.recruiterEmail);
          return match ? { ...j, status: match.success ? "sent" : "failed" } : j;
        })
      );
      addLog(`🎉 Done! ${sent} sent, ${failed} failed${tailoredCount > 0 ? ` (✨ ${tailoredCount} AI-tailored)` : ""}${tailoredPdfCount > 0 ? ` (📄 ${tailoredPdfCount} custom resume PDFs)` : ""}.`, "success");
      setCompletedSteps((p) => [...p, 4]); setProgress(100);
    } catch (err) { addLog(`❌ Send error: ${err.message}`, "error"); }

    await api.linkedinLogout();
    setRunning(false); setActiveStep(-1);
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Ubuntu,sans-serif;background:${COLORS.bg};color:${COLORS.text}}
        ::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:${COLORS.border};border-radius:4px}
        input,select,textarea,button{outline:none}
        button{font:inherit}
        .btn-primary{background:${COLORS.accent};border:1px solid ${COLORS.accent2};color:white;padding:10px 18px;border-radius:999px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;transition:background 0.2s,transform 0.2s;}
        .btn-primary:hover:not(:disabled){background:${COLORS.accent2};transform:translateY(-1px)}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
        .btn-sec{background:${COLORS.surface};border:1px solid ${COLORS.border};color:${COLORS.text};padding:8px 14px;border-radius:999px;font-size:13px;cursor:pointer;transition:border-color 0.2s,color 0.2s;}
        .btn-sec:hover{border-color:${COLORS.accent};color:${COLORS.accent}}
        .ifield{background:${COLORS.surface};border:1px solid ${COLORS.border};color:${COLORS.text};padding:12px 14px;border-radius:12px;font-size:14px;width:100%;font-family:inherit;transition:border-color 0.2s,box-shadow 0.2s;}
        .ifield:focus{border-color:${COLORS.accent};box-shadow:0 0 0 4px rgba(59,130,246,0.12)}
        .modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.35);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}
        .modal-box{background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:18px;padding:24px;max-width:650px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 18px 40px rgba(15,23,42,0.1)}
        .kw-dropdown{position:relative;width:100%}
        .kw-trigger{background:${COLORS.surface};border:1px solid ${COLORS.border};color:${COLORS.text};padding:12px 14px;border-radius:12px;font-size:14px;width:100%;cursor:pointer;display:flex;align-items:center;justify-content:space-between;}
        .kw-trigger:hover,.kw-trigger.open{border-color:${COLORS.accent}}
        .kw-menu{position:absolute;top:100%;left:0;right:0;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;z-index:20;box-shadow:0 10px 30px rgba(15,23,42,0.08);}
        .kw-option{padding:12px 14px;cursor:pointer;font-size:14px;}
        .kw-option:hover{background:${COLORS.surface}}
        .kw-option.selected{background:${COLORS.accent};color:white;}
        .subject-preview{background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:12px;padding:10px 14px;margin-top:8px;font-size:13px;font-family:monospace;color:${COLORS.accent};}
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
                            applyRoleProfile(kw);
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
                {/* Active profile badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, background: COLORS.accent + "0d", border: `1px solid ${COLORS.accent}33`, borderRadius: 8, padding: "7px 12px" }}>
                  <span style={{ fontSize: 13 }}>👤</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent }}>Active Profile: </span>
                    <span style={{ fontSize: 11, color: COLORS.text }}>{config.candidateTitle}</span>
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {config.candidateSkills.split(",").slice(0, 4).join(", ")}…
                  </div>
                </div>
                {/* Subject Line Preview */}
                <div className="subject-preview">
                  📧 Subject: {generateSubject()}
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button 
                    className="btn btn-primary"
                    onClick={handlePreviewResume}
                    style={{ flex: 1, padding: "8px 0", fontSize: 13, background: COLORS.secondary, borderColor: COLORS.secondary, color: COLORS.text }}
                  >
                    📄 Preview Generated PDF
                  </button>
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
                ["Title / Role","candidateTitle"],
                ["Phone","candidatePhone"],
                ["Email","candidateEmailContact"],
                ["LinkedIn URL","candidateLinkedIn"],
                ["Current Location","candidateLocation"],
                ["Open to Relocate","openToRelocate","select",["Yes","No"]],
                ["Work Authorization","workAuthorization"],
                ["Availability","candidateAvailability"],
                ["Total Experience","totalExperience"],
                ["Salary Expectation","salary"],
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
                <Lbl>Education</Lbl>
                <input className="ifield" placeholder="B.Tech CSE – University (Year) | CGPA: X.X" value={config.candidateEducation} onChange={e => setConfig(p => ({...p,candidateEducation:e.target.value}))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <Lbl>Key Skills</Lbl>
                <input className="ifield" placeholder="Python, SQL, Power BI, Tableau..." value={config.candidateSkills} onChange={e => setConfig(p => ({...p,candidateSkills:e.target.value}))} />
              </div>
            </div>
          </Sec>

          <Sec title="📧 Email Configuration">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              <div>
                <Lbl>Team Lead Name</Lbl>
                <input className="ifield" placeholder="Team Lead Full Name" value={config.teamLeadName} onChange={e => setConfig(p => ({...p,teamLeadName:e.target.value}))} />
              </div>
              <div>
                <Lbl>Team Lead Email</Lbl>
                <input className="ifield" placeholder="teamlead@gmail.com" value={config.teamLeadEmail} onChange={e => setConfig(p => ({...p,teamLeadEmail:e.target.value}))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <Lbl>Auto Cc (always included)</Lbl>
                <div className="ifield" style={{ background: "transparent", opacity: 0.7, cursor: "default", fontSize: 12 }}>
                  {[config.candidateEmailContact, config.teamLeadEmail].filter(Boolean).join(" ; ") || "—"}
                </div>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <Lbl>Additional Cc (Optional)</Lbl>
                <input className="ifield" placeholder="extra1@gmail.com; extra2@gmail.com" value={config.ccEmails} onChange={e => setConfig(p => ({...p,ccEmails:e.target.value}))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <Lbl>Bcc (Optional)</Lbl>
                <input className="ifield" placeholder="bcc@gmail.com" value={config.bccEmails} onChange={e => setConfig(p => ({...p,bccEmails:e.target.value}))} />
              </div>
              {/* AI Tailoring Toggle */}
              <div style={{ gridColumn: "1/-1", marginTop: 4 }}>
                <div
                  onClick={() => setUseTailoring(p => !p)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                    background: useTailoring ? COLORS.accent + "11" : COLORS.surface,
                    border: `1px solid ${useTailoring ? COLORS.accent + "55" : COLORS.border}`,
                    borderRadius: 10, padding: "10px 14px",
                    transition: "all 0.2s",
                  }}
                >
                  {/* Toggle pill */}
                  <div style={{
                    width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                    background: useTailoring ? COLORS.accent : COLORS.border,
                    position: "relative", transition: "background 0.2s",
                  }}>
                    <div style={{
                      position: "absolute", top: 3, left: useTailoring ? 18 : 3,
                      width: 14, height: 14, borderRadius: "50%", background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: useTailoring ? COLORS.accent : COLORS.text }}>
                      ✨ AI-Tailor Email per Job Post
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                      {useTailoring
                        ? "Groq AI will write a custom pitch + highlight relevant skills for each recruiter’s post"
                        : "Emails will use the same generic pitch for all recruiters"}
                    </div>
                  </div>
                  {useTailoring && (
                    <div style={{ fontSize: 10, background: COLORS.accent, color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700, flexShrink: 0 }}>
                      ON
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Sec>

          <Sec title="🧠 Resume & AI Profile" extra={
            resumeParsing ? <span style={{ fontSize: 11, color: COLORS.accent, display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: COLORS.accent, animation: "pulse 1s infinite" }} />Parsing...</span>
            : parsedProfile ? <span style={{ fontSize: 11, background: COLORS.green+"22", color: COLORS.green, padding: "2px 8px", borderRadius: 20 }}>✨ AI Parsed</span>
            : resumeAutoLoaded ? <span style={{ fontSize: 11, background: COLORS.accent+"22", color: COLORS.accent, padding: "2px 8px", borderRadius: 20 }}>📂 Auto-loaded</span>
            : null
          }>
            {/* Auto-detected banner */}
            {resumeAutoLoaded && !parsedProfile && !resumeParsing && (
              <div style={{ marginBottom: 10, background: COLORS.accent+"11", border: `1px solid ${COLORS.accent}33`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: COLORS.accent, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📂</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Using saved resume: {resumeName}</div>
                  <div style={{ color: COLORS.muted, marginTop: 1 }}>Upload a new file below to replace it and re-parse with AI</div>
                </div>
              </div>
            )}

            {/* Drop Zone */}
            <div
              style={{ border: `2px dashed ${resumeName ? COLORS.green+"88" : COLORS.border}`, borderRadius: 10, padding: resumeParsing ? 14 : 16, textAlign: "center", cursor: resumeParsing ? "not-allowed" : "pointer", transition: "all 0.2s", background: resumeParsing ? COLORS.accent+"06" : "transparent" }}
              onClick={() => !resumeParsing && fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !resumeParsing) handleResumeUpload(f); }}>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleResumeUpload(e.target.files[0]); }} />
              {resumeParsing ? (
                <>
                  <div style={{ fontSize: 22 }}>⏳</div>
                  <div style={{ fontSize: 12, color: COLORS.accent, marginTop: 6, fontWeight: 600 }}>AI is reading your resume...</div>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Extracting profile data with Groq AI</div>
                </>
              ) : resumeName ? (
                <>
                  <div style={{ fontSize: 22 }}>✅</div>
                  <div style={{ fontSize: 12, color: COLORS.green, marginTop: 5, fontWeight: 600 }}>{resumeName}</div>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Click to upload a different resume</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 24 }}>📄</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 5 }}>Drop resume here or click to upload</div>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>PDF, DOCX — AI will auto-fill your profile</div>
                </>
              )}
            </div>

            {/* Parse Error */}
            {resumeParseError && (
              <div style={{ marginTop: 8, background: COLORS.red+"11", border: `1px solid ${COLORS.red}33`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: COLORS.red }}>
                ⚠️ {resumeParseError}
              </div>
            )}

            {/* AI Extracted Profile Card */}
            {parsedProfile && (
              <div style={{ marginTop: 10, background: COLORS.accent+"08", border: `1px solid ${COLORS.accent}33`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>✨ AI Extracted Profile</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {[
                    parsedProfile.candidateName && `👤 ${parsedProfile.candidateName}`,
                    parsedProfile.candidateTitle && `💼 ${parsedProfile.candidateTitle}`,
                    parsedProfile.totalExperience && `⏱️ ${parsedProfile.totalExperience}`,
                    parsedProfile.candidateLocation && `📍 ${parsedProfile.candidateLocation}`,
                    parsedProfile.workAuthorization && `🌐 ${parsedProfile.workAuthorization}`,
                    parsedProfile.educationHighlight && `🎓 ${parsedProfile.educationHighlight}`,
                  ].filter(Boolean).map((chip, i) => (
                    <span key={i} style={{ background: COLORS.accent+"15", color: COLORS.accent, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 500 }}>{chip}</span>
                  ))}
                </div>
                {parsedProfile.candidateSkills && (
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: COLORS.text }}>Skills: </span>{parsedProfile.candidateSkills}
                  </div>
                )}
                {parsedProfile.topTechnologies && (
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: COLORS.text }}>Top Tech: </span>{parsedProfile.topTechnologies}
                  </div>
                )}
                {parsedProfile.certifications && (
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: COLORS.text }}>Certs: </span>{parsedProfile.certifications}
                  </div>
                )}
                {parsedProfile.candidateSummary && (
                  <div style={{ fontSize: 10, color: COLORS.muted, fontStyle: "italic", marginTop: 6, borderTop: `1px solid ${COLORS.border}`, paddingTop: 6 }}>
                    {parsedProfile.candidateSummary}
                  </div>
                )}
                <button
                  className="btn-primary"
                  style={{ marginTop: 10, width: "100%", fontSize: 12, padding: "8px", borderRadius: 8 }}
                  onClick={() => applyParsedProfile(parsedProfile)}
                >
                  ↺ Re-apply AI Data to Profile Fields
                </button>
              </div>
            )}
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
              {/* Headers */}
              <div style={{ color: COLORS.accent, marginBottom: 3, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>To: <span style={{ color: COLORS.text, textTransform: "none" }}>Recruiter Email Id</span></div>
              <div style={{ color: COLORS.accent, marginBottom: 3, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Cc: <span style={{ color: COLORS.text, textTransform: "none", fontWeight: 400 }}>{[config.candidateEmailContact, config.teamLeadEmail].filter(Boolean).join(" ; ") || "—"}{config.ccEmails ? " ; " + config.ccEmails : ""}</span></div>
              <div style={{ color: COLORS.accent, marginBottom: 3, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Bcc: <span style={{ color: COLORS.muted, textTransform: "none" }}>{config.bccEmails || "—"}</span></div>
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
                    ["Experience / Level", candidate.totalExperience || "—"],
                    ["Education", candidate.education || "—"],
                    ["Salary", candidate.salary || "—"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", gap: 6, lineHeight: 2 }}>
                      <span style={{ color: COLORS.accent, minWidth: 160 }}>{label}:</span>
                      <span style={{ color: COLORS.text }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, color: COLORS.text }}>I am actively looking for Contract / C2C roles and am available to start immediately. I would love the opportunity to discuss how my background aligns with your requirements.</div>
                <div style={{ marginTop: 8, color: COLORS.text }}>Thank you for your time and consideration. I look forward to hearing from you.</div>
                {/* Post Link before Regards */}
                <div style={{ marginTop: 12, color: COLORS.text, fontSize: 12 }}>
                  <strong>Post Link:</strong>{" "}
                  <span style={{ color: COLORS.accent, fontStyle: "italic" }}>[Recruiter&apos;s LinkedIn post URL]</span>
                </div>
                <div style={{ marginTop: 14, color: COLORS.text }}>Regards,</div>
                <div style={{ marginTop: 4, color: COLORS.accent, fontWeight: 600 }}>{candidate.name}</div>
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
