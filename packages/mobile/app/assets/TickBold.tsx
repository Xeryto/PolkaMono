import * as React from "react";
import Svg, { Path } from "react-native-svg";

interface TickBoldProps {
  width?: number;
  height?: number;
  color?: string;
}

const TickBold: React.FC<TickBoldProps> = ({
  width = 28,
  height = 28,
  color = "#000",
}) => {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d="M4.5 12.75L9.5 17.75L19.5 6.25"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default TickBold;
