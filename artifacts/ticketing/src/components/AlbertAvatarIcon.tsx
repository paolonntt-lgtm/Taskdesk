interface AlbertAvatarIconProps {
  size?: number;
}

export function AlbertAvatarIcon({ size = 22 }: AlbertAvatarIconProps) {
  const avatarUrl = `${import.meta.env.BASE_URL}albert-einstein-avatar.png`;

  return (
    <img
      src={avatarUrl}
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