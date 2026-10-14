/**
 * Helper to validate CORS origins for both Express and Socket.IO.
 * Automatically handles:
 * - Localhost and 127.0.0.1 on any port
 * - Any *.vercel.app deployment
 * - Any *.onrender.com deployment
 * - Explicit CLIENT_URL from environment (stripping trailing slashes, comma-separated)
 * - Requests without origin headers (mobile apps, curl, health checks)
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true;

  const cleanOrigin = origin.replace(/\/+$/, "").trim().toLowerCase();

  // Allow localhost & loopback
  if (
    cleanOrigin.startsWith("http://localhost:") ||
    cleanOrigin === "http://localhost" ||
    cleanOrigin.startsWith("http://127.0.0.1:") ||
    cleanOrigin === "http://127.0.0.1"
  ) {
    return true;
  }

  // Allow all Vercel deployments (production & preview URLs)
  if (cleanOrigin.endsWith(".vercel.app")) {
    return true;
  }

  // Allow Render deployments
  if (cleanOrigin.endsWith(".onrender.com")) {
    return true;
  }

  // Check custom CLIENT_URL(s)
  if (process.env.CLIENT_URL) {
    const configured = process.env.CLIENT_URL.split(",")
      .map((u) => u.replace(/\/+$/, "").trim().toLowerCase())
      .filter(Boolean);

    if (configured.includes(cleanOrigin)) {
      return true;
    }
  }

  return false;
};

module.exports = { isOriginAllowed };
