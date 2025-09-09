import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalHeartSvg from '../../assets/Heart.svg';

const Heart: React.FC<SvgProps> = (props) => {
  return <OriginalHeartSvg {...props} />;
};

export default Heart;