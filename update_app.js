const fs = require('fs');
let content = fs.readFileSync('src/app.js', 'utf8');
content = content.replace(
  'import notificationRoutes from "./routes/notification.routes.js";',
  'import notificationRoutes from "./routes/notification.routes.js";\nimport travelMemoryRoutes from "./routes/travelMemory.routes.js";'
);
content = content.replace(
  'app.use("/api/notifications", notificationRoutes);',
  'app.use("/api/notifications", notificationRoutes);\napp.use("/api/travel-memories", travelMemoryRoutes);'
);
fs.writeFileSync('src/app.js', content);
