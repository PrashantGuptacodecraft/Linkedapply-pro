// ============================================================
//  LinkedApply Pro — Curated Project Bank
//  File: backend/src/utils/projectBank.js
//
//  Each role maps to an array of real, hand-crafted projects.
//  Groq AI picks the most relevant ones from this bank based
//  on the job description. No random generation for these roles.
//
//  To add more roles or projects, just follow the same format.
// ============================================================

const PROJECT_BANK = {

  // ── Java Developer ────────────────────────────────────────────
  "JAVA DEVELOPER": [
    {
      name: "Eventra – Event and Task Management Portal",
      techStack: "Java, Spring Boot, MySQL, REST APIs, React.js",
      description: "Developed an event and task management system for managing college events, tasks, users, and registrations. Created REST APIs for user authentication, event creation, task assignment, and dashboard data. Implemented role-based access for Admin and User modules. Used MySQL database to store users, events, tasks, and participation records.",
      tags: ["spring boot", "rest api", "mysql", "java", "react"],
    },
    {
      name: "Online Grocery Management System",
      techStack: "Java, Spring Boot, Hibernate, MySQL, HTML/CSS",
      description: "Built a grocery management system with product listing, cart management, order placement, and admin inventory control. Implemented CRUD operations for products, categories, customers, and orders. Used Hibernate/JPA for database interaction and MySQL for data storage. Added validation and error handling for smooth user experience.",
      tags: ["hibernate", "jpa", "mysql", "spring boot", "crud"],
    },
    {
      name: "Employee Management System",
      techStack: "Java, Spring Boot, MySQL, REST API",
      description: "Developed an employee management application to add, update, delete, and search employee records. Designed RESTful APIs for employee, department, and salary management. Implemented backend validation and exception handling. Improved data management using layered architecture: Controller, Service, Repository.",
      tags: ["rest api", "spring boot", "mysql", "employee", "layered architecture"],
    },
  ],

  // ── Business Analyst ─────────────────────────────────────────
  "BUSINESS ANALYST": [
    {
      name: "CRM Requirement Analysis for Shopify Integration",
      techStack: "MS Excel, Google Docs, Draw.io, CRM Platform",
      description: "Analyzed CRM modules such as leads, contacts, pipelines, campaigns, automation, and settings. Prepared a technical recommendation document for Shopify and CRM integration. Created workflow for customer, order, product, payment, abandoned cart, and refund sync. Suggested webhook, duplicate handling, retry mechanism, and security requirements.",
      tags: ["crm", "requirement analysis", "shopify", "workflow", "documentation"],
    },
    {
      name: "Sales Pipeline Analysis Dashboard",
      techStack: "Excel, Power BI, SQL",
      description: "Analyzed sales pipeline data to track leads, deal stages, conversion rate, and revenue. Created dashboard showing lead status, sales performance, and monthly target achievement. Identified bottlenecks in the sales process and suggested improvement areas. Prepared business insights for better lead nurturing and follow-up planning.",
      tags: ["sales", "pipeline", "power bi", "sql", "excel", "kpi"],
    },
    {
      name: "Customer Feedback and Retention Analysis",
      techStack: "Excel, Power BI, Google Forms",
      description: "Collected and analyzed customer feedback data to identify satisfaction level and pain points. Segmented customers based on feedback score, purchase behavior, and retention risk. Suggested automated follow-up actions for inactive and dissatisfied customers. Created report to improve customer retention and marketing campaigns.",
      tags: ["customer", "feedback", "retention", "segmentation", "power bi"],
    },
  ],

  // ── Data Analyst ──────────────────────────────────────────────
  "DATA ANALYST": [
    {
      name: "Vehicle Speed Prediction and Analysis",
      techStack: "Python, Pandas, NumPy, Matplotlib, Scikit-learn",
      description: "Cleaned and preprocessed vehicle speed dataset by handling missing values, negative speeds, and outliers. Performed feature engineering using lag features, rolling mean, rolling standard deviation, and speed difference. Built a Random Forest Regression model to predict true vehicle speed. Evaluated model performance using RMSE and R² score.",
      tags: ["python", "machine learning", "pandas", "scikit-learn", "regression", "eda"],
    },
    {
      name: "Sales Data Analysis Dashboard",
      techStack: "Python, Excel, Power BI, SQL",
      description: "Analyzed sales data to identify revenue trends, top-selling products, and region-wise performance. Cleaned raw data using Excel/Pandas and performed exploratory data analysis. Created interactive Power BI dashboard with KPIs, charts, slicers, and filters. Generated insights to improve sales strategy and business decision-making.",
      tags: ["power bi", "sql", "python", "pandas", "dashboard", "eda", "excel"],
    },
    {
      name: "Employee Attrition Analysis",
      techStack: "Python, Pandas, Power BI, Machine Learning",
      description: "Analyzed employee data to identify factors affecting attrition such as salary, department, age, and experience. Performed data cleaning, encoding, visualization, and correlation analysis. Built classification models to predict employee attrition risk. Created dashboard to help HR teams understand retention challenges.",
      tags: ["python", "machine learning", "power bi", "pandas", "classification", "hr analytics"],
    },
  ],

  // ── Power BI Developer ────────────────────────────────────────
  "POWER BI DEVELOPER": [
    {
      name: "Sales Data Analysis Dashboard [Power BI, SQL, Excel]",
      description: "Analyzed sales data to identify revenue trends, top-selling products, and region-wise performance. Designed an interactive Power BI dashboard with KPIs, slicers, and drill-through reports. Used DAX measures and Power Query transformations for dynamic data modeling and real-time insights.",
      tags: ["power bi", "dax", "sql", "excel", "kpi", "dashboard"],
    },
    {
      name: "Employee Attrition Dashboard [Power BI, DAX, Power Query]",
      description: "Built an HR analytics dashboard to visualize employee attrition trends by department, salary band, and tenure. Used Power Query for ETL and DAX for calculated measures including attrition rate, headcount, and retention score. Published interactive report with drill-down capabilities for HR leadership.",
      tags: ["power bi", "dax", "power query", "hr", "dashboard"],
    },
    {
      name: "Sales Pipeline KPI Tracker [Power BI, SQL, Excel]",
      description: "Developed a sales pipeline tracker dashboard showing lead stage, conversion rate, and monthly revenue achievement. Wrote SQL queries to extract and aggregate pipeline data, then modeled it in Power BI with relationship mapping. Designed intuitive visuals with filters and bookmarks for executive-level reporting.",
      tags: ["power bi", "sql", "kpi", "sales", "pipeline", "excel"],
    },
  ],

  // ── MIS Executive ─────────────────────────────────────────────
  "MIS EXECUTIVE": [
    {
      name: "Monthly Sales MIS Report [Excel, SQL, Power BI]",
      description: "Prepared monthly MIS reports tracking sales performance, order fulfillment, and revenue KPIs across departments. Used SQL queries to extract data from the database and Excel pivot tables and VLOOKUP for data consolidation. Created automated Excel dashboards with conditional formatting and charts for management review.",
      tags: ["mis", "excel", "sql", "pivot", "reporting", "vlookup"],
    },
    {
      name: "Inventory and Stock MIS Dashboard [Excel, Power BI, SQL]",
      description: "Built an inventory management MIS dashboard to track stock levels, reorder points, and supplier performance. Automated data extraction using SQL queries and consolidated reports in Excel using VLOOKUP, XLOOKUP, and Pivot Tables. Designed Power BI visuals for real-time inventory monitoring.",
      tags: ["inventory", "mis", "excel", "power bi", "sql", "dashboard"],
    },
    {
      name: "Employee Attendance and Payroll MIS [Excel, Google Sheets, SQL]",
      description: "Developed an employee attendance tracking and payroll MIS report for a mid-size organization. Consolidated attendance data from multiple sources using Excel VLOOKUP, SUMIF, and Pivot Tables. Automated payroll computation with Excel formulas and generated monthly summary reports for HR and management.",
      tags: ["attendance", "payroll", "mis", "excel", "vlookup", "google sheets"],
    },
  ],

  // ── SQL Analyst ───────────────────────────────────────────────
  "SQL ANALYST": [
    {
      name: "Sales Data Analysis using SQL [MySQL, SQL, Excel]",
      description: "Performed end-to-end sales data analysis using complex SQL queries including Joins, Aggregations, Subqueries, and Window Functions. Extracted insights on top-performing products, regional revenue trends, and monthly growth rates. Exported results to Excel for visualization and stakeholder reporting.",
      tags: ["sql", "mysql", "joins", "window functions", "aggregations", "excel"],
    },
    {
      name: "Customer Segmentation using SQL [MySQL, PostgreSQL, Power BI]",
      description: "Segmented customers by purchase frequency, average order value, and recency using SQL CTEs and Window Functions. Used GROUP BY, HAVING, and ranking functions to identify top-tier and churned customers. Visualized segmentation results in Power BI for marketing team analysis.",
      tags: ["sql", "mysql", "segmentation", "power bi", "cte", "window functions"],
    },
    {
      name: "Employee Data Analysis using SQL [MySQL, SQL, Excel]",
      description: "Analyzed employee records to compute department-wise salary statistics, attrition count, and tenure distribution. Wrote optimized SQL queries using subqueries, aggregate functions, and self-joins for complex reporting. Delivered formatted Excel reports for HR review and headcount planning.",
      tags: ["sql", "mysql", "employee", "joins", "subqueries", "excel"],
    },
  ],

  // ── Frontend Developer ─────────────────────────────────────────
  "FRONTEND DEVELOPER": [
    {
      name: "E-Commerce Web Application [React.js, Redux, Tailwind CSS]",
      description: "Developed a responsive e-commerce platform with product browsing, cart management, and secure checkout flow. Managed complex application state using Redux Toolkit for seamless user experience across components. Implemented modern, mobile-first UI using Tailwind CSS, ensuring cross-browser compatibility.",
      tags: ["react", "redux", "tailwind css", "frontend", "e-commerce"],
    },
    {
      name: "Interactive Task Management Dashboard [React.js, Context API, CSS3]",
      description: "Built a drag-and-drop task management dashboard allowing users to organize daily activities into customizable columns. Utilized React Context API for lightweight global state management and custom hooks for business logic. Designed a clean, intuitive glassmorphic user interface with smooth CSS transitions and animations.",
      tags: ["react", "context api", "css3", "dashboard", "ui/ux"],
    },
    {
      name: "Weather Forecasting PWA [HTML5, JavaScript, REST API]",
      description: "Created a Progressive Web App (PWA) that fetches real-time weather data and 5-day forecasts from the OpenWeatherMap API. Implemented geolocation features to automatically display local weather conditions. Optimized performance with service workers for offline caching and achieved a 98+ Lighthouse score.",
      tags: ["javascript", "html5", "rest api", "pwa", "performance"],
    },
  ],

  // ── Web Developer ─────────────────────────────────────────────
  "WEB DEVELOPER": [
    {
      name: "Full-Stack Blogging Platform [Node.js, Express, MongoDB, React]",
      description: "Developed a MERN stack blogging platform supporting user authentication, post creation, and commenting. Designed RESTful APIs with Express and Node.js, storing user data and articles securely in MongoDB. Built a responsive frontend with React, integrating JWT-based session management.",
      tags: ["mern", "node.js", "express", "mongodb", "react", "full-stack"],
    },
    {
      name: "Corporate Portfolio Website [HTML5, CSS3, JavaScript, Bootstrap]",
      description: "Designed and developed a responsive, multi-page corporate portfolio website for a local business. Used Bootstrap 5 to implement a mobile-first grid layout, contact forms, and interactive service carousels. Ensured high SEO rankings through semantic HTML structure and optimized asset loading.",
      tags: ["html", "css", "javascript", "bootstrap", "responsive design", "seo"],
    },
    {
      name: "Restaurant Booking System [JavaScript, PHP, MySQL, CSS]",
      description: "Built a web-based reservation system allowing customers to book tables and view menus online. Created a custom admin dashboard for staff to manage reservations, update menu items, and track daily capacity. Integrated a relational MySQL database for robust data handling and real-time availability checking.",
      tags: ["javascript", "php", "mysql", "web development", "backend"],
    },
  ],

  // ── Project Manager ───────────────────────────────────────────
  "PROJECT MANAGER": [
    {
      name: "Enterprise ERP Implementation [Agile, Jira, Confluence, MS Project]",
      description: "Managed the end-to-end implementation of an enterprise ERP system across 3 departments using Agile methodologies. Facilitated sprint planning, daily stand-ups, and retrospective meetings to ensure timely delivery. Tracked project budget, managed risks, and communicated progress to executive stakeholders.",
      tags: ["agile", "jira", "erp", "project management", "scrum"],
    },
    {
      name: "E-Commerce Platform Migration [Scrum, Jira, Risk Management]",
      description: "Led a cross-functional team of developers and QA engineers to migrate a legacy e-commerce platform to a modern cloud infrastructure. Created and maintained the product backlog, aligning technical deliverables with business goals. Successfully mitigated deployment risks and delivered the project 2 weeks ahead of schedule.",
      tags: ["scrum", "migration", "cloud", "stakeholder management"],
    },
    {
      name: "Mobile App Development Lifecycle [SDLC, Kanban, Trello]",
      description: "Oversaw the full Software Development Life Cycle (SDLC) for a customer-facing mobile application from conception to launch. Utilized Kanban boards to optimize workflow and reduce bottleneck issues in the testing phase. Coordinated between design, development, and marketing teams to ensure a unified product vision.",
      tags: ["sdlc", "kanban", "mobile app", "cross-functional", "leadership"],
    },
  ],

};

