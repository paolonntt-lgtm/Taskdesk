import "./_group.css";
import {
  AutoAwesomeRounded,
  ArrowForwardRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { previewTheme } from "./theme";

export function Refined() {
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
          aria-labelledby="refined-albert-title"
          aria-describedby="refined-albert-description"
          PaperProps={{
            sx: {
              maxWidth: 460,
              overflow: "hidden",
              borderRadius: 4,
              border: "1px solid rgba(148,163,184,.2)",
              boxShadow: "0 28px 90px rgba(30,41,59,.25)",
            },
          }}
        >
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              px: 3.5,
              pt: 3.25,
              pb: 3,
              background:
                "radial-gradient(circle at 100% 0%, rgba(124,58,237,.12), transparent 38%), linear-gradient(135deg, #eff6ff 0%, #f7f3ff 100%)",
              "&::before": {
                content: '""',
                position: "absolute",
                width: 190,
                height: 190,
                borderRadius: "50%",
                right: -108,
                bottom: -132,
                border: "1px solid rgba(124,58,237,.10)",
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
                zIndex: 1,
              }}
            >
              <Box
                sx={{
                  width: 58,
                  height: 58,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "19px",
                  position: "relative",
                  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                  boxShadow: "0 9px 20px rgba(79,70,229,.22)",
                }}
              >
                <Box
                  component="img"
                  src="/__mockup/images/albert-einstein-silhouette.png"
                  alt=""
                  aria-hidden="true"
                  sx={{
                    width: 44,
                    height: 44,
                    objectFit: "cover",
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,.9)",
                    bgcolor: "#fff",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    right: -5,
                    bottom: -4,
                    width: 23,
                    height: 23,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "50%",
                    bgcolor: "#fff",
                    color: "#6d28d9",
                    boxShadow: "0 2px 7px rgba(30,41,59,.18)",
                  }}
                >
                  <AutoAwesomeRounded sx={{ fontSize: 15 }} />
                </Box>
              </Box>
              <Chip
                label="NOVITÀ"
                size="small"
                sx={{
                  height: 28,
                  px: 0.5,
                  color: "#4f46e5",
                  bgcolor: "rgba(255,255,255,.76)",
                  border: "1px solid rgba(99,102,241,.16)",
                  fontWeight: 800,
                  letterSpacing: ".05em",
                  fontSize: 10,
                }}
              />
            </Box>

            <DialogTitle
              id="refined-albert-title"
              sx={{
                position: "relative",
                zIndex: 1,
                px: 0,
                pt: 2.5,
                pb: 0.9,
                color: "#172033",
                fontSize: 25,
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-.035em",
              }}
            >
              Albert è più conversazionale
            </DialogTitle>
            <DialogContent sx={{ position: "relative", zIndex: 1, px: 0, pb: 0 }}>
              <Typography
                id="refined-albert-description"
                variant="body2"
                sx={{
                  maxWidth: 390,
                  color: "#4b5563",
                  fontSize: 14.5,
                  lineHeight: 1.7,
                }}
              >
                Ora puoi chiedergli dei ticket e dei commenti, oppure farti aiutare a preparare e ritrovare i report giornalieri.
              </Typography>
            </DialogContent>
          </Box>

          <DialogActions
            sx={{
              px: 3,
              py: 2.25,
              gap: 1,
              borderTop: "1px solid rgba(148,163,184,.16)",
              bgcolor: "#fff",
              "& .MuiButton-root": { minHeight: 44 },
            }}
          >
            <Button
              onClick={() => {}}
              sx={{
                color: "#64748b",
                px: 1.5,
                "&:hover": { bgcolor: "rgba(100,116,139,.08)" },
              }}
            >
              Ho capito
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardRounded sx={{ fontSize: 17 }} />}
              onClick={() => {}}
              sx={{
                minWidth: 165,
                borderRadius: 2.5,
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                boxShadow: "0 8px 18px rgba(79,70,229,.2)",
                "&:hover": {
                  background: "linear-gradient(135deg, #1d4ed8, #6d28d9)",
                  boxShadow: "0 10px 20px rgba(79,70,229,.27)",
                },
              }}
            >
              Chiedi ad Albert
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
