interface AlbertAvatarIconProps {
  size?: number;
}

export function AlbertAvatarIcon({ size = 22 }: AlbertAvatarIconProps) {
  return (
    <img
      src="/albert-einstein-avatar.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      style={{
        display: 'block',
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: '50%',
      }}
    />
  );
}