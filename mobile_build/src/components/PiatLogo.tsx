import type { StyleProp, ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";

const PIAT_LOGO_XML = `<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">PIAT logo</title>
  <desc id="desc">Shield emblem for Philtech Institute of Arts and Technology</desc>
  <defs>
    <linearGradient id="gold" x1="0" x2="1">
      <stop offset="0%" stop-color="#f5db4a"/>
      <stop offset="100%" stop-color="#d89a00"/>
    </linearGradient>
    <linearGradient id="blue" x1="0" x2="1">
      <stop offset="0%" stop-color="#163dc7"/>
      <stop offset="100%" stop-color="#0e1f8a"/>
    </linearGradient>
    <linearGradient id="maroon" x1="0" x2="1">
      <stop offset="0%" stop-color="#ae1232"/>
      <stop offset="100%" stop-color="#6e061d"/>
    </linearGradient>
  </defs>

  <path d="M400 30C515 55 644 88 704 114C690 332 678 548 610 669C560 754 485 794 400 814C315 794 240 754 190 669C122 548 110 332 96 114C156 88 285 55 400 30Z" fill="url(#gold)" stroke="#101fa7" stroke-width="18"/>
  <path d="M400 78C496 96 603 122 660 146C650 318 641 500 588 622C544 718 476 760 400 785C324 760 256 718 212 622C159 500 150 318 140 146C197 122 304 96 400 78Z" fill="url(#blue)"/>
  <path d="M400 110C485 128 576 152 627 176C620 315 612 470 566 577C528 664 474 708 400 742C326 708 272 664 234 577C188 470 180 315 173 176C224 152 315 128 400 110Z" fill="url(#maroon)"/>

  <text x="400" y="165" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="112" fill="#b70f32" letter-spacing="4">PIAT</text>
  <text x="400" y="250" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="54" fill="#f6d84a" letter-spacing="3">PHILTECH</text>

  <g>
    <circle cx="400" cy="380" r="150" fill="#e8e7e5" stroke="#0d1d92" stroke-width="11"/>
    <circle cx="400" cy="380" r="124" fill="#0b7cc9"/>
    <path d="M300 394C327 350 367 322 407 313C460 301 512 320 548 364C527 442 480 494 406 514C349 495 312 454 300 394Z" fill="#dfe9f0" opacity="0.82"/>
    <path d="M308 394C322 345 364 300 420 287C477 274 535 293 573 335C555 370 532 397 490 420C456 441 427 449 400 452C369 451 338 437 308 394Z" fill="#d6e7f3" opacity="0.86"/>
    <path d="M294 438C330 460 369 477 403 477C438 477 478 462 526 434C506 504 456 540 400 550C342 540 293 502 294 438Z" fill="#dfeaf3" opacity="0.72"/>
    <path d="M329 312C364 336 383 370 400 410C417 370 436 336 471 312C452 282 424 270 400 270C376 270 348 282 329 312Z" fill="#d9eef8" opacity="0.8"/>
    <path d="M400 323V435M332 383H468" stroke="#0d1d92" stroke-width="5" stroke-linecap="round" opacity="0.4"/>
  </g>

  <g fill="url(#gold)">
    <path d="M220 505C286 468 325 468 366 496C337 548 314 604 300 667C244 642 213 601 220 505Z"/>
    <path d="M580 505C514 468 475 468 434 496C463 548 486 604 500 667C556 642 587 601 580 505Z"/>
  </g>

  <g fill="#f6f0e9" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">
    <text x="400" y="585" font-size="28" letter-spacing="3">INSTITUTE OF ARTS</text>
    <text x="400" y="624" font-size="26" letter-spacing="3">AND TECHNOLOGY</text>
  </g>

  <g fill="#f5d96c" font-family="Arial Black, Arial, sans-serif" font-weight="900">
    <text x="120" y="462" font-size="56" transform="rotate(-90 120 462)" text-anchor="middle">PERITUS</text>
    <text x="680" y="462" font-size="56" transform="rotate(90 680 462)" text-anchor="middle">AEMULUS</text>
  </g>
</svg>`;

type PiatLogoProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function PiatLogo({ size = 72, style }: PiatLogoProps) {
  return <SvgXml xml={PIAT_LOGO_XML} width={size} height={size} style={style} />;
}
