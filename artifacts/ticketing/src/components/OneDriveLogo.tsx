import React, { type ImgHTMLAttributes } from "react";

/** Official Microsoft OneDrive icon (2025), stored locally as an SVG asset. */
export default function OneDriveLogo(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img src={`${import.meta.env.BASE_URL}onedrive-logo.svg`} alt="Microsoft OneDrive" {...props} />;
}