// ── Role aliases — maps keyword values to bank keys ──────────
const ROLE_ALIASES = {
  "JAVA DEVELOPER":         "JAVA DEVELOPER",
  "JAVA DEVELOPER + C2C":   "JAVA DEVELOPER",
  "DATA ANALYST":           "DATA ANALYST",
  "DATA ANALYST + C2C":     "DATA ANALYST",
  "BUSINESS ANALYST":       "BUSINESS ANALYST",
  "BUSINESS ANALYST + C2C": "BUSINESS ANALYST",
  "PROJECT MANAGER":        "PROJECT MANAGER",
  "PROJECT MANAGER + C2C":  "PROJECT MANAGER",
  "FRONTEND DEVELOPER":     "FRONTEND DEVELOPER",
  "WEB DEVELOPER":          "WEB DEVELOPER",
  // Old aliases just in case
  "FULL STACK DEVELOPER":   "JAVA DEVELOPER",
  "PYTHON DATA ANALYST":    "DATA ANALYST",
  "JUNIOR DATA ANALYST":    "DATA ANALYST",
  "DATA VISUALIZATION ANALYST": "DATA ANALYST",
  "POWER BI DEVELOPER":     "POWER BI DEVELOPER",
  "MIS EXECUTIVE":          "MIS EXECUTIVE",
  "SQL ANALYST":            "SQL ANALYST",
};

/**
 * Get projects from the bank for a given role keyword.
 * Returns the array of projects, or [] if role not in bank.
 */
function getProjectsForRole(roleKeyword) {
  const key = ROLE_ALIASES[(roleKeyword || "").toUpperCase()] || (roleKeyword || "").toUpperCase();
  return PROJECT_BANK[key] || [];
}

module.exports = { PROJECT_BANK, ROLE_ALIASES, getProjectsForRole };
