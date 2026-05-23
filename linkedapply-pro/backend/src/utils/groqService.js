// ============================================================
//  LinkedApply Pro — Groq AI Tailoring Service
//  File: backend/src/utils/groqService.js
//  Uses: Groq API (OpenAI-compatible) with Llama 3
// ============================================================

const https = require("https");
const logger = require("./logger");
const { getProjectsForRole, getSkillsForRole } = require("./projectBank");

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant"; // Fast, cheap, very capable, replaces decommissioned llama3-8b-8192

/**
 * Call Groq API and return the assistant message text.
 */
function callGroq(messages, maxTokens = 300) {
  return new Promise((resolve, reject) => {
    if (!GROQ_API_KEY) {
      return reject(new Error("GROQ_API_KEY not set"));
    }

    const body = JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.4,
    });

    const url = new URL(GROQ_API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(parsed.error.message || "Groq API error"));
          }
          const text = parsed.choices?.[0]?.message?.content?.trim() || "";
          resolve(text);
        } catch (e) {
          reject(new Error(`Groq parse error: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("Groq API request timed out"));
    });
    req.write(body);
    req.end();
  });
}

/**
 * Generate a tailored pitch for a specific job post.
 * targetRole: the selected keyword (e.g. "Data Analyst", "Java Developer").
 * Even with no job description, AI uses the role to filter skills & write a pitch.
 * Returns: { tailoredPitch: string, tailoredSkills: string }
 */
async function tailorForJob(candidate, jobDescription, targetRole) {
  const hasJobDesc = jobDescription && jobDescription.trim().length > 20;

  // Skip only when absolutely nothing to work with
  if (!hasJobDesc && !targetRole) {
    return { tailoredPitch: null, tailoredSkills: null };
  }

  const jobContext = hasJobDesc
    ? `JOB POST TEXT (from LinkedIn):
"""
${jobDescription.slice(0, 600)}
"""`
    : `(No specific job post text. Tailor based on the TARGET ROLE only.)`;

  const prompt = `You are an expert technical recruiter assistant helping a candidate tailor their job application email.

CANDIDATE PROFILE:
- Name: ${candidate.name}
- Title: ${candidate.title || ""}
- Skills: ${candidate.skills}
- Experience: ${candidate.totalExperience}
- Location: ${candidate.location}

TARGET ROLE: ${targetRole || "Software Developer"}

${jobContext}

DOMAIN ISOLATION RULES (STRICT — do NOT mix domains):
- If TARGET ROLE is "Java Developer" or "Full Stack Developer": use ONLY Java, Spring Boot, Microservices, REST APIs, Hibernate, JPA, Maven, Docker skills. Do NOT mention Python, Data Analysis, Power BI, Tableau, Pandas, EDA, Machine Learning.
- If TARGET ROLE is "Data Analyst" or "Python Data Analyst": use ONLY Python, SQL, Pandas, NumPy, Power BI, Tableau, Excel, EDA, Data Visualization, Matplotlib skills. Do NOT mention Java, Spring Boot, or backend frameworks.
- If TARGET ROLE is "Business Analyst": use ONLY SQL, Excel, Power BI, Tableau, Requirements Gathering, Process Mapping skills. Do NOT mention Java or Python ML.
- If TARGET ROLE is "Power BI Developer": use ONLY Power BI, DAX, Power Query, SQL, Excel, Data Modeling skills. Do NOT mention Java or Python ML.
- If TARGET ROLE is "MIS Executive": use ONLY Excel, SQL, Power BI, Data Reporting, MIS Reports skills.
- If TARGET ROLE is "SQL Analyst": use ONLY SQL, MySQL, Joins, Window Functions, Excel, Power BI skills.
- NEVER include a skill that does not belong to the TARGET ROLE's domain.

Your task: Write TWO things, separated by the delimiter "|||":
1. A single, concise paragraph (2-3 sentences) showing why this candidate fits the ${targetRole || "role"}. Mention only technologies relevant to the ${targetRole || "role"}. NEVER mention technologies from other domains.
2. A comma-separated list of 4-6 skills from the candidate that are MOST relevant to the ${targetRole || "role"}. Pick ONLY from the allowed domain above.

Format your response EXACTLY as:
<pitch paragraph> ||| <comma-separated skills>

Do NOT include any other text, labels, or explanations.`;

  try {
    const response = await callGroq([
      { role: "system", content: "You are a concise job application assistant. Always respond in the exact format requested." },
      { role: "user", content: prompt },
    ], 300);

    const parts = response.split("|||");
    const tailoredPitch = parts[0]?.trim() || null;
    const tailoredSkills = parts[1]?.trim() || null;

    logger.info(`[Groq] Tailored pitch generated for role "${targetRole || "unknown"}" (${tailoredPitch?.length || 0} chars)`);
    return { tailoredPitch, tailoredSkills };
  } catch (err) {
    logger.warn(`[Groq] Tailoring failed, using default content: ${err.message}`);
    return { tailoredPitch: null, tailoredSkills: null };
  }
}

/**
 * Extract structured resume data from raw resume text.
 * Returns: { name, title, phone, email, linkedIn, location, summary, skills[], projects[], experience[], education, certifications }
 */
async function extractResumeStructure(rawText) {
  const truncated = rawText.slice(0, 5000);

  const prompt = `You are a precise resume parser. Extract ALL structured sections from this resume text and return ONLY valid JSON — no markdown, no explanation.

RESUME TEXT:
"""
${truncated}
"""

Return this JSON structure exactly (use empty string or empty array if not found):
{
  "name": "Full candidate name",
  "title": "Current/most recent job title",
  "phone": "Phone number",
  "email": "Email address",
  "linkedIn": "LinkedIn URL if found",
  "location": "City, State or City, Country",
  "totalExperience": "e.g. 4 Years",
  "workAuthorization": "e.g. US Citizen, H1B, Authorized to work in India",
  "summary": "Professional summary from resume (or empty string)",
  "skills": ["skill1", "skill2", "skill3"],
  "projects": [
    { "name": "Project name", "description": "What it does, technologies used, your role" },
    { "name": "Project 2 name", "description": "..." }
  ],
  "experience": [
    { "company": "Company name", "role": "Job title", "duration": "Jan 2022 - Present", "points": ["achievement 1", "achievement 2"] }
  ],
  "education": "Degree, Field, University, Year",
  "certifications": ["Cert 1", "Cert 2"]
}

Return ONLY the JSON object, nothing else.`;

  try {
    const response = await callGroq([
      { role: "system", content: "You are a precise resume parser. Always respond with valid JSON only." },
      { role: "user", content: prompt },
    ], 1200);

    const cleaned = response.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    logger.info(`[Groq] Resume structure extracted: ${parsed.projects?.length || 0} projects, ${parsed.skills?.length || 0} skills`);
    return { success: true, structure: parsed };
  } catch (err) {
    logger.error(`[Groq] Resume structure extraction failed: ${err.message}`);
    return { success: false, structure: null };
  }
}

/**
 * Tailor resume structure for a role.
 * PROJECTS: Always 100% AI-generated for the target role (resume projects ignored).
 * SKILLS:   AI filters from resume skills to only role-relevant ones.
 * OBJECTIVE: AI writes a fresh career objective for the target role.
 */
async function tailorResumeForJob(resumeStructure, jobDescription, targetRole) {
  const hasJobDesc  = jobDescription && jobDescription.trim().length > 20;
  const skillsList  = Array.isArray(resumeStructure.skills) 
    ? resumeStructure.skills.join(", ") 
    : String(resumeStructure.skills || "");
  const role        = (targetRole || "Software Developer").replace(/ \+ C2C$/i, "").trim();

  const jobContext = hasJobDesc
    ? `JOB DESCRIPTION:\n"""\n${jobDescription.slice(0, 600)}\n"""`
    : `(No specific job description. Select skills strictly for a ${role} role.)`;

  // ── Step 1: AI picks role-relevant skills + writes career objective ──
  const skillsPrompt = `You are a resume tailoring assistant.\n\nCANDIDATE:\n- Name: ${resumeStructure.name || ""}\n- Title: ${resumeStructure.title || ""}\n- Experience: ${resumeStructure.totalExperience || ""}\n- All Skills: ${skillsList}\n\nTARGET ROLE: ${role}\n\n${jobContext}\n\nDOMAIN RULES — include ONLY skills matching this role:\n- Java Developer      : Java, Spring Boot, Spring MVC, REST API, Hibernate, JPA, MySQL, Maven, Docker, JUnit
- Data Analyst        : Python, SQL, Pandas, NumPy, Matplotlib, Seaborn, Power BI, Tableau, Excel, EDA, Scikit-learn
- Business Analyst    : SQL, Excel, Power BI, Tableau, Requirements Gathering, Process Mapping
- Project Manager     : Agile, Scrum, Jira, Sprint Planning, Stakeholder Management, Risk Management, Team Leadership, SDLC
- Power BI Developer  : Power BI, DAX, Power Query, SQL, Excel, Data Modeling, KPI Dashboards
- MIS Executive       : Excel, SQL, Power BI, MIS Reports, Data Reporting, Google Sheets
- Python Developer    : Python, Django, Flask, REST API, MySQL, SQLite, Git
- Full Stack Developer: Java, Spring Boot, React.js, JavaScript, HTML, CSS, MySQL, REST API
- SQL Analyst         : SQL, MySQL, PostgreSQL, Joins, Window Functions, Aggregations, Excel, Power BI
- Frontend Developer  : React.js, JavaScript, TypeScript, HTML5, CSS3, Tailwind CSS, Bootstrap, Redux, UI/UX
- Web Developer       : HTML, CSS, JavaScript, React.js, Node.js, Express, MongoDB, PHP, Web Architecture\n\nReturn ONLY valid JSON, nothing else:\n{\n  "careerObjective": "2-3 sentence career objective for ${role} using role-specific technologies only.",\n  "relevantSkills": ["only skills from candidate list that match ${role} domain — max 10"]\n}`;

  let careerObjective = resumeStructure.summary || "";
  let relevantSkills  = resumeStructure.skills  || [];

  const hardcodedSkills = getSkillsForRole(role);
  if (hardcodedSkills) {
    relevantSkills = hardcodedSkills;
    logger.info(`[Groq] Using exact hardcoded skills for "${role}"`);
  } else {
    try {
      const resp    = await callGroq([
        { role: "system", content: "You are a precise resume tailoring assistant. Always respond with valid JSON only." },
        { role: "user",   content: skillsPrompt },
      ], 400);
      const cleaned = resp.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
      const parsed  = JSON.parse(cleaned);
      if (parsed.careerObjective)                                                    careerObjective = parsed.careerObjective;
      if (Array.isArray(parsed.relevantSkills) && parsed.relevantSkills.length > 0) relevantSkills  = parsed.relevantSkills;
      logger.info(`[Groq] Skills tailored for "${role}": ${relevantSkills.length} selected`);
    } catch (err) {
      logger.warn(`[Groq] Skills step failed: ${err.message} — using original skills`);
    }
  }

  // ── Step 2: Pick projects from curated bank (or AI-generate if no bank) ──
  const bankProjects = getProjectsForRole(role);
  let finalProjects;

  if (bankProjects.length > 0) {
    // Role has a curated bank — AI picks best 3 based on job description
    logger.info(`[Groq] Bank found for "${role}" (${bankProjects.length} projects) — AI selecting best 3...`);
    finalProjects = await selectProjectsFromBank(bankProjects, role, jobDescription, 3);
  } else {
    // No bank for this role — fall back to AI generation
    logger.info(`[Groq] No bank for "${role}" — generating 3 AI projects...`);
    finalProjects = await generateProjectsForRole(role, resumeStructure.name || "Candidate", relevantSkills, 3);
  }

  logger.info(`[Groq] Done — ${finalProjects.length} projects, ${relevantSkills.length} skills for "${role}"`);
  return {
    careerObjective,
    relevantSkills,
    relevantProjects:   finalProjects,
    relevantExperience: resumeStructure.experience || [],
  };
}

// ─────────────────────────────────────────────────────────────
//  selectProjectsFromBank
//
//  Given the curated bank for a role, Groq AI picks the 3 most
//  relevant projects based on the job description.
//  If no job description, returns all 3 (bank already has exactly 3).
//  Returns: Array of project objects (with aiGenerated:false)
// ─────────────────────────────────────────────────────────────
async function selectProjectsFromBank(bankProjects, role, jobDescription, count = 3) {
  // If bank has exactly count or fewer, return all of them directly
  if (bankProjects.length <= count || !jobDescription || jobDescription.trim().length < 20) {
    return bankProjects.slice(0, count).map(p => ({ ...p, aiGenerated: false }));
  }

  // Job description exists + bank has more than `count` projects — ask AI to rank
  const projectList = bankProjects.map((p, i) => `${i}. ${p.name}\n   ${p.description}`).join("\n\n");
  const prompt = `You are a resume tailoring assistant. Given a list of projects and a job description, select the ${count} most relevant project indexes.

TARGET ROLE: ${role}

JOB DESCRIPTION:
"""
${jobDescription.slice(0, 500)}
"""

AVAILABLE PROJECTS (0-indexed):
${projectList}

Return ONLY a valid JSON array of ${count} indexes (0-based), ordered by relevance. Example: [0, 2, 1]
Return ONLY the JSON array, nothing else.`;

  try {
    const resp    = await callGroq([
      { role: "system", content: "You are a precise resume tailoring assistant. Always respond with a JSON array only." },
      { role: "user",   content: prompt },
    ], 80);
    const cleaned = resp.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
    const indexes = JSON.parse(cleaned);
    if (Array.isArray(indexes) && indexes.length > 0) {
      const picked = indexes.slice(0, count).map(i => bankProjects[i]).filter(Boolean);
      if (picked.length === count) {
        logger.info(`[Groq] AI picked bank projects: indexes [${indexes.slice(0, count).join(", ")}]`);
        return picked.map(p => ({ ...p, aiGenerated: false }));
      }
    }
  } catch (err) {
    logger.warn(`[Groq] Bank selection failed: ${err.message} — returning all bank projects`);
  }

  // Fallback: return first `count` from bank
  return bankProjects.slice(0, count).map(p => ({ ...p, aiGenerated: false }));
}

// ─────────────────────────────────────────────────────────────
//  generateProjectsForRole
//
//  Generates `count` realistic fresher-level projects for the
//  given role using Groq AI. Called when the resume has fewer
//  than MIN_PROJECTS (3) matching projects for a role.
//
//  Returns: Array of { name, description, aiGenerated:true }
// ─────────────────────────────────────────────────────────────
async function generateProjectsForRole(targetRole, candidateName, skills, count = 3) {
  const skillsStr = Array.isArray(skills) ? skills.slice(0, 8).join(", ") : String(skills || "");
  const countWord = count === 1 ? "1" : count === 2 ? "2" : "3";

  // Build example JSON template dynamically based on count
  const exampleItems = Array.from({ length: count }, (_, i) => `  {
    "name": "Project ${i + 1} Name [Tech1, Tech2, Tech3]",
    "description": "What the project does, what was built, key features and technologies used."
  }`).join(",\n");

  const prompt = `You are a professional resume writer. Generate exactly ${countWord} realistic, believable project(s) for a fresher-level "${targetRole}" candidate.

CANDIDATE: ${candidateName}
TARGET ROLE: ${targetRole}
AVAILABLE SKILLS: ${skillsStr}

Each project must:
- Be realistic for a B.Tech student / fresher applying for "${targetRole}"
- Be DIFFERENT from each other (unique project names and ideas)
- Use ONLY technologies appropriate for "${targetRole}" — strictly no cross-domain tech
- Have a clear, professional project name with the tech stack in square brackets
- Have a concise description (2-3 sentences) covering: what the project does, technologies used, and key features built

DOMAIN RULES — use ONLY these technologies per role:
- Java Developer      → Java, Spring Boot, Spring MVC, REST API, Hibernate, JPA, MySQL, Maven, JUnit
- Data Analyst        → Python, Pandas, NumPy, Matplotlib, Seaborn, SQL, Power BI, Tableau, EDA, Scikit-learn
- Business Analyst    → Excel, SQL, Power BI, Tableau, Data Reporting, Requirements, Process Mapping
- Project Manager     → Agile, Scrum, Jira, Sprint Planning, Stakeholder Management, Risk Management, Team Leadership
- Power BI Developer  → Power BI, DAX, Power Query, SQL, Excel, Data Modeling, KPI Dashboards
- MIS Executive       → Excel (VLOOKUP, Pivot), SQL, Power BI, MIS Reports, Google Sheets
- Python Developer    → Python, Django, Flask, REST API, MySQL, SQLite, Git, HTML basics
- Full Stack Developer→ Java, Spring Boot, React.js, JavaScript, HTML, CSS, MySQL, REST API
- SQL Analyst         → SQL, MySQL, PostgreSQL, Joins, Window Functions, Aggregations, Excel, Power BI
- Frontend Developer  → React.js, JavaScript, TypeScript, HTML5, CSS3, Tailwind CSS, Bootstrap, Redux, UI/UX
- Web Developer       → HTML, CSS, JavaScript, React.js, Node.js, Express, MongoDB, PHP, Web Architecture

Return ONLY a valid JSON array with exactly ${countWord} object(s) — no markdown, no explanation:
[
${exampleItems}
]`;

  try {
    const response = await callGroq([
      { role: "system", content: "You are a professional resume writer. Always respond with valid JSON only." },
      { role: "user", content: prompt },
    ], count * 220);

    const cleaned = response.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
    const projects = JSON.parse(cleaned);

    if (Array.isArray(projects) && projects.length > 0) {
      // Trim to exactly `count` and mark as AI-generated
      return projects.slice(0, count).map(p => ({ ...p, aiGenerated: true }));
    }
    return [];
  } catch (err) {
    logger.error(`[Groq] Project generation failed for "${targetRole}": ${err.message}`);
    return [];
  }
}

module.exports = { tailorForJob, callGroq, extractResumeStructure, tailorResumeForJob, generateProjectsForRole };
