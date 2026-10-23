import {
  BrowserAuthError,
  BrowserAuthErrorCodes,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from "@azure/msal-browser";

const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;
const scopes = ["Files.Read", "User.Read"];
const redirectUri = new URL(import.meta.env.BASE_URL, window.location.origin).toString();

let client: PublicClientApplication | null = null;
let initialization: Promise<void> | null = null;
let accessTokenRequest: { changeAccount: boolean; promise: Promise<string> } | null = null;

export function isOneDriveInteractionInProgress(error: unknown): boolean {
  return error instanceof BrowserAuthError
    && error.errorCode === BrowserAuthErrorCodes.interactionInProgress;
}

function getClient(): PublicClientApplication {
  if (!clientId) throw new Error("ONEDRIVE_NOT_CONFIGURED");
  if (!client) {
    client = new PublicClientApplication({
      auth: {
        clientId,
        authority: "https://login.microsoftonline.com/common",
        redirectUri,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    initialization = client.initialize();
  }
  return client;
}

async function getAccount(
  msal: PublicClientApplication,
  changeAccount: boolean,
  recoverInteraction: boolean,
): Promise<AccountInfo> {
  if (changeAccount) {
    const result = await msal.loginPopup({
      scopes,
      prompt: "select_account",
      redirectUri,
      overrideInteractionInProgress: recoverInteraction,
    });
    if (result.account) {
      msal.setActiveAccount(result.account);
      return result.account;
    }
  }

  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
  if (account) return account;

  const result = await msal.loginPopup({
    scopes,
    prompt: "select_account",
    redirectUri,
    overrideInteractionInProgress: recoverInteraction,
  });
  if (!result.account) throw new Error("ONEDRIVE_ACCOUNT_REQUIRED");
  msal.setActiveAccount(result.account);
  return result.account;
}

async function acquireOneDriveAccessToken(
  changeAccount: boolean,
  recoverInteraction: boolean,
): Promise<string> {
  const msal = getClient();
  await initialization;
  const account = await getAccount(msal, changeAccount, recoverInteraction);
  try {
    const result = await msal.acquireTokenSilent({ account, scopes });
    return result.accessToken;
  } catch (error) {
    if (!(error instanceof InteractionRequiredAuthError)) throw error;
    const result = await msal.acquireTokenPopup({
      account,
      scopes,
      prompt: changeAccount ? "select_account" : "consent",
      redirectUri,
      overrideInteractionInProgress: recoverInteraction,
    });
    return result.accessToken;
  }
}

export function getOneDriveAccessToken(
  changeAccount = false,
  recoverInteraction = false,
): Promise<string> {
  if (accessTokenRequest) {
    if (!changeAccount || accessTokenRequest.changeAccount) return accessTokenRequest.promise;
    return accessTokenRequest.promise
      .catch(() => "")
      .then(() => getOneDriveAccessToken(true, recoverInteraction));
  }

  const promise = acquireOneDriveAccessToken(changeAccount, recoverInteraction).finally(() => {
    if (accessTokenRequest?.promise === promise) accessTokenRequest = null;
  });
  accessTokenRequest = { changeAccount, promise };
  return promise;
}

export type OneDriveItem = {
  id: string;
  name: string;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  webUrl?: string;
};

type OneDriveCollection = {
  value?: OneDriveItem[];
  "@odata.nextLink"?: string;
};

export async function listOneDriveChildren(parentId?: string): Promise<OneDriveItem[]> {
  const token = await getOneDriveAccessToken();
  const endpoint = parentId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(parentId)}/children`
    : "https://graph.microsoft.com/v1.0/me/drive/root/children";
  const query = "?$select=id,name,folder,file,webUrl&$top=200";
  let nextUrl: string | undefined = `${endpoint}${query}`;
  const items: OneDriveItem[] = [];

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({})) as OneDriveCollection & {
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message || `OneDrive request failed (${response.status}).`);
    }
    items.push(...(payload.value ?? []));
    const nextLink = payload["@odata.nextLink"];
    if (nextLink && new URL(nextLink).origin !== "https://graph.microsoft.com") {
      throw new Error("Unexpected OneDrive pagination URL.");
    }
    nextUrl = nextLink;
  }
  return items.sort((a, b) => Number(Boolean(b.folder)) - Number(Boolean(a.folder)) || a.name.localeCompare(b.name));
}
