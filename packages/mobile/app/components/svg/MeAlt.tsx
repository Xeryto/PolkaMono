import React from "react";
import { SvgProps } from "react-native-svg";
import OriginalMeSvg from "../../assets/meAlt.svg";
import MeAltDarkSvg from "../../assets/meAltDark.svg";
import { useTheme } from "../../lib/ThemeContext";

const MeAlt: React.FC<SvgProps> = (props) => {
  const { colorScheme } = useTheme();
  return colorScheme === "dark" ? <MeAltDarkSvg {...props} /> : <OriginalMeSvg {...props} />;
};

export default MeAlt;
