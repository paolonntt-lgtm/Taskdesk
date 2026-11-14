import { useEffect } from "react";
import { Alert } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export function WorkspaceAccessRevokedAlert() {
  const { user, isLoading, workspaceAccessRevoked, dismissWorkspaceAccessRevoked } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (isLoading || !user || !workspaceAccessRevoked) return;

    dismissWorkspaceAccessRevoked();
    Alert.alert(
      t.profile.workspaceAccessRevokedTitle,
      t.profile.workspaceAccessRevokedMessage,
      [{ text: t.profile.logoutCancel }],
    );
  }, [dismissWorkspaceAccessRevoked, isLoading, t.profile, user, workspaceAccessRevoked]);

  return null;
}
