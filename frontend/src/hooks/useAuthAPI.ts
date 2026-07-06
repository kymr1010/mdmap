import { fetchAPI } from "./useAPI.js";

export interface AuthStatus {
  authenticated: boolean;
  auth_enabled: boolean;
}

export const getAuthStatus = async (): Promise<AuthStatus> => {
  const res = await fetchAPI("auth/status", {
    method: "GET",
  });
  return res.data as AuthStatus;
};

export const login = async (password: string): Promise<AuthStatus> => {
  const res = await fetchAPI("auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  return res.data as AuthStatus;
};

export const logout = async (): Promise<AuthStatus> => {
  const res = await fetchAPI("auth/logout", {
    method: "POST",
  });
  return res.data as AuthStatus;
};
