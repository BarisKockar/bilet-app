const STORAGE_KEYS = {
  isLoggedIn: "is_logged_in",
  userName: "ticket_user_name",
  username: "ticket_username",
  userRole: "ticket_user_role",
} as const;

export type StoredSession = {
  isLoggedIn: boolean;
  userName: string;
  username: string;
  userRole: string;
};

export function getStoredSession(): StoredSession {
  return {
    isLoggedIn: localStorage.getItem(STORAGE_KEYS.isLoggedIn) === "true",
    userName: localStorage.getItem(STORAGE_KEYS.userName) || "",
    username: localStorage.getItem(STORAGE_KEYS.username) || "",
    userRole: localStorage.getItem(STORAGE_KEYS.userRole) || "",
  };
}

export function saveStoredSession(session: {
  userName: string;
  username: string;
  userRole: string;
}) {
  localStorage.setItem(STORAGE_KEYS.isLoggedIn, "true");
  localStorage.setItem(STORAGE_KEYS.userName, session.userName);
  localStorage.setItem(STORAGE_KEYS.username, session.username);
  localStorage.setItem(STORAGE_KEYS.userRole, session.userRole);
}

export function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEYS.isLoggedIn);
  localStorage.removeItem(STORAGE_KEYS.userName);
  localStorage.removeItem(STORAGE_KEYS.username);
  localStorage.removeItem(STORAGE_KEYS.userRole);
}

export function getStoredUserName() {
  return localStorage.getItem(STORAGE_KEYS.userName) || "";
}

export function setStoredUserName(userName: string) {
  localStorage.setItem(STORAGE_KEYS.userName, userName);
}
