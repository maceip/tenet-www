const asset = (p) => import.meta.env.BASE_URL + p;

const NAVBAR_LIGHT = asset("logo/logo-navbar-light.png");
const NAVBAR_DARK_FRAMES = [
  asset("logo/logo-navbar-dark-purple.png"),
  asset("logo/logo-navbar-dark-orange.png"),
  asset("logo/logo-navbar-dark-green.png"),
  asset("logo/logo-navbar-dark-red.png"),
  asset("logo/logo-navbar-dark-teal.png"),
];
const NAVBAR_FRAME_DIMS = { width: 684, height: 497 };
const FOOTER_RED = asset("logo/logo-red.webp");
const FOOTER_BLACK = asset("logo/logo-black.webp");

function NavLogoDarkCycle({ className = "" }) {
  return (
    <span className={`tenet-logo-nav-cycle ${className}`.trim()} aria-label="TENET">
      {NAVBAR_DARK_FRAMES.map((src, i) => (
        <img
          key={src}
          className="tenet-logo tenet-logo--nav tenet-logo--navbar-dark-frame"
          src={src}
          alt=""
          aria-hidden="true"
          style={{ animationDelay: `${-i * 4}s` }}
          {...NAVBAR_FRAME_DIMS}
        />
      ))}
      <span className="visually-hidden">TENET</span>
    </span>
  );
}

/**
 * Navbar: light punk PNG; dark color-cycle PNG stack.
 * Footer: halftone webp wordmarks.
 */
export default function TenetLogo({ variant = "nav", theme = "dark", className = "" }) {
  const isDark = theme === "dark";

  if (variant === "nav" && isDark) {
    return <NavLogoDarkCycle className={className} />;
  }

  if (variant === "nav" && !isDark) {
    const classes = ["tenet-logo", "tenet-logo--nav", "tenet-logo--navbar-light", className]
      .filter(Boolean)
      .join(" ");
    return (
      <span>
        <img className={classes} src={NAVBAR_LIGHT} alt="TENET" {...NAVBAR_FRAME_DIMS} />
      </span>
    );
  }

  const useRed = isDark;
  const src = useRed ? FOOTER_RED : FOOTER_BLACK;
  const dims = useRed ? { width: 1144, height: 392 } : { width: 1065, height: 351 };
  const classes = [
    "tenet-logo",
    `tenet-logo--${variant}`,
    useRed ? "tenet-logo--red" : "tenet-logo--black",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span>
      <img className={classes} src={src} alt="TENET" {...dims} />
    </span>
  );
}
