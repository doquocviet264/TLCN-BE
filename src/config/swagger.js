import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Travela API",
      version: "1.0.0",
      description: "API documentation for Travela Booking Tour",
    },
    servers: [
      { url: "http://localhost:4000" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      },
      schemas: {
        Tour: {
          type: "object",
          properties: {
            tourId: { type: "integer", example: 1 },
            title: { type: "string", example: "Ha Long Bay 3N2D" },
            time: { type: "string", example: "3 ngày 2 đêm" },
            description: { type: "string", example: "Tham quan vịnh Hạ Long..." },
            quantity: { type: "integer", example: 30 },
            priceAdult: { type: "number", format: "double", example: 299.99 },
            priceChild: { type: "number", format: "double", example: 199.99 },
            destination: { type: "string", example: "Quang Ninh" },
            adminId: { type: "integer", example: 1 },
            startDate: { type: "string", format: "date", example: "2025-12-01" },
            endDate: { type: "string", format: "date", example: "2025-12-03" }
          }
        },
        TourCreateInput: {
          type: "object",
          required: ["title", "priceAdult", "priceChild"],
          properties: {
            title: { type: "string" },
            time: { type: "string" },
            description: { type: "string" },
            quantity: { type: "integer" },
            priceAdult: { type: "number", format: "double" },
            priceChild: { type: "number", format: "double" },
            destination: { type: "string" },
            adminId: { type: "integer" },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" }
          }
        }
      }
    },
    tags: [{ name: "Tours", description: "Tour listing & management" }]
  },
  apis: ["./src/routes/*.js"],
});
