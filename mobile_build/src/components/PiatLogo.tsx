import type { ImageStyle, StyleProp } from "react-native";
import { Image } from "react-native";
import logo from "../../assets/piat-logo.png";

type PiatLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function PiatLogo({ size = 72, style }: PiatLogoProps) {
  return (
    <Image
      source={logo}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessibilityLabel="PIAT logo"
    />
  );
}
