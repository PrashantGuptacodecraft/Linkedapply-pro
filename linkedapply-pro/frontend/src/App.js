// ============================================================
//  LinkedApply Pro — Main React App (Connected to Backend)
//  File: frontend/src/App.js
// ============================================================

import { useState, useEffect, useRef } from "react";
import * as api from "./api";

const COLORS = {
  bg: "#060913", // Extremely deep visual dark-blue background
  card: "#0d1321", // Premium dark card panels
  border: "#1a2333", // Elegant slate-gray outline borders
  accent: "#6366f1", // Neon Indigo accent for key branding
  accent2: "#3b82f6", // Electric Blue secondary accent
  secondary: "#1f2937", // Warm slate-gray for standard buttons
  green: "#10b981", // Emerald green for success states
  red: "#f43f5e", // Rose red for failure/error alerts
  yellow: "#f59e0b", // Warm yellow for warning notices
  text: "#f8fafc", // Clean, high-contrast off-white body text
  muted: "#64748b", // Subdued slate-gray for helpers/labels
  surface: "#161f30", // Dark slate-blue surface for fields and logs
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
      totalExperience: "2 years",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028)",
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
      totalExperience: "2 years",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028)",
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
      totalExperience: "2 years",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028)",
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
      totalExperience: "2 years",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028)",
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
      totalExperience: "2 years",
      candidateEducation: "B.Tech CSE – KIET Group of Institutions (2024–2028)",
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
  const [activeTab, setActiveTab] = useState("setup"); // setup, profile, resume
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
  const [useTailorResume, setUseTailorResume] = useState(true);
  const logRef = useRef(null);
  const fileRef = useRef(null);
  const dropdownRef = useRef(null);
  const runStartTimeRef = useRef(null);
  const addedServerLogsRef = useRef(new Set());

  const [config, setConfig] = useState({
    linkedinEmail: "", linkedinPass: "",
    gmailEmail: "", gmailPass: "",
    selectedKeyword: KEYWORD_OPTIONS[0].value,
    timeRange: "24",
    // Candidate Profile — auto-swapped when keyword changes
    candidateName: "Prashant Gupta",
    candidateTitle: KEYWORD_OPTIONS[0].profile.candidateTitle,
    candidateSkills: KEYWORD_OPTIONS[0].profile.candidateSkills,
    candidateLocation: "Ghaziabad, India",
    candidateLinkedIn: "https://www.linkedin.com/in/prashant-gupta-923885328",
    openToRelocate: "Yes",
    workAuthorization: "USA",
    candidateAvailability: "Immediate",
    totalExperience: "2 years",
    salary: KEYWORD_OPTIONS[0].profile.salary,
    candidatePhone: "+91-9838693305",
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
          addLog("✨ Resume ready. Upload a new resume to re-parse and auto-fill profile fields.", "success");
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

  // Poll server logs in real-time when automation is running
  useEffect(() => {
    if (!running || !runStartTimeRef.current) return;

    let intervalId = setInterval(async () => {
      try {
        const res = await api.getLogs();
        if (res.data && Array.isArray(res.data.logs)) {
          const lines = res.data.logs;
          
          lines.forEach((line) => {
            const match = line.match(/^\[(.*?)\]\s+(INFO|WARN|ERROR):\s+(.*)$/);
            if (match) {
              const [_, timeStr, level, msg] = match;
              // winston format YYYY-MM-DD HH:mm:ss is parsed correctly by Date constructor
              const logTime = new Date(timeStr.replace(/-/g, "/"));
              
              // Only process logs that occurred after the current automation run started
              if (logTime >= runStartTimeRef.current) {
                const logKey = `${timeStr}::${msg}`;
                if (!addedServerLogsRef.current.has(logKey)) {
                  addedServerLogsRef.current.add(logKey);
                  
                  let type = "info";
                  if (level === "ERROR" || msg.includes("❌")) type = "error";
                  else if (msg.includes("✅")) type = "success";
                  
                  const time = logTime.toLocaleTimeString();
                  setLogs((prev) => [...prev.slice(-80), { msg, type, time }]);
                }
              }
            }
          });
        }
      } catch (err) {
        console.error("Failed to poll server logs:", err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [running]);

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
    const isGenericWorkAuth = !config.workAuthorization || config.workAuthorization.toLowerCase() === "yes" || config.workAuthorization.toLowerCase() === "no";
    const loc = !isGenericWorkAuth ? config.workAuthorization : config.candidateLocation;
    return `Submission “SkillSet:${selectedKw.skillLabel}” Local to “${loc}”`;
  };

  const applyParsedProfile = (profile) => {
    if (!profile) return;
    
    // Sanitize parsed LinkedIn URL
    let parsedLI = profile.candidateLinkedIn ? profile.candidateLinkedIn.trim() : "";
    // Remove unwanted ending/beginning symbols like pipes or spaces
    parsedLI = parsedLI.replace(/^[|\s\-:\[\]\(\)]+|[|\s\-:\[\]\(\)]+$/g, "").trim();
    const isValidLI = parsedLI.toLowerCase().includes("linkedin.com") && parsedLI.length > 10;
    const cleanLI = isValidLI ? (parsedLI.startsWith("http") ? parsedLI : "https://" + parsedLI) : null;

    setConfig(p => ({
      ...p,
      ...(profile.candidateName     && { candidateName: profile.candidateName }),
      ...(profile.candidateTitle     && { candidateTitle: profile.candidateTitle }),
      ...(profile.candidatePhone     && { candidatePhone: profile.candidatePhone }),
      ...(profile.candidateEmailContact && { candidateEmailContact: profile.candidateEmailContact }),
      ...(cleanLI                    && { candidateLinkedIn: cleanLI }),
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
      
      // Auto-toggle off AI resume tailoring so the newly uploaded resume is sent as-is with no modifications
      setUseTailorResume(false);
      addLog(`📄 Resume uploaded. AI Resume tailoring automatically toggled OFF to send file exactly as-is.`, "info");

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
    runStartTimeRef.current = new Date();
    addedServerLogsRef.current.clear();
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
      const res = await api.linkedinSearch(config.selectedKeyword, parseInt(config.timeRange), config.candidateLocation, config.workAuthorization);
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
        profileUrl: j.profileUrl || "",
      }));

    const postsWithEmail = foundJobs.filter((j) => j.recruiterEmail).length;
    const postsNoEmail = foundJobs.length - postsWithEmail;
    addLog(`📊 Email coverage: ${postsWithEmail} posts have email, ${postsNoEmail} have no email, ${allSelectedRecruiters.length} unique recipients.`, "info");

    const recruiters = allSelectedRecruiters.slice(0, 1000);
    if (allSelectedRecruiters.length > 1000) {
      addLog(`⚠️ Selected ${allSelectedRecruiters.length} unique emails; only the first 1000 will be sent in this run.`, "error");
    }

    if (recruiters.length === 0) {
      addLog("No recruiter emails were found in the selected LinkedIn results. Try increasing the time range or waiting for more posts.", "error");
      await api.linkedinLogout();
      setRunning(false); setActiveStep(-1);
      return;
    }

    setActiveStep(3);

    addLog(`🚀 Sending ${recruiters.length} submission emails...`, "info");
    if (useTailorResume && resumeRawText) {
      addLog(`📄 AI will generate a SINGLE master tailored resume PDF for the ${selectedKw.skillLabel} role and send it to all`, "info");
    } else {
      addLog(`📄 Using original uploaded resume PDF exactly as-is (no AI tailoring)`, "info");
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
        useTailorResume,
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

  const runPortalApplyAutomation = async () => {
    if (!config.linkedinEmail || !config.linkedinPass) {
      addLog("Fill in LinkedIn credentials first.", "error");
      return;
    }
    
    runStartTimeRef.current = new Date();
    addedServerLogsRef.current.clear();
    setRunning(true); setCompletedSteps([]); setProgress(0);

    // Dynamically generate allowed titles based on the selected keyword
    const baseKeyword = config.selectedKeyword.split('+')[0].trim();
    const allowedTitles = [
      baseKeyword,
      "Software Engineer",
      "Developer",
      "Engineer",
      "Programmer",
      baseKeyword.replace("Developer", "Engineer"),
      baseKeyword.replace("Engineer", "Developer")
    ];

    const keywords = [config.selectedKeyword.split('+')[0].trim()]; // e.g. "JAVA DEVELOPER"
    
    setActiveStep(0);
    addLog("🔐 Launching browser (Playwright)...", "info");
    try {
      const res = await api.linkedinLogin(config.linkedinEmail, config.linkedinPass);
      if (!res.data.success) { addLog(`❌ ${res.data.message}`, "error"); setRunning(false); return; }
      addLog("✅ LinkedIn login successful!", "success");
      setCompletedSteps((p) => [...p, 1]); setProgress(33);
    } catch (err) { addLog(`❌ LinkedIn login error: ${err.message}`, "error"); setRunning(false); return; }

    setActiveStep(1);
    addLog(`🔍 Starting Portal Auto-Apply for Jobs matching: ${keywords.join(", ")}`, "info");
    addLog(`⚠️ Ensure your resume is uploaded so it can be filled in external forms.`, "info");
    try {
      // We pass candidate object, keywords, location, and allowed titles
      const candidateData = {
        firstName: config.candidateName.split(' ')[0],
        lastName: config.candidateName.split(' ').slice(1).join(' '),
        email: config.candidateEmailContact,
        phone: config.candidatePhone,
        resumePath: resumePath
      };
      
      const isGenericWorkAuth = !config.workAuthorization || config.workAuthorization.toLowerCase() === "yes" || config.workAuthorization.toLowerCase() === "no";
      const targetLocation = !isGenericWorkAuth ? config.workAuthorization : config.candidateLocation;

      const res = await api.linkedinAutoApply(
        candidateData,
        keywords,
        targetLocation,
        allowedTitles
      );
      
      if (res.data.success) {
        addLog(`✅ Portal auto-apply finished: ${res.data.message}`, "success");
      } else {
        addLog(`❌ Portal apply failed: ${res.data.message || res.data.error}`, "error");
      }
      setCompletedSteps((p) => [...p, 2]); setProgress(100);
    } catch (err) {
      addLog(`❌ Portal auto-apply error: ${err.message}`, "error");
    }

    setRunning(false); setActiveStep(-1);
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      
      {/* Header */}
      <div style={{ background: "rgba(13, 20, 35, 0.45)", borderBottom: `1px solid ${COLORS.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 60, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24, filter: "drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))" }}>🚀</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LinkedApply Pro</div>
            <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 1 }}>Premium Autopilot Client</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {[["Jobs Found", jobs.length, COLORS.accent], ["Emails Sent", emailsSent, COLORS.green], ["Progress", `${progress}%`, COLORS.accent2]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: c }}>{v}</div>
              <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps Indicators */}
      <div style={{ padding: "20px 28px 10px", display: "flex", gap: 12 }}>
        {steps.map((step, i) => {
          const done = completedSteps.includes(step.id);
          const active = activeStep === i && running;
          return (
            <div key={step.id} className={`step-pill ${active ? "active" : ""} ${done ? "done" : ""}`}>
              <div style={{ fontSize: 16 }}>
                {done ? "✅" : step.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: done ? COLORS.green : active ? COLORS.accent : COLORS.text }}>{step.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div style={{ padding: "10px 28px 18px" }}>
        <div style={{ background: "rgba(255,255,255,0.05)", height: 6, borderRadius: 3, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
          <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accent2})`, transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)", borderRadius: 3, boxShadow: `0 0 10px ${COLORS.accent}` }} />
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, padding: "0 28px 80px" }}>

        {/* LEFT PANEL (TABBED SETUP) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          
          {/* Responsive Glass Tabs Headers */}
          <div className="tabs-header">
            <button className={`tab-btn ${activeTab === "setup" ? "active" : ""}`} onClick={() => setActiveTab("setup")}>
              ⚙️ Setup & Search
            </button>
            <button className={`tab-btn ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")}>
              👤 Candidate Profile
            </button>
            <button className={`tab-btn ${activeTab === "resume" ? "active" : ""}`} onClick={() => setActiveTab("resume")}>
              📄 Resume & Tailoring
            </button>
          </div>

          {/* ACTIVE TAB: Setup */}
          {activeTab === "setup" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Sec title="🔐 Login Credentials">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {[
                    ["LinkedIn Email", "linkedinEmail", "email"],
                    ["LinkedIn Password", "linkedinPass", "password"],
                    ["Gmail Address", "gmailEmail", "email"],
                    ["Gmail App Password", "gmailPass", "password"]
                  ].map(([lbl, key, type]) => (
                    <div key={key}>
                      <Lbl>{lbl}</Lbl>
                      <input className="ifield" type={type} placeholder={lbl} value={config[key]} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: COLORS.yellow, background: "rgba(245, 158, 11, 0.05)", border: "1px dashed rgba(245, 158, 11, 0.25)", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                  <span>⚠️</span>
                  <span>Use Gmail App Password (not your primary password). Enable 2-Step Verification first.</span>
                </div>
              </Sec>

              <Sec title="🔍 Search Config">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {/* Keyword Dropdown */}
                  <div style={{ gridColumn: "1/-1" }} ref={dropdownRef}>
                    <Lbl>Keyword / Skill Set</Lbl>
                    <div className="kw-dropdown">
                      <div className={`kw-trigger ${keywordDropdownOpen ? "open" : ""}`} onClick={() => setKeywordDropdownOpen(!keywordDropdownOpen)}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, background: "rgba(99, 102, 241, 0.04)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 12px" }}>
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
                  </div>
                  <div>
                    <Lbl>Time Range</Lbl>
                    <select className="ifield" value={config.timeRange} onChange={e => setConfig(p => ({ ...p, timeRange: e.target.value }))}>
                      <option value="6">Last 6h</option>
                      <option value="12">Last 12h</option>
                      <option value="24">Last 24h</option>
                      <option value="72">Last 3 Days</option>
                      <option value="168">Last 1 Week</option>
                    </select>
                  </div>
                  <div>
                    <Lbl>Search In</Lbl>
                    <select className="ifield">
                      <option>LinkedIn Posts</option>
                      <option>LinkedIn Jobs</option>
                    </select>
                  </div>
                </div>
              </Sec>
            </div>
          )}

          {/* ACTIVE TAB: Profile */}
          {activeTab === "profile" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Sec title="👤 Candidate Profile Details">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {[
                    ["Full Name", "candidateName"],
                    ["Title / Role", "candidateTitle"],
                    ["Phone", "candidatePhone"],
                    ["Email", "candidateEmailContact"],
                    ["LinkedIn URL", "candidateLinkedIn"],
                    ["Current Location", "candidateLocation"],
                    ["Open to Relocate", "openToRelocate", "select", ["Yes", "No"]],
                    ["Work Authorization", "workAuthorization"],
                    ["Availability", "candidateAvailability"],
                    ["Total Experience", "totalExperience"],
                    ["Salary Expectation", "salary"],
                  ].map(([lbl, key, type, options]) => (
                    <div key={key} style={key === "candidateSkills" ? { gridColumn: "1/-1" } : {}}>
                      <Lbl>{lbl}</Lbl>
                      {type === "select" ? (
                        <select className="ifield" value={config[key]} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}>
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className="ifield" placeholder={lbl} value={config[key]} onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                  <div style={{ gridColumn: "1/-1" }}>
                    <Lbl>Education</Lbl>
                    <input className="ifield" placeholder="B.Tech CSE – University (Year) | CGPA: X.X" value={config.candidateEducation} onChange={e => setConfig(p => ({ ...p, candidateEducation: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <Lbl>Key Skills</Lbl>
                    <input className="ifield" placeholder="Python, SQL, Power BI, Tableau..." value={config.candidateSkills} onChange={e => setConfig(p => ({ ...p, candidateSkills: e.target.value }))} />
                  </div>
                </div>
              </Sec>
            </div>
          )}

          {/* ACTIVE TAB: Resume & Tailoring */}
          {activeTab === "resume" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Sec title="📄 Resume File Upload" extra={
                resumeParsing ? <span style={{ fontSize: 11, color: COLORS.accent, display: "flex", alignItems: "center", gap: 4 }}><span className="pulse-circle" />Parsing...</span>
                  : parsedProfile ? <span style={{ fontSize: 11, background: "rgba(16, 185, 129, 0.12)", color: COLORS.green, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>✨ AI Parsed</span>
                    : resumeAutoLoaded ? <span style={{ fontSize: 11, background: "rgba(99, 102, 241, 0.12)", color: COLORS.accent, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>📂 Auto-loaded</span>
                      : null
              }>
                {/* Auto-detected banner */}
                {resumeAutoLoaded && !parsedProfile && !resumeParsing && (
                  <div style={{ marginBottom: 10, background: "rgba(99, 102, 241, 0.05)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: COLORS.accent, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📂</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Using saved resume: {resumeName}</div>
                      <div style={{ color: COLORS.muted, marginTop: 1 }}>Upload a new file below to replace it and re-parse with AI</div>
                    </div>
                  </div>
                )}

                {/* Drop Zone */}
                <div
                  style={{ border: `2px dashed ${resumeName ? "rgba(16, 185, 129, 0.4)" : "rgba(99, 102, 241, 0.25)"}`, borderRadius: 10, padding: resumeParsing ? 14 : 16, textAlign: "center", cursor: resumeParsing ? "not-allowed" : "pointer", transition: "all 0.2s", background: resumeParsing ? "rgba(99, 102, 241, 0.03)" : "rgba(255,255,255,0.01)" }}
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
                  <div style={{ marginTop: 8, background: "rgba(244, 63, 94, 0.06)", border: `1px solid ${COLORS.red}33`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: COLORS.red }}>
                    ⚠️ {resumeParseError}
                  </div>
                )}

                {/* AI Extracted Profile Card */}
                {parsedProfile && (
                  <div style={{ marginTop: 10, background: "rgba(99, 102, 241, 0.03)", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px" }}>
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
                        <span key={i} style={{ background: "rgba(99, 102, 241, 0.12)", color: COLORS.accent, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 500 }}>{chip}</span>
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

              <Sec title="📧 Email & Tailoring Configuration">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 12 }}>
                  <div>
                    <Lbl>Team Lead Name</Lbl>
                    <input className="ifield" placeholder="Team Lead Full Name" value={config.teamLeadName} onChange={e => setConfig(p => ({ ...p, teamLeadName: e.target.value }))} />
                  </div>
                  <div>
                    <Lbl>Team Lead Email</Lbl>
                    <input className="ifield" placeholder="teamlead@gmail.com" value={config.teamLeadEmail} onChange={e => setConfig(p => ({ ...p, teamLeadEmail: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <Lbl>Auto Cc (Always included)</Lbl>
                    <div className="ifield" style={{ background: "rgba(255,255,255,0.02)", opacity: 0.7, cursor: "default", fontSize: 11.5, fontFamily: "monospace" }}>
                      {[config.candidateEmailContact, config.teamLeadEmail].filter(Boolean).join(" ; ") || "—"}
                    </div>
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <Lbl>Additional Cc (Optional)</Lbl>
                    <input className="ifield" placeholder="extra1@gmail.com; extra2@gmail.com" value={config.ccEmails} onChange={e => setConfig(p => ({ ...p, ccEmails: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <Lbl>Bcc (Optional)</Lbl>
                    <input className="ifield" placeholder="bcc@gmail.com" value={config.bccEmails} onChange={e => setConfig(p => ({ ...p, bccEmails: e.target.value }))} />
                  </div>
                </div>

                {/* AI Tailoring switches */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {/* Email Tailor Switch */}
                  <div
                    onClick={() => setUseTailoring(p => !p)}
                    className={`switch-container ${useTailoring ? "active" : ""}`}
                  >
                    <div className={`switch-track ${useTailoring ? "active" : ""}`}>
                      <div className={`switch-thumb ${useTailoring ? "active" : ""}`} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: useTailoring ? COLORS.accent : COLORS.text }}>
                        ✨ AI-Tailor Email Pitch
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                        Groq AI writes a custom candidate pitch for each recruiter's job post.
                      </div>
                    </div>
                    {useTailoring && (
                      <div style={{ fontSize: 10, background: COLORS.accent, color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>
                        ON
                      </div>
                    )}
                  </div>

                  {/* Resume Tailor Switch */}
                  <div
                    onClick={() => setUseTailorResume(p => !p)}
                    className={`switch-container ${useTailorResume ? "active" : ""}`}
                  >
                    <div className={`switch-track ${useTailorResume ? "active" : ""}`}>
                      <div className={`switch-thumb ${useTailorResume ? "active" : ""}`} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: useTailorResume ? COLORS.accent : COLORS.text }}>
                        ✨ AI-Tailor Resume PDF
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                        AI generates ONE master tailored PDF for the target role and sends it to everyone.
                      </div>
                    </div>
                    {useTailorResume ? (
                      <div style={{ fontSize: 10, background: COLORS.accent, color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>
                        ON
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", color: COLORS.muted, borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>
                        AS-IS
                      </div>
                    )}
                  </div>

                  {/* Preview controls */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      className="btn-sec"
                      onClick={handlePreviewResume}
                      style={{ flex: 1, padding: "10px 0", fontSize: 12.5 }}
                    >
                      📄 Preview Generated Resume PDF
                    </button>
                  </div>
                </div>
              </Sec>
            </div>
          )}
        </div>

        {/* RIGHT PANEL (AUTOPILOT PERSISTENT CONSOLE) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          
          <Sec title="💼 Jobs Found" extra={<span style={{ fontSize: 11, background: "rgba(99, 102, 241, 0.12)", color: COLORS.accent, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>Live Results</span>}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Selected ({selectedJobs.length}/{jobs.length})</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn-sec" style={{ padding: "4px 8px", fontSize: 10, borderRadius: 6, fontWeight: 700 }} onClick={() => setSelectedJobs(jobs.map(j => j.id))} disabled={jobs.length === 0}>Select All</button>
                <button className="btn-sec" style={{ padding: "4px 8px", fontSize: 10, borderRadius: 6, fontWeight: 700 }} onClick={() => setSelectedJobs([])} disabled={jobs.length === 0}>Clear All</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
              {jobs.length === 0 && <div style={{ color: COLORS.muted, fontSize: 12, textAlign: "center", padding: "40px 0" }}>Scraped recruiter posts will populate here after search runs</div>}
              {jobs.map(job => (
                <div key={job.id} style={{ background: "rgba(255,255,255,0.01)", borderRadius: 8, padding: "9px 11px", display: "flex", alignItems: "center", gap: 9, border: `1px solid ${job.status === "sent" ? "rgba(16, 185, 129, 0.25)" : job.status === "failed" ? "rgba(244, 63, 94, 0.25)" : COLORS.border}`, transition: "all 0.2s" }}>
                  <input type="checkbox" checked={selectedJobs.includes(job.id)} onChange={e => setSelectedJobs(p => e.target.checked ? [...p, job.id] : p.filter(i => i !== job.id))} style={{ accentColor: COLORS.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.postText?.substring(0, 55)}...</div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>{job.authorName}</div>
                    <div style={{ fontSize: 10, color: COLORS.accent2, fontFamily: "monospace" }}>{job.recruiterEmail || "No email detected"}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: job.status === "sent" ? COLORS.green : job.status === "failed" ? COLORS.red : COLORS.muted }}>
                      {job.status === "sent" ? "✅ Sent" : job.status === "failed" ? "❌ Failed" : "⏳ Pending"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Sec>

          <Sec title="📝 Email Format Preview">
            <div style={{ background: "rgba(2, 4, 10, 0.6)", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, fontSize: 12.5, lineHeight: 1.6, color: "#cbd5e1", maxHeight: 290, overflowY: "auto", fontFamily: "sans-serif" }}>
              <div style={{ borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 10, marginBottom: 12, fontSize: 11.5 }}>
                <div style={{ display: "flex", marginBottom: 5 }}><span style={{ color: COLORS.muted, width: 80, fontWeight: 700 }}>To:</span><span style={{ color: COLORS.text }}>[Recruiter Email]</span></div>
                <div style={{ display: "flex", marginBottom: 5 }}><span style={{ color: COLORS.muted, width: 80, fontWeight: 700 }}>Cc:</span><span style={{ color: COLORS.text }}>{[config.candidateEmailContact, config.teamLeadEmail].filter(Boolean).join(" ; ") || "—"}{config.ccEmails ? " ; " + config.ccEmails : ""}</span></div>
                <div style={{ display: "flex", marginBottom: 5 }}><span style={{ color: COLORS.muted, width: 80, fontWeight: 700 }}>Bcc:</span><span style={{ color: COLORS.text }}>{config.bccEmails || "—"}</span></div>
                <div style={{ display: "flex" }}><span style={{ color: COLORS.muted, width: 80, fontWeight: 700 }}>Subject:</span><span style={{ color: COLORS.accent2, fontWeight: 700 }}>{generateSubject()}</span></div>
              </div>
              <div>
                <div>Hi,</div>
                <div style={{ marginTop: 6 }}>Hope you are doing well.</div>
                <div style={{ marginTop: 6 }}>Kindly find attached resume and below details:</div>
                <div style={{ marginTop: 10, borderLeft: `2px solid ${COLORS.accent}`, paddingLeft: 12, background: "rgba(255,255,255,0.01)", borderRadius: "0 8px 8px 0" }}>
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
                    <div key={label} style={{ display: "grid", gridTemplateColumns: "160px 1fr", padding: "2px 0" }}>
                      <span style={{ color: COLORS.muted, fontWeight: 600 }}>{label}:</span>
                      <span style={{ color: COLORS.text }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>I am actively looking for Contract / C2C roles and am available to start immediately. I would love the opportunity to discuss how my background aligns with your requirements.</div>
                <div style={{ marginTop: 8 }}>Thank you for your time and consideration.</div>
                {/* Post Link before Regards */}
                <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10, fontSize: 11.5 }}>
                  <strong style={{ color: COLORS.muted }}>Post Link:</strong>{" "}
                  <span style={{ color: COLORS.accent2, fontStyle: "italic", fontFamily: "monospace" }}>[Recruiter's LinkedIn post URL]</span>
                </div>
                <div style={{ marginTop: 14 }}>Regards,</div>
                <div style={{ marginTop: 4, color: COLORS.accent, fontWeight: 700 }}>{candidate.name}</div>
              </div>
            </div>
          </Sec>

          <Sec title="📟 Activity Log Console">
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <div className="terminal-dot close" />
                  <div className="terminal-dot minimize" />
                  <div className="terminal-dot expand" />
                </div>
                <div className="terminal-title">linkedapply-autopilot:~</div>
                <div style={{ width: 42 }} />
              </div>
              <div className="terminal-body" ref={logRef}>
                {logs.length === 0 && <div style={{ color: COLORS.muted, fontStyle: "italic" }}>// Ready to run... logs will print here in real-time.</div>}
                {logs.map((log, i) => {
                  let logColor = COLORS.text;
                  if (log.type === "success") logColor = COLORS.green;
                  else if (log.type === "error") logColor = COLORS.red;
                  else if (log.msg.includes("🔐") || log.msg.includes("📧") || log.msg.includes("🔍") || log.msg.includes("🚀")) logColor = COLORS.accent2;
                  
                  return (
                    <div key={i} style={{ color: logColor, fontSize: 11.5, marginBottom: 2 }}>
                      <span style={{ color: "rgba(255,255,255,0.15)", marginRight: 8 }}>[{log.time}]</span>
                      <span>{log.msg}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Sec>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(13, 20, 35, 0.75)", borderTop: `1px solid ${COLORS.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: running ? COLORS.green : COLORS.muted, animation: "pulse-ring 1.5s infinite" }} />
          <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700 }}>
            {running ? "🤖 AUTOPILOT ACTIVE" : completedSteps.length === 4 ? "✅ AUTOMATION COMPLETE" : "SYSTEM STANDBY"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-sec" onClick={() => { setLogs([]); setProgress(0); setEmailsSent(0); setCompletedSteps([]); setActiveStep(0); setJobs([]); }} disabled={running}>Reset</button>
          <button className="btn-sec" onClick={runPortalApplyAutomation} disabled={running} style={{ border: `1px solid ${COLORS.accent}`}}>
            {running ? "Running..." : "Start Portal Apply Flow"}
          </button>
          <button className="btn-primary" onClick={runAutomation} disabled={running}>
            {running ? "Autopilot running..." : "Start Email Autoloop"}
          </button>
        </div>
      </div>

    </div>
  );
}

function Sec({ title, children, extra }) {
  return (
    <div className="sec-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: COLORS.text, letterSpacing: 0.3, textTransform: "uppercase" }}>{title}</div>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Lbl({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{children}</div>;
}
