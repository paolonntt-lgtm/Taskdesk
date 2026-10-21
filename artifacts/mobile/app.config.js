const { expo } = require("./app.json");

module.exports = ({ config }) => {
  const {
    googleServicesFile: localGoogleServicesFile,
    ...androidConfig
  } = expo.android;
  const isEasBuild = process.env.EAS_BUILD === "true";
  if (isEasBuild && !process.env.GOOGLE_SERVICES_JSON) {
    throw new Error(
      "GOOGLE_SERVICES_JSON must be configured as an EAS file environment variable for this environment."
    );
  }
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (isEasBuild ? undefined : localGoogleServicesFile);

  return {
    ...config,
    ...expo,
    android: {
      ...androidConfig,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
