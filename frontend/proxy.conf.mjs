const MOCK_API = `http://localhost:${process.env.MOCK_PORT ?? 4300}`;
const SPRING_API = `http://localhost:${process.env.SPRING_PORT ?? 8080}`;

export default {
  '/api': {
    target: process.env.USE_MOCK_BACKEND === 'false' ? SPRING_API : MOCK_API,
    secure: false,
  },
};
