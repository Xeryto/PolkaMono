import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalHeartFilledSvg from '../../assets/HeartFilled.svg';

const HeartFilled: React.FC<SvgProps> = (props) => {
  return <OriginalHeartFilledSvg {...props} />;
};

export default HeartFilled;