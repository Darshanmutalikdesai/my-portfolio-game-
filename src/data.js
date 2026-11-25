// ====== EDIT YOUR CONTENT HERE ======
export const PROFILE = {
  name: 'DARSHAN MUTALIKDESAI',
  role: 'Frontend Developer · Full-Stack',
  fallbackUrl: 'https://darshanmutalikdesai.dev/',
  // opening title card (style inspired by retro-neon game logos, but with your own words)
  welcome: 'WELCOME TO',
  gameTitle: ['grand', 'theft', 'portfolio'],   // 3 stacked lines
  initials: 'DM',                               // giant gradient letters behind the title
}

// ZONES are the story chapters, IN MISSION ORDER (the player unlocks them one by one).
//   marker  = the glowing ring you drive / walk into (press E to read once unlocked)
//   bld     = building centre, size = [w, h, d]
//   mission = what the player must do before the ring unlocks the chapter. Goals can be COMBINED:
//     mode: 'car' | 'foot'   arrive in the car / on foot (press F to get out)
//     kmh:  110              reach this speed in the car at some point
//     orbs: [[x,z], ...]     collect every glowing orb
//     secs: 60               countdown for the whole mission. If it runs out the timer restarts AND the orbs reset
export const ZONES = [
  {
    id: 'about', title: 'ABOUT ME', color: '#ff4d6d', marker: [-35, -35], bld: [-62, -62], size: [34, 18, 26],
    mission: { mode: 'car', text: 'Welcome to the city! Drive your car into the glowing PINK ring.' },
    items: [
      { t: 'Darshan Mutalikdesai', d: 'Creative and detail-oriented Computer Science Engineering student specializing in Frontend Development, with hands-on experience building secure, responsive and accessible web applications using React.js, JavaScript and modern CSS frameworks.\n\nStrong in pixel-perfect UI, smooth animations and performance optimization, plus frontend security practices: secure authentication flows, protected routes, JWT-based API integration, and clean, scalable code architecture.' },
      { t: 'Education', d: 'Bachelor of Engineering in Computer Science\nKLS Gogte Institute of Technology, Belagavi · Expected graduation 2026\n\nCoursework: Data Structures, Algorithms, DBMS, OOP, Software Engineering, Web Technologies' },
    ],
  },
  {
    id: 'skills', title: 'SKILLS', color: '#ffd24d', marker: [-35, 35], bld: [-62, 62], size: [34, 16, 26],
    mission: { mode: 'foot', text: 'Press F to step out of the car, then WALK into the YELLOW ring on foot.' },
    items: [
      { t: 'Languages', d: 'JavaScript (ES6+), TypeScript, HTML5, CSS3, Python, SQL' },
      { t: 'Frontend Frameworks', d: 'React.js, Next.js, React Native, Redux, Context API' },
      { t: 'Styling & Design', d: 'Tailwind CSS, CSS Modules, Styled Components, Sass, Responsive Design, Framer Motion' },
      { t: 'Tools & Platforms', d: 'Git, GitHub, Figma, VS Code, Webpack, Vite, Postman' },
    ],
  },
  {
    id: 'experience', title: 'EXPERIENCE', color: '#c77dff', marker: [-135, 35], bld: [-162, 62], size: [34, 24, 26],
    mission: { mode: 'car', kmh: 110, text: 'Get back in your car, hit 110 km/h, then reach the PURPLE ring.' },
    items: [
      { t: 'Full Stack Developer (Freelance) — Karnataka Sanskrit University', d: 'Karnataka · July 2026 – Present\n• Developing and maintaining the university\'s web portal(s), building new features across the frontend and backend to support students, faculty and administrative staff.\n• Building responsive, accessible React.js interfaces and integrating them with backend services and databases to streamline university workflows.\n• Implementing secure authentication, input validation and clean, maintainable code practices to keep the portal reliable and scalable.' },
      { t: 'Frontend Developer Intern — IITB Trust Lab', d: 'Mumbai · March – June 2026\n• Developed a custom Security Operations Center (SOC) dashboard using React.js, Kibana and Elasticsearch for real-time security log monitoring and visualization.\n• Built responsive and reusable UI components integrated with Elasticsearch data pipelines, enabling efficient threat detection and log analysis.\n• Enhanced security monitoring workflows by contributing to alerting features and improving dashboard usability for incident response.' },
    ],
  },
  {
    id: 'projects', title: 'PROJECTS', color: '#4dc9ff', marker: [35, -35], bld: [62, -62], size: [34, 30, 26],
    mission: { orbs: [[-100, 0], [-50, 0], [0, -12]], secs: 60, text: 'TIMED RUN: collect the 3 orbs on the road and reach the BLUE ring within 60 seconds.' },
    items: [
      { t: 'Avalanche 2025 — Full Stack Web Application', d: '• Built a modern, fully responsive React.js frontend with cross-browser compatibility and performance optimization, integrated with Firebase for real-time data synchronization and live updates.\n• Implemented a QR code–based authentication system using RSA-encrypted unique IDs with an offline decryption backbone, validating 1,600+ registrations within 3 hours with secure, fast, duplicate-free entry management.\n• Developed secured RESTful API endpoints with JWT authentication, HTTPS/TLS encryption, authentication middleware, input validation and sanitization (XSS & injection prevention), and environment-based configuration management for sensitive credentials.' },
      { t: 'Aura 2026 — Security Systems', d: '• Built a secure, scalable MERN stack application (MongoDB, Express.js, React.js, Node.js) with RBAC-based authentication, protected routes, JWT token security and encrypted HTTPS/TLS communication.\n• Designed a robust security architecture including secured REST APIs, authentication middleware, input validation/sanitization (XSS & injection prevention), environment-based secret management, and a QR-code–based access control system for fast, secure verification.\n• Optimized the system for high performance and scale, supporting 200+ concurrent users and 10,000+ registrations, deployed on a low-latency intranet environment with clean, modular code for long-term maintainability.' },
    ],
  },
  {
    id: 'achievements', title: 'ACHIEVEMENTS', color: '#ff8a4d', marker: [135, 35], bld: [162, 62], size: [34, 20, 26],
    mission: { mode: 'car', kmh: 100, secs: 50, orbs: [[100, -60], [200, -150], [200, 60], [100, 150]], text: 'NEON GAUNTLET: hit 100 km/h, grab 4 orbs across the east city and reach the ORANGE ring within 50 seconds, by car. Watch the traffic!' },
    items: [
      { t: '1st Runner-Up — IEEE Girl Geek National Level Hackathon', d: 'Drowsiness Detector Project' },
      { t: 'Certifications — Udemy', d: 'Frontend Developer Certification\nMERN Stack Developer Certification' },
    ],
  },
  {
    id: 'contact', title: 'CONTACT', color: '#7dff6b', marker: [35, 35], bld: [62, 62], size: [34, 14, 26],
    mission: { mode: 'car', kmh: 130, secs: 270, orbs: [[420, -300], [690, 100], [610, 380], [150, 720], [-450, 430], [-560, -20], [-150, -380], [-201, -575]], text: 'FINAL BOSS RUN: grab all 8 orbs around the WHOLE ISLAND (use the bridges!), hit 130 km/h, then reach the GREEN ring within 4.5 minutes.' },
    items: [
      { t: 'Email', d: 'darshanmutalikdesai22@gmail.com', link: 'mailto:darshanmutalikdesai22@gmail.com' },
      { t: 'Location', d: 'Belagavi, Karnataka, India' },
      { t: 'LinkedIn', d: 'linkedin.com/in/darshan-mutalikdesai-b4a4832a0', link: 'https://www.linkedin.com/in/darshan-mutalikdesai-b4a4832a0' },
      { t: 'Portfolio', d: 'darshanmutalikdesai.dev', link: 'https://darshanmutalikdesai.dev/' },
    ],
  },
]
