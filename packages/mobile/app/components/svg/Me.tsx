import React from 'react';
import { SvgProps } from 'react-native-svg';
import OriginalMeSvg from '../../assets/me.svg';

const Me: React.FC<SvgProps> = (props) => {
  return <OriginalMeSvg {...props} />;
};

export default Me;
