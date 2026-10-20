const { expo } = require("./app.json");

module.exports = ({ config }) => {
  const {
    googleServicesFile: localGoogleServicesFile,
    ...androidConfig
  } = expo.android;
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (process.env.EAS_BUILD ? undefined : localGoogleServicesFile);

  return {
    ...config,
    ...expo,
    android: {
      ...androidConfig,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
