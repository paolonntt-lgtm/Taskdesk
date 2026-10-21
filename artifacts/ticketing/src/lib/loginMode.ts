export type LoginMode = "login" | "register" | "forgot";

export function getInitialLoginMode(search: string): LoginMode {
  const params = new URLSearchParams(search);
  return params.get("ref") || params.get("mode") === "register" ? "register" : "login";
}
