import React from "react";
import { SvgProps } from "react-native-svg";
import OriginalMaximizeSvg from "../../assets/Maximize.svg";

const Maximize: React.FC<SvgProps> = (props) => {
  return <OriginalMaximizeSvg {...props} />;
};

export default Maximize;
