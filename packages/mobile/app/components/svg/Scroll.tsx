import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";

interface ScrollProps {
  width?: number;
  height?: number;
  color?: string;
}

const Scroll: React.FC<ScrollProps> = ({
  width = 26,
  height = 26,
  color = "#1E1E1E",
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 26 26" fill="none">
      <Path
        d="M6.5 9.75L13 16.25L19.5 9.75"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default Scroll;
