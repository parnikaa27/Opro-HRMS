const MOCK_API = `http://localhost:${process.env.MOCK_PORT ?? 4300}`;
const SPRING_API = `http://localhost:${process.env.SPRING_PORT ?? 8080}`;

// Spring and PostgreSQL by default. USE_MOCK_BACKEND=true sends /api to the JSON mock instead.
export default {
  '/api': {
    target: process.env.USE_MOCK_BACKEND === 'true' ? MOCK_API : SPRING_API,
    secure: false,
  },
};
