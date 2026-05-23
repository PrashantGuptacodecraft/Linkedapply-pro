const { buildTailoredResumePDF } = require('./backend/src/utils/resumeTailor.js');

async function test() {
  try {
    const mockStructure = {
      name: "Prashant Gupta",
      email: "adityagupta983869@gmail.com",
      phone: "+91-9838693305",
      linkedIn: "https://www.linkedin.com/in/prashant-gupta-923885328/",
      education: "B.Tech CSE – KIET Group of Institutions (2024–2028) | SGPA: 8.0/10"
    };

    const jobDesc = "We are hiring a Web Developer with React and Node.js experience.";
    const role = "WEB DEVELOPER";

    console.log("Generating PDF...");
    const result = await buildTailoredResumePDF(mockStructure, jobDesc, "test_java_dev", role);
    console.log("PDF generated successfully at:", result.path);
  } catch (error) {
    console.error("Error generating PDF:", error);
  }
}

test();
