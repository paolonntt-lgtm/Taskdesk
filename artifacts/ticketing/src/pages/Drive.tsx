import { Box, Typography } from "@mui/material";
import DriveBrowser from "../components/DriveBrowser";
import { useLanguage } from "../contexts/LanguageContext";

export default function DrivePage() {
  const { lang } = useLanguage();

  return (
    <Box maxWidth={1000} mx="auto">
      <Typography variant="h4" fontWeight={700} mb={2}>
        Google Drive
      </Typography>
      <Typography color="text.secondary" mb={2}>
        {lang === "it"
          ? "Consulta le cartelle e i file dell’account Google collegato."
          : "Browse folders and files from your connected Google account."}
      </Typography>
      <DriveBrowser context="library" />
    </Box>
  );
}
