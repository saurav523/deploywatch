import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dw_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      const refreshToken = localStorage.getItem("dw_refresh_token");

      if (refreshToken) {
        try {
          error.config._retry = true;

          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL ?? ""}/api/v1/auth/refresh`,
            { refreshToken }
          );

          localStorage.setItem("dw_access_token", data.data.accessToken);
          localStorage.setItem("dw_refresh_token", data.data.refreshToken);

          error.config.headers.Authorization =
            `Bearer ${data.data.accessToken}`;

          return api.request(error.config);
        } catch {
          localStorage.removeItem("dw_access_token");
          localStorage.removeItem("dw_refresh_token");
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);
