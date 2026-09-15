import { useCallback, useState } from "react";

export type Role = "pilot" | "gunner";

function readRole(): Role | null {
  const value = new URLSearchParams(window.location.search).get("role");
  return value === "pilot" || value === "gunner" ? value : null;
}

// ?role=pilot|gunner in the URL, so the PC and the phone can just be sent
// different links instead of needing an in-app switch mid-session.
export function useRole() {
  const [role, setRoleState] = useState<Role | null>(readRole);

  const setRole = useCallback((next: Role) => {
    const url = new URL(window.location.href);
    url.searchParams.set("role", next);
    window.history.replaceState(null, "", url);
    setRoleState(next);
  }, []);

  return { role, setRole };
}
