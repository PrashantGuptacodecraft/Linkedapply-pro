/**
 * End-to-end test of the full pipeline:
 * 1. buildTailoredResumePDF for each role => verify skills + projects in output
 * 2. Verify postUrl flows through email body
 */
const path = require("path");
try { require("dotenv").config({ path: path.resolve(__dirname, "backend/.env") }); } catch(e) { /* dotenv not at root, that's fine */ }

const { buildTailoredResumePDF } = require("./backend/src/utils/resumeTailor");
const { buildEmailBody, buildPlainTextFallback } = require("./backend/src/gmail/gmailService");

const ROLES = ["JAVA DEVELOPER", "BUSINESS ANALYST", "DATA ANALYST", "FRONTEND DEVELOPER", "WEB DEVELOPER"];

const testCandidate = {
  name: "Prashant Gupta",
  email: "adityagupta983869@gmail.com",
  phone: "+91-9838693305",
  linkedIn: "https://www.linkedin.com/in/prashant-gupta-923885328/",
  location: "Remote/USA",
  openToRelocate: "Yes",
  workAuthorization: "",
  availability: "Immediate",
  totalExperience: "",
  salary: "As per company norms",
  title: "Java Developer",
  skills: "Java, Spring Boot",
  education: "B.Tech CSE",
};

const testResumeStructure = {
  name: testCandidate.name,
  email: testCandidate.email,
  phone: testCandidate.phone,
  linkedIn: testCandidate.linkedIn,
  location: testCandidate.location,
  summary: "",
  skills: testCandidate.skills,
  experience: [],
  education: [{ degree: testCandidate.education, institution: "" }],
};

async function testPDFGeneration() {
  console.log("=== TESTING PDF GENERATION FOR ALL ROLES ===\n");
  
  for (const role of ROLES) {
    console.log(`\n--- Testing: ${role} ---`);
    try {
      const result = await buildTailoredResumePDF(testResumeStructure, "Sample job", `test_${role.replace(/ /g, "_")}`, role);
      
      if (!result.success) {
        console.log(`  ❌ FAILED: PDF generation returned success=false`);
        continue;
      }
      
      const projects = result.relevantProjects || [];
      console.log(`  ✅ PDF generated: ${result.filename}`);
      console.log(`  📁 Projects: ${projects.length}`);
      projects.forEach((p, i) => {
        console.log(`    ${i+1}. ${p.name} [${p.techStack || "no tech stack"}]`);
        console.log(`       Description: ${(p.description || "").substring(0, 80)}...`);
      });
      
      if (projects.length === 0) {
        console.log(`  ⚠️  WARNING: No projects for ${role}!`);
      }
    } catch (err) {
      console.log(`  ❌ ERROR: ${err.message}`);
    }
  }
}

function testEmailBody() {
  console.log("\n\n=== TESTING EMAIL BODY WITH POST URL ===\n");
  
  const postUrl = "https://www.linkedin.com/feed/update/urn:li:activity:1234567890";
  const teamLeadEmail = "teamlead@example.com";
  
  const htmlBody = buildEmailBody(testCandidate, "Sample job description", postUrl, teamLeadEmail, null, null, []);
  const plainBody = buildPlainTextFallback(testCandidate, "Sample job description", postUrl, teamLeadEmail, null, null, []);
  
  // Check if postUrl is in the email
  const hasPostUrlInHtml = htmlBody.includes(postUrl);
  const hasPostUrlInPlain = plainBody.includes(postUrl);
  
  console.log(`  HTML body contains postUrl: ${hasPostUrlInHtml ? "✅ YES" : "❌ NO"}`);
  console.log(`  Plain body contains postUrl: ${hasPostUrlInPlain ? "✅ YES" : "❌ NO"}`);
  
  // Check that candidate details are present
  const hasName = htmlBody.includes(testCandidate.name);
  const hasEmail = htmlBody.includes(testCandidate.email);
  const hasPhone = htmlBody.includes(testCandidate.phone);
  const hasLinkedIn = htmlBody.includes(testCandidate.linkedIn);
  
  console.log(`  Has candidate name: ${hasName ? "✅" : "❌"}`);
  console.log(`  Has candidate email: ${hasEmail ? "✅" : "❌"}`);
  console.log(`  Has candidate phone: ${hasPhone ? "✅" : "❌"}`);
  console.log(`  Has candidate LinkedIn: ${hasLinkedIn ? "✅" : "❌"}`);
  console.log(`  Has team lead email: ${htmlBody.includes(teamLeadEmail) ? "✅" : "❌"}`);
  console.log(`  Has "Job description link as per linkedin post": ${htmlBody.includes("Job description  link as per linkedin post") ? "✅" : "❌"}`);
  
  // Print the relevant snippet
  const postSnippetIdx = htmlBody.indexOf("Job description");
  if (postSnippetIdx >= 0) {
    console.log(`\n  Post URL snippet (HTML):\n  ${htmlBody.substring(postSnippetIdx, postSnippetIdx + 200)}`);
  }
}

(async () => {
  await testPDFGeneration();
  testEmailBody();
  console.log("\n=== ALL TESTS COMPLETE ===");
})();
