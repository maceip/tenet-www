const asset = (p) => import.meta.env.BASE_URL + p;

/**
 * Halftone TENET wordmarks from ~/Downloads/logo_red.png & logo_black.png
 * variant: hero | nav | footer
 * theme: light | dark — red on dark surfaces, black on light
 */
export default function TenetLogo({ variant = "nav", theme = "dark", className = "" }) {
  const isDark = theme === "dark";
  const useRed = isDark;
  const src = asset(useRed ? "logo/logo-red.png" : "logo/logo-black.png");
  const dims = useRed
    ? { width: 1536, height: 1024 }
    : { width: 1563, height: 1006 };

  const classes = [
    "tenet-logo",
    `tenet-logo--${variant}`,
    useRed ? "tenet-logo--red" : "tenet-logo--black",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const Tag = variant === "hero" ? "h1" : "span";

  return (
    <Tag className={variant === "hero" ? "wordmark" : undefined}>
      <img
        className={classes}
        src={src}
        alt="TENET"
        data-testid={variant === "hero" ? "tenet-logo-hero" : undefined}
        {...dims}
      />
    </Tag>
  );
}
