import "./_group.css";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { previewTheme } from "./theme";

export function Current() {
  return (
    <ThemeProvider theme={previewTheme}>
      <Box
        sx={{
          minHeight: 460,
          p: 3,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #edf2eb 0%, #e8edf5 100%)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#334155" }}>TaskDesk</Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Box sx={{ width: 54, height: 9, borderRadius: 99, bgcolor: "rgba(100,116,139,.16)" }} />
            <Box sx={{ width: 34, height: 9, borderRadius: 99, bgcolor: "rgba(100,116,139,.11)" }} />
          </Box>
        </Box>
        <Box sx={{ display: "grid", gap: 1.25, opacity: 0.55 }}>
          {[0, 1, 2].map((row) => (
            <Box
              key={row}
              sx={{
                height: 56,
                borderRadius: 2,
                border: "1px solid rgba(148,163,184,.18)",
                bgcolor: "rgba(255,255,255,.65)",
              }}
            />
          ))}
        </Box>

        <Dialog
          open
          fullWidth
          maxWidth="xs"
          onClose={() => {}}
          aria-labelledby="current-albert-title"
          aria-describedby="current-albert-description"
        >
          <DialogTitle id="current-albert-title" sx={{ pb: 1 }}>
            Albert è più conversazionale
          </DialogTitle>
          <DialogContent>
            <Typography
              id="current-albert-description"
              variant="body2"
              color="text.secondary"
            >
              Ora puoi chiedergli dei ticket e dei commenti, oppure farti aiutare a preparare e ritrovare i report giornalieri.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => {}}>Ho capito</Button>
            <Button variant="contained" onClick={() => {}}>Chiedi ad Albert</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
