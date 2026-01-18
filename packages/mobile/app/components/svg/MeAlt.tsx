import React from "react";
import { SvgProps } from "react-native-svg";
import OriginalMeSvg from "../../assets/meAlt.svg";

const MeAlt: React.FC<SvgProps> = (props) => {
  return <OriginalMeSvg {...props} />;
};

export default MeAlt;
