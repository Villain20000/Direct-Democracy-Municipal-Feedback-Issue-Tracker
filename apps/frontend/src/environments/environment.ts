// In development, API calls go through the Angular proxy (see proxy.conf.json)
// so they use the same origin as the frontend — eliminating CORS issues.
export const environment = {
  production: false,
  apiUrl: '/api/v1',
};
